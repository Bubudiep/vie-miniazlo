import assert from "node:assert/strict";

const baseUrl = (process.env.PB_TEST_URL || "http://127.0.0.1:9996").replace(/\/$/, "");
const email = process.env.PB_TEST_SUPERUSER_EMAIL;
const password = process.env.PB_TEST_SUPERUSER_PASSWORD;
assert.ok(email && password, "Set PB_TEST_SUPERUSER_EMAIL and PB_TEST_SUPERUSER_PASSWORD for an isolated PocketBase test server.");

async function request(path, { method = "GET", body, token } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(token ? { Authorization: token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await response.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { message: raw }; }
  return { response, data };
}

async function ok(path, options) {
  const result = await request(path, options);
  assert.ok(result.response.ok, `${options?.method || "GET"} ${path} failed (${result.response.status}): ${JSON.stringify(result.data)}`);
  return result.data;
}

async function rejected(path, options) {
  const result = await request(path, options);
  assert.ok([400, 401, 403, 404, 409].includes(result.response.status), `${options?.method || "GET"} ${path} should reject, got ${result.response.status}: ${JSON.stringify(result.data)}`);
  return result;
}

const superAuth = await ok("/api/collections/_superusers/auth-with-password", { method: "POST", body: { identity: email, password } });
const superToken = superAuth.token;
const suffix = `stock${Date.now()}`;
const create = (collection, body) => ok(`/api/collections/${collection}/records`, { method: "POST", token: superToken, body });
const record = (collection, id) => ok(`/api/collections/${collection}/records/${encodeURIComponent(id)}`, { token: superToken });
let phoneIndex = 0;
const makeUser = async (store, username, role = "user") => {
  const userPassword = `Inventory-${username}-2026!`;
  const phone = `09${String(Date.now() + phoneIndex++).slice(-8)}`;
  await create("users", { username, email: `${username}@example.invalid`, phone, password: userPassword, passwordConfirm: userPassword, fullname: username, store, role, is_approved: true, verified: true });
  const auth = await ok("/api/collections/users/auth-with-password", { method: "POST", body: { identity: username, password: userPassword } });
  return { id: auth.record.id, token: auth.token };
};

const store = await create("stores", { name: `Kho thử ${suffix}`, service_type: "service" });
const otherStore = await create("stores", { name: `Kho khác ${suffix}`, service_type: "service" });
const admin = await makeUser(store.id, `admin${suffix}`, "admin");
const customer = await makeUser(store.id, `customer${suffix}`);
const otherAdmin = await makeUser(otherStore.id, `otheradmin${suffix}`, "admin");
await ok("/api/table-billing/action", { method: "POST", token: admin.token, body: { action: "configure_layout", rowCount: 1, tablesPerRow: [5] } });
await ok("/api/table-billing/action", { method: "POST", token: otherAdmin.token, body: { action: "configure_layout", rowCount: 1, tablesPerRow: [1] } });
const tables = (await ok("/api/table-billing/map", { token: admin.token })).tables;
const productA = await create("products", { store: store.id, name: `Nước ${suffix}`, category: "Đồ uống", kind: "drink", price: 1000, purchase_price: 200, billing_unit: "quantity", unit_label: "chai", is_active: true });
const productB = await create("products", { store: store.id, name: `Món ${suffix}`, category: "Đồ ăn", kind: "food", price: 2000, purchase_price: 500, billing_unit: "quantity", unit_label: "phần", is_active: true });
const hourly = await create("products", { store: store.id, name: `Giờ ${suffix}`, category: "Dịch vụ", kind: "service", price: 1, billing_unit: "hour", unit_label: "giờ", is_active: true });

const movement = (token, productId, movementType, quantity, unitCost = 0) => ok("/api/admin/inventory/movement", { method: "POST", token, body: { productId, movementType, quantity, unitCost } });
await movement(admin.token, productA.id, "in", 10, 200);
await movement(admin.token, productB.id, "in", 5, 500);
const initial = await ok("/api/admin/inventory", { token: admin.token });
assert.equal(initial.items.find((item) => item.id === productA.id).onHand, 10, "inventory starts at zero and receipts add real stock");
assert.equal((await ok("/api/admin/inventory", { token: otherAdmin.token })).items.length, 0, "inventory is isolated by store");
await rejected("/api/admin/inventory", { token: customer.token });
await rejected("/api/admin/inventory/movement", { method: "POST", token: otherAdmin.token, body: { productId: productA.id, movementType: "in", quantity: 1 } });
await rejected("/api/collections/inventory_movements/records", { method: "POST", token: admin.token, body: { store: store.id, product: productA.id, movement_type: "in", quantity_delta: 1, occurred_at: new Date().toISOString() } });
await rejected("/api/collections/expenses/records", { method: "POST", token: admin.token, body: { store: store.id, amount: 1, category: "Khác", spent_at: new Date().toISOString() } });

const start = async (tableIndex, customerId = "") => ok("/api/table-billing/action", { method: "POST", token: admin.token, body: { action: "start", tableId: tables[tableIndex].id, ...(customerId ? { customerId } : {}) } });
const add = (billId, productId, quantity) => ok("/api/table-billing/action", { method: "POST", token: admin.token, body: { action: "add_item", billId, productId, quantity } });
const inventory = async (token = admin.token) => ok("/api/admin/inventory", { token });

const transfer = await start(0, customer.id);
const transferLine = await add(transfer.billId, productA.id, 3);
assert.equal((await record("table_bill_items", transferLine.bill.items.find((item) => item.product === productA.id).id)).purchase_price, 200, "bill item snapshots the purchase cost");
assert.equal((await inventory()).items.find((item) => item.id === productA.id).available, 7, "open bill items reserve stock");
const cashHeld = await start(1);
await rejected("/api/table-billing/action", { method: "POST", token: admin.token, body: { action: "add_item", billId: cashHeld.billId, productId: productA.id, quantity: 8 } });
await rejected("/api/table-billing/action", { method: "POST", token: admin.token, body: { action: "update_item", billId: transfer.billId, itemId: transferLine.bill.items.find((item) => item.product === productA.id).id, quantity: 11 } });
const updated = await ok("/api/table-billing/action", { method: "POST", token: admin.token, body: { action: "update_item", billId: transfer.billId, itemId: transferLine.bill.items.find((item) => item.product === productA.id).id, quantity: 4 } });
assert.equal((await inventory()).items.find((item) => item.id === productA.id).available, 6, "updating a bill adjusts its reservation");
await rejected("/api/admin/inventory/movement", { method: "POST", token: admin.token, body: { productId: productA.id, movementType: "adjustment", quantity: -8 } });
await ok("/api/table-billing/action", { method: "POST", token: admin.token, body: { action: "delete_item", billId: cashHeld.billId, itemId: (await add(cashHeld.billId, productA.id, 2)).bill.items.find((item) => item.product === productA.id).id } });
assert.equal((await inventory()).items.find((item) => item.id === productA.id).available, 6, "deleting a line releases its reservation");

await ok("/api/table-billing/action", { method: "POST", token: customer.token, body: { action: "request_transfer", billId: transfer.billId } });
const transferPaid = await ok("/api/table-billing/action", { method: "POST", token: admin.token, body: { action: "pay_manual", billId: transfer.billId, paymentMethod: "transfer", paymentDiscountPercent: 10 } });
assert.equal(transferPaid.bill.totalAmount, 3600);
const cash = cashHeld;
await add(cash.billId, productA.id, 2);
const cashPaid = await ok("/api/table-billing/action", { method: "POST", token: admin.token, body: { action: "pay_manual", billId: cash.billId, paymentMethod: "cash", cashReceived: 2000 } });
assert.equal(cashPaid.bill.status, "paid");
const wallet = await create("wallets", { user: customer.id, store: store.id, main_balance: 0 });
const walletBill = await start(2, customer.id);
await add(walletBill.billId, productA.id, 1);
await add(walletBill.billId, productB.id, 1);
await ok("/api/table-billing/action", { method: "POST", token: customer.token, body: { action: "request_wallet", billId: walletBill.billId } });
await ok(`/api/collections/wallets/records/${wallet.id}`, { method: "PATCH", token: superToken, body: { main_balance: 3000 } });
const walletPaid = await ok("/api/table-billing/action", { method: "POST", token: admin.token, body: { action: "approve_wallet", billId: walletBill.billId, paymentDiscountPercent: 10 } });
assert.equal(walletPaid.bill.totalAmount, 2700);

const hourlyBill = await start(3);
const hourlyAdded = await add(hourlyBill.billId, hourly.id, 1);
const hourlyPaid = await ok("/api/table-billing/action", { method: "POST", token: admin.token, body: { action: "pay_manual", billId: hourlyBill.billId, paymentMethod: "cash", cashReceived: hourlyAdded.bill.totalAmount } });
await rejected("/api/table-billing/action", { method: "POST", token: admin.token, body: { action: "pay_manual", billId: cash.billId, paymentMethod: "cash", cashReceived: 2000 } });

const salesA = await ok(`/api/collections/inventory_movements/records?filter=${encodeURIComponent(`store="${store.id}" && product="${productA.id}" && movement_type="sale"`)}`, { token: superToken });
const salesB = await ok(`/api/collections/inventory_movements/records?filter=${encodeURIComponent(`store="${store.id}" && product="${productB.id}" && movement_type="sale"`)}`, { token: superToken });
assert.equal(salesA.totalItems, 3, "cash, transfer, and wallet each create the expected sale movements");
assert.equal(salesB.totalItems, 1, "mixed-product wallet payment creates one sale per product");
assert.equal(salesA.items.reduce((sum, row) => sum + row.quantity_delta, 0), -7);
assert.equal(salesB.items.reduce((sum, row) => sum + row.quantity_delta, 0), -1);
assert.equal((await ok(`/api/collections/inventory_movements/records?filter=${encodeURIComponent(`store="${store.id}" && product="${hourly.id}" && movement_type="sale"`)}`, { token: superToken })).totalItems, 0, "hourly services do not consume stock");
assert.equal((await record("table_bills", cash.billId)).status, "paid", "successful payment is persisted");
assert.equal((await inventory()).items.find((item) => item.id === productA.id).onHand, 3);
assert.equal((await inventory()).items.find((item) => item.id === productB.id).onHand, 4);

const unpaid = await start(4);
await add(unpaid.billId, productA.id, 1);
const today = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
await ok("/api/admin/expenses", { method: "POST", token: admin.token, body: { amount: 300, category: "Tiện ích", note: "Kiểm thử", spentAt: today } });
await rejected("/api/admin/expenses", { method: "POST", token: customer.token, body: { amount: 100, category: "Khác", spentAt: today } });
const report = await ok(`/api/admin/dashboard?from=${today}&to=${today}`, { token: admin.token });
assert.equal(report.summary.totalRevenue, 8300 + hourlyPaid.bill.totalAmount, "only paid bills contribute actual, discounted revenue");
assert.equal(report.summary.goodsCost, 1900, "cost uses each bill item's purchase-price snapshot");
assert.equal(report.summary.otherExpenses, 300);
assert.equal(report.summary.totalExpenses, 2200);
assert.equal(report.summary.profit, 6100 + hourlyPaid.bill.totalAmount);
assert.equal(report.summary.paidBills, 4);
assert.equal(report.products.find((item) => item.productId === productA.id).revenue, 6500, "paid revenue is allocated proportionally after discounts");
assert.equal(report.products.find((item) => item.productId === productA.id).outputQuantity, 7);
assert.equal(report.products.find((item) => item.productId === productB.id).revenue, 1800);
assert.equal(report.products.find((item) => item.productId === productB.id).profit, 1300);
const otherReport = await ok(`/api/admin/dashboard?from=${today}&to=${today}`, { token: otherAdmin.token });
assert.equal(otherReport.summary.totalRevenue, 0, "dashboard data is isolated by store");

console.log("PASS: store-scoped permissions, reservations, inventory movements, cash/transfer/wallet idempotency, hourly exclusion, expenses and profit allocation.");
