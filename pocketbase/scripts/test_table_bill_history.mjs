import assert from "node:assert/strict";

const baseUrl = (process.env.PB_TEST_URL || "http://127.0.0.1:9996").replace(/\/$/, "");
const superuserEmail = process.env.PB_TEST_SUPERUSER_EMAIL;
const superuserPassword = process.env.PB_TEST_SUPERUSER_PASSWORD;
assert.ok(superuserEmail && superuserPassword, "Set PB_TEST_SUPERUSER_EMAIL and PB_TEST_SUPERUSER_PASSWORD for an isolated PocketBase test server.");

async function request(path, { method = "GET", body, token } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: token } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }
  return { response, data };
}

async function ok(path, options) {
  const result = await request(path, options);
  assert.ok(result.response.ok, `${options?.method || "GET"} ${path} failed (${result.response.status}): ${JSON.stringify(result.data)}`);
  return result.data;
}

async function rejected(path, options, statuses = [400, 403, 404, 409]) {
  const result = await request(path, options);
  assert.ok(statuses.includes(result.response.status), `${options?.method || "GET"} ${path} should reject, got ${result.response.status}: ${JSON.stringify(result.data)}`);
  return result;
}

async function createRecord(token, collection, body) {
  return ok(`/api/collections/${collection}/records`, { method: "POST", token, body });
}

let userIndex = 0;
async function createUser(token, store, username, role = "user") {
  userIndex += 1;
  const password = `TableAudit-${username}-2026!`;
  await createRecord(token, "users", {
    username,
    email: `${username}@example.com`,
    password,
    passwordConfirm: password,
    fullname: username,
    phone: `09${String(10000000 + userIndex).slice(0, 8)}`,
    store,
    role,
    is_approved: true,
    verified: true,
  });
  return ok("/api/collections/users/auth-with-password", { method: "POST", body: { identity: username, password } });
}

const superAuth = await ok("/api/collections/_superusers/auth-with-password", {
  method: "POST",
  body: { identity: superuserEmail, password: superuserPassword },
});
const superToken = superAuth.token;
const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const storeA = await createRecord(superToken, "stores", { name: `Kiểm thử lịch sử ${suffix}`, service_type: "service" });
const storeB = await createRecord(superToken, "stores", { name: `Cửa hàng khác ${suffix}`, service_type: "service" });
const adminA = await createUser(superToken, storeA.id, `auditadmin${suffix}`, "admin");
const customerA = await createUser(superToken, storeA.id, `audituser${suffix}`);
const strangerA = await createUser(superToken, storeA.id, `auditstranger${suffix}`);
const adminB = await createUser(superToken, storeB.id, `auditadminb${suffix}`, "admin");

await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "configure_layout", rowCount: 1, tablesPerRow: [2] } });
await ok("/api/table-billing/action", { method: "POST", token: adminB.token, body: { action: "configure_layout", rowCount: 1, tablesPerRow: [1] } });
const tableA = (await ok("/api/table-billing/map", { token: adminA.token })).tables[0];
const started = await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "start", tableId: tableA.id, customerId: customerA.record.id } });
const product = await createRecord(adminA.token, "products", { store: storeA.id, name: "Nước test", category: "Đồ uống", kind: "drink", price: 10000, billing_unit: "quantity", unit_label: "chai", is_active: true });
await ok("/api/admin/inventory/movement", { method: "POST", token: adminA.token, body: { productId: product.id, movementType: "in", quantity: 10, unitCost: 10000 } });
let billResult = await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "add_item", billId: started.billId, productId: product.id, quantity: 1 } });
const item = billResult.bill.items.find((row) => row.product === product.id);
billResult = await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "update_item", billId: started.billId, itemId: item.id, quantity: 3 } });
const removedResult = await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "add_item", billId: started.billId, productId: product.id, quantity: 1 } });
const removedItem = removedResult.bill.items.find((row) => row.id !== item.id);
await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "delete_item", billId: started.billId, itemId: removedItem.id } });
await rejected("/api/table-billing/action", { method: "POST", token: customerA.token, body: { action: "payment_started", billId: started.billId } }, [400]);
const requested = await ok("/api/table-billing/action", { method: "POST", token: customerA.token, body: { action: "request_transfer", billId: started.billId } });
assert.equal(requested.bill.status, "wallet_pending");
const paid = await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "pay_manual", billId: started.billId, paymentMethod: "transfer" } });
assert.equal(paid.bill.status, "paid");

const history = await ok(`/api/table-billing/history?billId=${encodeURIComponent(started.billId)}`, { token: adminA.token });
const byType = (type) => history.items.filter((event) => event.eventType === type);
assert.ok(byType("payment_completed").some((event) => event.actorId === adminA.record.id && event.paymentMethod === "transfer" && event.amount === 30000), "payment confirmation records the admin and settled amount");
assert.equal(byType("payment_started").length, 0, "opening payment does not create a history event");
assert.ok(byType("payment_requested").some((event) => event.actorId === customerA.record.id && event.paymentMethod === "transfer" && event.amount === 30000), "transfer request records its amount and customer");
assert.ok(byType("item_added").some((event) => event.details.productName === "Nước test"), "adding an item after submission is recorded");
const adjustment = byType("quantity_changed").find((event) => event.details.itemId === item.id);
assert.deepEqual([adjustment?.details.oldQuantity, adjustment?.details.newQuantity], [1, 3], "quantity changes record both values");
assert.ok(byType("item_removed").some((event) => event.details.productName === "Nước test"), "removing an item keeps a snapshot of its name");
assert.ok(byType("bill_opened").some((event) => event.actorId === adminA.record.id), "opening a table is recorded as a business action");
const paymentHistory = await ok(`/api/table-billing/history?billId=${encodeURIComponent(started.billId)}&category=payment`, { token: customerA.token });
assert.ok(paymentHistory.items.length >= 2 && paymentHistory.items.every((event) => event.category === "payment"), "the assigned customer can read payment history for their bill");
assert.ok(paymentHistory.items.some((event) => event.eventType === "payment_requested") && paymentHistory.items.some((event) => event.eventType === "payment_completed"), "payment history includes submitted request and completion");
assert.equal(paymentHistory.items.some((event) => event.eventType === "payment_started"), false, "payment history excludes opening checkout");
const actionHistory = await ok(`/api/table-billing/history?billId=${encodeURIComponent(started.billId)}&category=action`, { token: adminA.token });
assert.ok(actionHistory.items.length >= 4 && actionHistory.items.every((event) => event.category === "action"), "action history includes submitted bill changes only");
assert.ok(actionHistory.items.some((event) => event.eventType === "item_added") && actionHistory.items.some((event) => event.eventType === "quantity_changed"), "action history includes adding items and changing quantities");
assert.ok(actionHistory.items.some((event) => event.eventType === "bill_opened"), "action history includes opening a table");
const searchedHistory = await ok(`/api/table-billing/history?billId=${encodeURIComponent(started.billId)}&search=${encodeURIComponent("Bàn 1")}`, { token: adminA.token });
assert.ok(searchedHistory.items.length >= 6, "combined history search still matches the table");
await rejected("/api/table-billing/history", { token: customerA.token }, [403]);
await rejected(`/api/table-billing/history?billId=${encodeURIComponent(started.billId)}`, { token: strangerA.token }, [403]);
await rejected(`/api/table-billing/history?billId=${encodeURIComponent(started.billId)}`, { token: adminB.token }, [403]);
await rejected("/api/collections/table_bill_events/records", { method: "POST", token: adminA.token, body: {} });

const remainingTables = (await ok("/api/table-billing/map", { token: adminA.token })).tables.filter((table) => table.status === "available");
const walletBill = await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "start", tableId: remainingTables[0].id, customerId: customerA.record.id } });
await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "add_item", billId: walletBill.billId, productId: product.id, quantity: 1 } });
await ok("/api/table-billing/action", { method: "POST", token: customerA.token, body: { action: "request_wallet", billId: walletBill.billId } });
const failedPayment = await rejected("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "approve_wallet", billId: walletBill.billId } }, [409]);
assert.equal(failedPayment.data.ok, false);
const walletHistory = await ok(`/api/table-billing/history?billId=${encodeURIComponent(walletBill.billId)}&category=payment`, { token: adminA.token });
assert.ok(walletHistory.items.some((event) => event.eventType === "payment_requested" && event.paymentMethod === "wallet"), "wallet payment request is recorded");
assert.ok(walletHistory.items.some((event) => event.eventType === "payment_failed" && event.paymentMethod === "wallet"), "failed wallet payment is recorded in the payment tab");

const report = await ok("/api/table-billing/report?from=2020-01-01&to=2099-12-31", { token: adminA.token });
assert.equal(report.summary.totalRevenue, 30000, "report totals only the completed payment");
assert.equal(report.summary.paidBills, 1, "report counts each paid bill once");
assert.equal(report.summary.transferAmount, 30000, "report groups transfer revenue");
assert.ok(report.daily.some((day) => day.totalRevenue === 30000 && day.paidBills === 1), "report groups revenue by local day");
const filteredReport = await ok("/api/table-billing/report?from=2020-01-01&to=2099-12-31&paymentMethod=cash", { token: adminA.token });
assert.equal(filteredReport.summary.totalRevenue, 0, "report filters payment method");
await rejected("/api/table-billing/report?from=2020-01-01&to=2099-12-31", { token: customerA.token }, [403]);
await rejected("/api/table-billing/report?from=2020-01-01&to=2099-12-31", { token: adminB.token }, [403]);

console.log("PASS: payment and submitted-action history categories, excluded table opening, search, access scoping, and locked direct writes.");
