import assert from "node:assert/strict";

const baseUrl = (process.env.PB_TEST_URL || "http://127.0.0.1:9996").replace(/\/$/, "");
const superuserEmail = process.env.PB_TEST_SUPERUSER_EMAIL;
const superuserPassword = process.env.PB_TEST_SUPERUSER_PASSWORD;
assert.ok(superuserEmail && superuserPassword, "Set PB_TEST_SUPERUSER_EMAIL and PB_TEST_SUPERUSER_PASSWORD for an isolated PocketBase test server.");

async function request(path, { method = "GET", body, token } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(token ? { Authorization: token } : {}) },
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

async function rejected(path, options, statuses = [400, 403, 409]) {
  const result = await request(path, options);
  assert.ok(statuses.includes(result.response.status), `${options?.method || "GET"} ${path} should reject, got ${result.response.status}: ${JSON.stringify(result.data)}`);
  return result.data;
}

async function createRecord(token, collection, body) {
  return ok(`/api/collections/${collection}/records`, { method: "POST", token, body });
}

async function record(token, collection, id) {
  return ok(`/api/collections/${collection}/records/${encodeURIComponent(id)}`, { token });
}

async function createUser(superToken, store, username, role = "user") {
  const password = `PaymentTest-${username}-2026!`;
  await createRecord(superToken, "users", {
    username,
    email: `${username}@example.invalid`,
    password,
    passwordConfirm: password,
    fullname: username,
    phone: `09${String(Math.floor(Math.random() * 100000000)).padStart(8, "0")}`,
    store,
    role,
    is_approved: true,
    verified: true,
  });
  const auth = await ok("/api/collections/users/auth-with-password", { method: "POST", body: { identity: username, password } });
  return { id: auth.record.id, token: auth.token };
}

const superAuth = await ok("/api/collections/_superusers/auth-with-password", { method: "POST", body: { identity: superuserEmail, password: superuserPassword } });
const superToken = superAuth.token;
const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const store = await createRecord(superToken, "stores", { name: `Chiết khấu thử ${suffix}`, service_type: "service" });
const admin = await createUser(superToken, store.id, `admin${suffix}`, "admin");
const customer = await createUser(superToken, store.id, `khach${suffix}`);
await ok("/api/table-billing/action", { method: "POST", token: admin.token, body: { action: "configure_layout", rowCount: 1, tablesPerRow: [1] } });
const table = (await ok("/api/table-billing/map", { token: admin.token })).tables[0];
const product = await createRecord(superToken, "products", { store: store.id, name: "Món thử chiết khấu", category: "Món thử", kind: "food", price: 5000, billing_unit: "quantity", unit_label: "phần", is_active: true });
await ok("/api/admin/inventory/movement", { method: "POST", token: admin.token, body: { productId: product.id, movementType: "in", quantity: 100, unitCost: 0, note: "Tồn kiểm thử" } });

const startBill = async (customerId) => ok("/api/table-billing/action", { method: "POST", token: admin.token, body: { action: "start", tableId: table.id, ...(customerId ? { customerId } : {}) } });
const addProduct = async (billId) => ok("/api/table-billing/action", { method: "POST", token: admin.token, body: { action: "add_item", billId, productId: product.id, quantity: 1 } });
const paymentEventDetails = async (billId) => {
  const events = await ok(`/api/collections/table_bill_events/records?filter=${encodeURIComponent(`bill_id="${billId}" && event_type="payment_completed"`)}`, { token: superToken });
  assert.equal(events.totalItems, 1, "one payment-completed event is recorded");
  return JSON.parse(events.items[0].details);
};

const cashStarted = await startBill();
await addProduct(cashStarted.billId);
const cashAction = (cashReceived, paymentDiscountPercent, paymentDiscountNote) => ({ method: "POST", token: admin.token, body: { action: "pay_manual", billId: cashStarted.billId, paymentMethod: "cash", ...(cashReceived === undefined ? {} : { cashReceived }), ...(paymentDiscountPercent === undefined ? {} : { paymentDiscountPercent }), ...(paymentDiscountNote === undefined ? {} : { paymentDiscountNote }) } });
await rejected("/api/table-billing/action", cashAction(undefined));
await rejected("/api/table-billing/action", cashAction("5000", 20));
await rejected("/api/table-billing/action", cashAction(5000, -1));
await rejected("/api/table-billing/action", cashAction(5000, 101));
await rejected("/api/table-billing/action", cashAction(5000, 10.5));
await rejected("/api/table-billing/action", cashAction(4999, 0));
await rejected("/api/table-billing/action", cashAction(3999, 20));
await rejected("/api/table-billing/action", cashAction(5000, 20, "x".repeat(201)));
await rejected("/api/table-billing/action", { method: "POST", token: customer.token, body: { action: "pay_manual", billId: cashStarted.billId, paymentMethod: "cash", cashReceived: 5000, paymentDiscountPercent: 20 } });
await rejected("/api/table-billing/action", { method: "POST", token: admin.token, body: { action: "start", tableId: table.id, paymentDiscountPercent: 10 } });
assert.equal((await record(superToken, "table_bills", cashStarted.billId)).status, "open", "invalid and insufficient payments leave the bill open");
const cashPaid = await ok("/api/table-billing/action", cashAction(5000, 20, "Khách quen"));
assert.equal(cashPaid.bill.totalAmount, 4000);
assert.equal(cashPaid.paymentDiscountAmount, 1000);
assert.equal(cashPaid.change, 1000, "cash change is calculated against the discounted total");
assert.equal(Object.hasOwn(cashPaid, "cashReceived"), false);
assert.equal(Object.hasOwn(await record(superToken, "table_bills", cashStarted.billId), "cash_received"), false);
const cashDetails = await paymentEventDetails(cashStarted.billId);
assert.equal(cashDetails.paymentDiscountPercent, 20);
assert.equal(cashDetails.paymentDiscountAmount, 1000);
assert.equal(cashDetails.paymentDiscountNote, "Khách quen");
assert.equal(Object.hasOwn(cashDetails, "cashReceived"), false, "received cash and change are not stored in history");

const promotion = await createRecord(superToken, "promotions", {
  store: store.id,
  name: "Khuyến mại 10% kiểm thử",
  active: true,
  promotion_type: "percent",
  value: 10,
  min_invoice_amount: 0,
  max_discount: 0,
  auto_apply: true,
  start_at: new Date(Date.now() - 86400000).toISOString(),
  end_at: new Date(Date.now() + 86400000).toISOString(),
  weekdays: JSON.stringify([0, 1, 2, 3, 4, 5, 6]),
  time_start: "",
  time_end: "",
  scope: "invoice",
  target_categories: "[]",
  target_products: "[]",
  audience: "all",
  target_groups: "[]",
  target_cards: "[]",
});
const transferStarted = await startBill(customer.id);
await addProduct(transferStarted.billId);
await ok("/api/table-billing/action", { method: "POST", token: customer.token, body: { action: "request_transfer", billId: transferStarted.billId } });
const transferPaid = await ok("/api/table-billing/action", { method: "POST", token: admin.token, body: { action: "pay_manual", billId: transferStarted.billId, paymentMethod: "transfer", paymentDiscountPercent: 10 } });
assert.equal(transferPaid.grossAmount, 5000);
assert.equal(transferPaid.discountAmount, 500, "existing promotion is applied before the payment discount");
assert.equal(transferPaid.amountBeforePaymentDiscount, 4500);
assert.equal(transferPaid.paymentDiscountAmount, 450);
assert.equal(transferPaid.bill.totalAmount, 4050);
assert.equal(Object.hasOwn(transferPaid, "change"), false);
assert.equal((await paymentEventDetails(transferStarted.billId)).paymentDiscountPercent, 10);

await ok(`/api/collections/promotions/records/${promotion.id}`, { method: "PATCH", token: superToken, body: { active: false } });
const wallet = await createRecord(superToken, "wallets", { user: customer.id, store: store.id, main_balance: 0 });
const walletStarted = await startBill(customer.id);
await addProduct(walletStarted.billId);
await ok("/api/table-billing/action", { method: "POST", token: customer.token, body: { action: "request_wallet", billId: walletStarted.billId } });
const walletFailed = await rejected("/api/table-billing/action", { method: "POST", token: admin.token, body: { action: "approve_wallet", billId: walletStarted.billId, paymentDiscountPercent: 10 } }, [409]);
assert.equal(walletFailed.bill.status, "wallet_pending");
await ok(`/api/collections/wallets/records/${wallet.id}`, { method: "PATCH", token: superToken, body: { main_balance: 4500 } });
const walletPaid = await ok("/api/table-billing/action", { method: "POST", token: admin.token, body: { action: "approve_wallet", billId: walletStarted.billId, paymentDiscountPercent: 10 } });
assert.equal(walletPaid.bill.totalAmount, 4500);
assert.equal(walletPaid.bill.requestedAmount, 5000);
assert.equal(walletPaid.paymentDiscountAmount, 500);
assert.equal(walletPaid.mainUsed, 4500);
assert.equal((await record(superToken, "wallets", wallet.id)).main_balance, 0, "wallet is debited only by the discounted payable amount");
assert.equal((await paymentEventDetails(walletStarted.billId)).paymentDiscountAmount, 500);

const freeStarted = await startBill();
await addProduct(freeStarted.billId);
const freePaid = await ok("/api/table-billing/action", { method: "POST", token: admin.token, body: { action: "pay_manual", billId: freeStarted.billId, paymentMethod: "cash", cashReceived: 0, paymentDiscountPercent: 100 } });
assert.equal(freePaid.bill.totalAmount, 0, "100 percent is accepted as the inclusive discount limit");
assert.equal(freePaid.change, 0);

console.log("PASS: cash, transfer, wallet, stacked promotion, discount bounds, admin authorization, change, and no cash-received history");
