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
const billDetail = async (token, billId) => (await ok("/api/table-billing/action", { method: "POST", token, body: { action: "detail", billId } })).bill;
const updateItemTime = (token, billId, itemId, startedAt, stoppedAt = "") => ok("/api/table-billing/action", { method: "POST", token, body: { action: "update_item_time", billId, itemId, startedAt, stoppedAt } });

async function record(token, collection, id) {
  return ok(`/api/collections/${collection}/records/${encodeURIComponent(id)}`, { token });
}

async function createRecord(token, collection, body) {
  return ok(`/api/collections/${collection}/records`, { method: "POST", token, body });
}

let userIndex = 0;
async function createUser(token, store, username, role = "user") {
  userIndex += 1;
  const password = `TableTest-${username}-2026!`;
  const email = `${username}@example.com`;
  await createRecord(token, "users", {
    username,
    email,
    password,
    passwordConfirm: password,
    fullname: username,
    phone: `09${String(10000000 + userIndex).slice(0, 8)}`,
    store,
    role,
    is_approved: true,
    verified: true,
  });
  const auth = await ok("/api/collections/users/auth-with-password", { method: "POST", body: { identity: username, password } });
  return { id: auth.record.id, token: auth.token, password };
}

const superAuth = await ok("/api/collections/_superusers/auth-with-password", {
  method: "POST",
  body: { identity: superuserEmail, password: superuserPassword },
});
const superToken = superAuth.token;
const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const storeA = await createRecord(superToken, "stores", { name: `Kiểm thử bàn ${suffix}`, service_type: "service" });
const storeB = await createRecord(superToken, "stores", { name: `Cửa hàng khác ${suffix}`, service_type: "service" });
const adminA = await createUser(superToken, storeA.id, `admin${suffix}`, "admin");
const customerA = await createUser(superToken, storeA.id, `khach${suffix}`);
const otherA = await createUser(superToken, storeA.id, `khachkhac${suffix}`);
const adminB = await createUser(superToken, storeB.id, `adminb${suffix}`, "admin");
const customerB = await createUser(superToken, storeB.id, `khachb${suffix}`);

await rejected("/api/table-billing/payment-settings", {}, [401, 403]);
assert.deepEqual(await ok("/api/table-billing/payment-settings", { token: adminA.token }), { bankId: "", accountNumber: "", accountName: "" });
await rejected("/api/table-billing/payment-settings", { method: "PATCH", token: customerA.token, body: { bankId: "vcb", accountNumber: "12345678", accountName: "Khách hàng" } });
await rejected("/api/table-billing/payment-settings", { method: "PATCH", token: adminA.token, body: { bankId: "vcb", accountNumber: "", accountName: "Chủ tài khoản" } });
await rejected("/api/table-billing/payment-settings", { method: "PATCH", token: adminA.token, body: { bankId: "bank không hợp lệ", accountNumber: "12345678", accountName: "Chủ tài khoản" } });
const savedPaymentSettings = await ok("/api/table-billing/payment-settings", {
  method: "PATCH",
  token: adminA.token,
  body: { bankId: "vcb", accountNumber: "12345678", accountName: "Chủ tài khoản", store: storeB.id },
});
assert.deepEqual(savedPaymentSettings, { bankId: "vcb", accountNumber: "12345678", accountName: "Chủ tài khoản" });
assert.deepEqual(await ok("/api/table-billing/payment-settings", { token: customerA.token }), savedPaymentSettings, "the bill QR settings are readable within their store");
assert.deepEqual(await ok("/api/table-billing/payment-settings", { token: adminB.token }), { bankId: "", accountNumber: "", accountName: "" }, "admins cannot read another store's QR settings");
await rejected("/api/collections/bill_payment_settings/records", {
  method: "POST",
  token: adminA.token,
  body: { store: storeA.id, bank_id: "fake", account_number: "11112222", account_name: "Giả mạo" },
});

await rejected("/api/collections/tables/records", { method: "POST", token: customerA.token, body: { store: storeA.id, name: "Bàn giả", status: "available" } });
await rejected("/api/table-billing/action", { method: "POST", token: customerA.token, body: { action: "configure_layout", rowCount: 1, tablesPerRow: [1] } });

await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "configure_layout", rowCount: 2, tablesPerRow: [2, 1] } });
await ok("/api/table-billing/action", { method: "POST", token: adminB.token, body: { action: "configure_layout", rowCount: 1, tablesPerRow: [1] } });
const mapA = await ok("/api/table-billing/map", { token: adminA.token });
const mapUserA = await ok("/api/table-billing/map", { token: customerA.token });
const mapB = await ok("/api/table-billing/map", { token: customerB.token });
const directTablesA = await ok("/api/collections/tables/records", { token: customerA.token });
const directTablesB = await ok("/api/collections/tables/records", { token: customerB.token });
assert.equal(mapA.tables.length, 3, "admin layout creates the configured table count");
assert.equal(mapUserA.tables.length, 3, "same-store user can view the table map");
assert.equal(mapB.tables.length, 1, "table map is isolated by store");
assert.equal(directTablesA.totalItems, 3, "direct table collection reads remain store-scoped");
assert.equal(directTablesB.totalItems, 1, "direct table reads do not expose another store");
const tableA1 = mapA.tables.find((table) => table.row_number === 1 && table.position === 1);
const tableA2 = mapA.tables.find((table) => table.row_number === 1 && table.position === 2);
const tableA3 = mapA.tables.find((table) => table.row_number === 2 && table.position === 1);
const tableB = mapB.tables[0];
assert.ok(tableA1 && tableA2 && tableA3 && tableB);
assert.deepEqual([tableA1.name, tableA2.name, tableA3.name], ["Bàn 1", "Bàn 2", "Bàn 3"], "table maps use sequential names across rows");
assert.deepEqual([tableA1.id, tableA2.id, tableA3.id].map((id) => directTablesA.items.find((table) => table.id === id).name), ["Bàn 1", "Bàn 2", "Bàn 3"], "new table records persist sequential names");
if (process.env.PB_TEST_SKIP_LEGACY_TABLE_NAME_WRITE !== "1") {
  await ok(`/api/collections/tables/records/${tableA1.id}`, { method: "PATCH", token: superToken, body: { name: "Bàn 1-1" } });
  const legacyMap = await ok("/api/table-billing/map", { token: customerA.token });
  assert.equal(legacyMap.tables.find((table) => table.id === tableA1.id).name, "Bàn 1", "table map hides legacy row-position names");
}
await rejected(`/api/collections/tables/records/${tableA1.id}`, { method: "PATCH", token: adminA.token, body: { status: "occupied" } });
await rejected("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "start", tableId: tableB.id, customerId: customerB.id } });
await rejected("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "set_table_status", tableId: tableA3.id, status: "cleaning" } });
await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "set_table_status", tableId: tableA3.id, status: "reserved" } });
assert.equal((await ok("/api/table-billing/map", { token: adminA.token })).tables.find((table) => table.id === tableA3.id).status, "reserved");
await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "set_table_status", tableId: tableA3.id, status: "available" } });

const categoryA = await createRecord(adminA.token, "product_categories", { store: storeA.id, name: `Đồ uống ${suffix}` });
await rejected("/api/collections/product_categories/records", { method: "POST", token: customerA.token, body: { store: storeA.id, name: `Danh mục giả ${suffix}` } });
await rejected("/api/collections/product_categories/records", { method: "POST", token: adminB.token, body: { store: storeA.id, name: `Danh mục sai cửa hàng ${suffix}` } });
await rejected("/api/collections/product_categories/records", { method: "POST", token: adminA.token, body: { store: storeA.id, name: categoryA.name } });

const productQty = await createRecord(superToken, "products", { store: storeA.id, name: "Nước chai", category: "Đồ uống", kind: "drink", price: 10000, purchase_price: 7000, billing_unit: "quantity", unit_label: "chai", is_active: true });
const imageForm = new FormData();
imageForm.append("image", new Blob([Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64")], { type: "image/png" }), "nuoc.png");
const imageUploadResponse = await fetch(`${baseUrl}/api/collections/products/records/${productQty.id}`, {
  method: "PATCH",
  headers: { Authorization: adminA.token },
  body: imageForm,
});
const productWithImage = await imageUploadResponse.json();
assert.ok(imageUploadResponse.ok, `product image upload failed (${imageUploadResponse.status}): ${JSON.stringify(productWithImage)}`);
assert.ok(productWithImage.image, "product image filename is saved");
const publicProductImage = await fetch(`${baseUrl}/api/files/products/${productQty.id}/${encodeURIComponent(productWithImage.image)}`);
assert.equal(publicProductImage.status, 200, "product image is publicly accessible without exposing product record data");
const productWeight = await createRecord(superToken, "products", { store: storeA.id, name: "Hạt cân", category: "Đồ ăn", kind: "food", price: 20000, billing_unit: "weight", unit_label: "kg", is_active: true });
const productHour = await createRecord(superToken, "products", { store: storeA.id, name: "Giờ chơi", category: "Dịch vụ", kind: "food", price: 60000, billing_unit: "hour", unit_label: "giờ", is_active: true });
const productFirstPeriod = await createRecord(adminA.token, "products", { store: storeA.id, name: "Phòng theo thời gian", category: "Dịch vụ", kind: "food", price: 12000, billing_unit: "hour", unit_label: "giờ", time_pricing: { intervalMinutes: 30, firstPeriod: { price: 4000, durationMinutes: 15 }, specialPeriod: null }, is_active: true });
const productSpecialPeriod = await createRecord(adminA.token, "products", { store: storeA.id, name: "Giờ đặc biệt", category: "Dịch vụ", kind: "food", price: 60000, billing_unit: "hour", unit_label: "giờ", time_pricing: { intervalMinutes: 60, firstPeriod: null, specialPeriod: { name: "Giờ trưa", price: 120000, durationMinutes: 30, allDay: false, startTime: "10:00", endTime: "11:00", weekdays: [1] } }, is_active: true });
const productMixedTime = await createRecord(adminA.token, "products", { store: storeA.id, name: "Giờ nhiều mức", category: "Dịch vụ", kind: "food", price: 1000, billing_unit: "hour", unit_label: "giờ", time_pricing: { intervalMinutes: 3, firstPeriod: { price: 20000, durationMinutes: 30 }, specialPeriod: { name: "Lễ 1", price: 30000, durationMinutes: 30, allDay: false, startTime: "09:00", endTime: "10:00", weekdays: [2] } }, is_active: true });
const productSnack = await createRecord(superToken, "products", { store: storeA.id, name: "Món thử xóa", category: "Đồ ăn", kind: "food", price: 5000, billing_unit: "quantity", unit_label: "phần", is_active: true });
for (const product of [productQty, productWeight, productSnack]) {
  await ok("/api/admin/inventory/movement", { method: "POST", token: adminA.token, body: { productId: product.id, movementType: "in", quantity: 1000, unitCost: product.purchase_price || 0, note: "Tồn kiểm thử" } });
}
await rejected(`/api/collections/products/records`, { method: "POST", token: customerA.token, body: { store: storeA.id, name: "Mặt hàng giả", price: 1, is_active: true } });
await rejected(`/api/collections/products/records/${productQty.id}`, { method: "PATCH", token: customerA.token, body: { price: 1 } });
await rejected(`/api/collections/products/records/${productQty.id}`, { method: "DELETE", token: customerA.token });
const customerProducts = await ok(`/api/collections/products/records?filter=${encodeURIComponent(`store="${storeA.id}"`)}`, { token: customerA.token });
assert.equal(customerProducts.totalItems, 0, "customers cannot read product records or purchase prices directly");
const adminProducts = await ok(`/api/collections/products/records/${productQty.id}`, { token: adminA.token });
assert.equal(adminProducts.purchase_price, 7000, "store admin can read purchase price");
await rejected(`/api/collections/products/records`, { method: "POST", token: adminA.token, body: { store: storeB.id, name: "Sai cửa hàng", price: 1, is_active: true } });
await rejected(`/api/collections/products/records/${productQty.id}`, { method: "PATCH", token: adminB.token, body: { price: 1 } });
const catalog = await ok("/api/table-billing/products", { token: customerA.token });
assert.equal(catalog.items.length, 7);
assert.equal(catalog.items.find((item) => item.id === productFirstPeriod.id).timePricing.intervalMinutes, 30);
assert.equal(catalog.items.find((item) => item.id === productQty.id).image, productWithImage.image, "customer catalog exposes the product image filename");
assert.equal(Object.hasOwn(catalog.items.find((item) => item.id === productQty.id), "purchase_price"), false, "customer product endpoint does not expose purchase price");

const started = await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "start", tableId: tableA1.id, customerId: customerA.id } });
const billId = started.billId;
assert.equal((await record(superToken, "table_bills", billId)).table_name, "Bàn 1", "new bills save the sequential table number");
if (process.env.PB_TEST_SKIP_LEGACY_TABLE_NAME_WRITE !== "1") {
  await ok(`/api/collections/table_bills/records/${billId}`, { method: "PATCH", token: superToken, body: { table_name: "Bàn 1-1" } });
}
const startedBill = await billDetail(adminA.token, billId);
assert.equal(startedBill.tableName, "Bàn 1", "bill details use the sequential table number instead of row-position names");
assert.ok(Date.parse(startedBill.startedAt), "table usage start time is persisted when the table is opened");
const startedMap = await ok("/api/table-billing/map", { token: adminA.token });
assert.equal(startedMap.tables.find((table) => table.id === tableA1.id).playingSince, startedBill.startedAt, "the table map exposes its persisted start time immediately");
await rejected("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "start", tableId: tableA1.id } });
await rejected("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "delete_table", tableId: tableA1.id, password: adminA.password } });
await rejected("/api/table-billing/action", { method: "POST", token: otherA.token, body: { action: "request_wallet", billId } });
await rejected("/api/table-billing/action", { method: "POST", token: otherA.token, body: { action: "detail", billId } });
await rejected("/api/table-billing/action", { method: "POST", token: customerB.token, body: { action: "detail", billId } });
await rejected(`/api/collections/table_bills/records/${billId}`, { token: otherA.token });
await rejected(`/api/collections/table_bills/records/${billId}`, { token: customerB.token });
const mine = await ok("/api/table-billing/my-open", { token: customerA.token });
assert.equal(mine.items[0].id, billId);
assert.equal(mine.items[0].tableName, "Bàn 1", "the customer's open-bill list uses the same sequential table number");
assert.equal(mapA.activeBills.length, 0, "map was loaded before the bill started");

let itemResult = await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "add_item", billId, productId: productQty.id, quantity: 3, price: 1, totalAmount: 1 } });
let qtyItem = itemResult.bill.items.find((item) => item.product === productQty.id);
assert.equal(qtyItem.unitPrice, 10000, "client-sent fake price is ignored");
assert.equal(qtyItem.lineTotal, 30000);
assert.equal(itemResult.bill.startedAt, startedBill.startedAt, "adding the first product does not change the table usage start time");
const playingMap = await ok("/api/table-billing/map", { token: customerA.token });
assert.equal(playingMap.tables.find((table) => table.id === tableA1.id).playingSince, startedBill.startedAt, "a same-store customer sees the persisted table usage start time");
itemResult = await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "add_item", billId, productId: productWeight.id, quantity: 1.25 } });
let weightItem = itemResult.bill.items.find((item) => item.product === productWeight.id);
assert.equal(weightItem.lineTotal, 25000, "weight accepts decimal quantities");
itemResult = await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "add_item", billId, productId: productHour.id, quantity: 999 } });
const hourItem = itemResult.bill.items.find((item) => item.product === productHour.id);
assert.ok(hourItem.startedAt, "hour billing starts on the server when added");
assert.ok(hourItem.lineTotal >= 1000, "hour billing begins from the server timestamp");
assert.ok(hourItem.timeBreakdown.length > 0, "action response includes the time-price breakdown");
assert.equal(hourItem.timeBreakdown.reduce((sum, segment) => sum + segment.amount, 0), hourItem.lineTotal, "breakdown amounts equal the hourly line total");
assert.equal(hourItem.stoppedAt, "", "an active hourly item has no stop time");
const adjustedStart = new Date(Date.now() - 20 * 60000).toISOString();
const adjustedHour = await updateItemTime(adminA.token, billId, hourItem.id, adjustedStart);
assert.equal(Date.parse(adjustedHour.bill.items.find((item) => item.id === hourItem.id).startedAt), Date.parse(adjustedStart), "admin can update an hourly start time");
const endedAt = new Date(Date.now() - 1000).toISOString();
const stoppedHour = await updateItemTime(adminA.token, billId, hourItem.id, adjustedStart, endedAt);
assert.equal(Date.parse(stoppedHour.bill.items.find((item) => item.id === hourItem.id).stoppedAt), Date.parse(endedAt), "admin can update an hourly end time");
const resumedHour = await updateItemTime(adminA.token, billId, hourItem.id, adjustedStart);
assert.equal(resumedHour.bill.items.find((item) => item.id === hourItem.id).stoppedAt, "", "clearing the end time resumes hourly billing");
const timeHistory = await ok(`/api/table-billing/history?billId=${encodeURIComponent(billId)}&category=action`, { token: adminA.token });
assert.ok(timeHistory.items.some((event) => event.eventType === "item_time_changed"), "hourly time edits are recorded in bill history");
await rejected("/api/table-billing/action", { method: "POST", token: customerA.token, body: { action: "update_item_time", billId, itemId: hourItem.id, startedAt: adjustedStart, stoppedAt: "" } });
await rejected("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "update_item_time", billId, itemId: hourItem.id, startedAt: adjustedStart, stoppedAt: new Date(Date.now() - 30 * 60000).toISOString() } });
await rejected("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "add_item", billId, productId: productFirstPeriod.id } }, [400]);
await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "delete_item", billId, itemId: hourItem.id } });
itemResult = await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "add_item", billId, productId: productFirstPeriod.id } });
const firstPeriodItem = itemResult.bill.items.find((item) => item.product === productFirstPeriod.id);
const firstPeriodStart = Date.parse("2026-10-20T10:00:00+07:00");
await updateItemTime(adminA.token, billId, firstPeriodItem.id, new Date(firstPeriodStart).toISOString(), new Date(firstPeriodStart + 20 * 60000).toISOString());
const firstPeriodBill = await billDetail(adminA.token, billId);
const firstPeriodDetail = firstPeriodBill.items.find((item) => item.id === firstPeriodItem.id);
assert.equal(firstPeriodDetail.lineTotal, 16000, "first-period and ordinary rates round each configured block");
assert.deepEqual(firstPeriodDetail.timeBreakdown.map(({ type, startAt, endAt, durationMinutes, billedDurationMinutes, amount }) => ({ type, startAt, endAt, durationMinutes, billedDurationMinutes, amount })), [
  { type: "first", startAt: new Date(firstPeriodStart).toISOString(), endAt: new Date(firstPeriodStart + 15 * 60000).toISOString(), durationMinutes: 15, billedDurationMinutes: 15, amount: 4000 },
  { type: "regular", startAt: new Date(firstPeriodStart + 15 * 60000).toISOString(), endAt: new Date(firstPeriodStart + 20 * 60000).toISOString(), durationMinutes: 5, billedDurationMinutes: 30, amount: 12000 },
], "bill detail returns the exact time range and amount for the first and regular periods");
assert.equal(firstPeriodDetail.timeBreakdown.reduce((sum, segment) => sum + segment.amount, 0), firstPeriodDetail.lineTotal);
await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "delete_item", billId, itemId: firstPeriodItem.id } });
itemResult = await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "add_item", billId, productId: productSpecialPeriod.id } });
const specialPeriodItem = itemResult.bill.items.find((item) => item.product === productSpecialPeriod.id);
const specialPeriodStart = Date.parse("2026-10-19T10:30:00+07:00");
await updateItemTime(adminA.token, billId, specialPeriodItem.id, new Date(specialPeriodStart).toISOString(), new Date(specialPeriodStart + 20 * 60000).toISOString());
const specialPeriodBill = await billDetail(adminA.token, billId);
const specialPeriodDetail = specialPeriodBill.items.find((item) => item.id === specialPeriodItem.id);
assert.equal(specialPeriodDetail.lineTotal, 120000, "weekday special pricing rounds its configured block");
assert.deepEqual(specialPeriodDetail.timeBreakdown, [{ type: "special", label: "Giờ trưa", startAt: new Date(specialPeriodStart).toISOString(), endAt: new Date(specialPeriodStart + 20 * 60000).toISOString(), durationMinutes: 20, billedDurationMinutes: 30, amount: 120000 }]);
await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "delete_item", billId, itemId: specialPeriodItem.id } });
itemResult = await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "add_item", billId, productId: productMixedTime.id } });
const mixedTimeItem = itemResult.bill.items.find((item) => item.product === productMixedTime.id);
const mixedTimeStart = Date.parse("2026-10-20T08:00:00+07:00");
await updateItemTime(adminA.token, billId, mixedTimeItem.id, new Date(mixedTimeStart).toISOString(), new Date(mixedTimeStart + 270 * 60000).toISOString());
const mixedTimeBill = await billDetail(adminA.token, billId);
const mixedTimeDetail = mixedTimeBill.items.find((item) => item.id === mixedTimeItem.id);
assert.equal(mixedTimeDetail.lineTotal, 140000, "first, special and regular pricing follow the configured priority and interval rounding");
assert.deepEqual(mixedTimeDetail.timeBreakdown, [
  { type: "first", label: "Giờ đầu", startAt: new Date(mixedTimeStart).toISOString(), endAt: new Date(mixedTimeStart + 30 * 60000).toISOString(), durationMinutes: 30, billedDurationMinutes: 30, amount: 20000 },
  { type: "regular", label: "Giờ thường", startAt: new Date(mixedTimeStart + 30 * 60000).toISOString(), endAt: new Date(mixedTimeStart + 60 * 60000).toISOString(), durationMinutes: 30, billedDurationMinutes: 30, amount: 10000 },
  { type: "special", label: "Lễ 1", startAt: new Date(mixedTimeStart + 60 * 60000).toISOString(), endAt: new Date(mixedTimeStart + 120 * 60000).toISOString(), durationMinutes: 60, billedDurationMinutes: 60, amount: 60000 },
  { type: "regular", label: "Giờ thường", startAt: new Date(mixedTimeStart + 120 * 60000).toISOString(), endAt: new Date(mixedTimeStart + 270 * 60000).toISOString(), durationMinutes: 150, billedDurationMinutes: 150, amount: 50000 },
]);
await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "delete_item", billId, itemId: mixedTimeItem.id } });
itemResult = await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "add_item", billId, productId: productMixedTime.id } });
const shortFirstItem = itemResult.bill.items.filter((item) => item.product === productMixedTime.id).at(-1);
const shortFirstStart = Date.parse("2026-10-21T08:00:00+07:00");
await updateItemTime(adminA.token, billId, shortFirstItem.id, new Date(shortFirstStart).toISOString(), new Date(shortFirstStart + 20 * 60000).toISOString());
const shortFirstBill = await billDetail(adminA.token, billId);
const shortFirstDetail = shortFirstBill.items.find((item) => item.id === shortFirstItem.id);
assert.equal(shortFirstDetail.lineTotal, 20000, "using less than the configured first period still charges its fixed price");
assert.equal(shortFirstDetail.timeBreakdown[0].billedDurationMinutes, 30);
await updateItemTime(adminA.token, billId, shortFirstItem.id, new Date(shortFirstStart).toISOString(), new Date(shortFirstStart + 31 * 60000).toISOString());
const firstRemainderBill = await billDetail(adminA.token, billId);
const firstRemainderDetail = firstRemainderBill.items.find((item) => item.id === shortFirstItem.id);
assert.equal(firstRemainderDetail.lineTotal, 21000, "time beyond the first period is billed as a rounded regular block");
assert.deepEqual(firstRemainderDetail.timeBreakdown.map((segment) => [segment.type, segment.durationMinutes, segment.billedDurationMinutes, segment.amount]), [["first", 30, 30, 20000], ["regular", 1, 3, 1000]]);
await rejected("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "add_item", billId, productId: productQty.id, quantity: 1.2 } });
const customerAddedItem = await ok("/api/table-billing/action", { method: "POST", token: customerA.token, body: { action: "add_item", billId, productId: productQty.id, quantity: 1 } });
assert.ok(customerAddedItem.bill.items.some((item) => item.product === productQty.id && item.quantity === 1), "the customer assigned to a bill can add menu items");
await rejected("/api/table-billing/action", { method: "POST", token: otherA.token, body: { action: "add_item", billId, productId: productQty.id, quantity: 1 } });
await rejected(`/api/collections/table_bill_items/records/${qtyItem.id}`, { method: "PATCH", token: customerA.token, body: { quantity: 999, unit_price: 1 } });

itemResult = await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "update_item", billId, itemId: qtyItem.id, quantity: 4, unit_price: 1, totalAmount: 1 } });
qtyItem = itemResult.bill.items.find((item) => item.id === qtyItem.id);
assert.equal(qtyItem.unitPrice, 10000);
assert.equal(qtyItem.lineTotal, 40000);
itemResult = await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "update_item", billId, itemId: weightItem.id, quantity: 1.5 } });
weightItem = itemResult.bill.items.find((item) => item.id === weightItem.id);
assert.equal(weightItem.lineTotal, 30000);
itemResult = await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "add_item", billId, productId: productSnack.id, quantity: 1 } });
const snackItem = itemResult.bill.items.find((item) => item.product === productSnack.id);
itemResult = await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "delete_item", billId, itemId: snackItem.id } });
assert.ok(!itemResult.bill.items.some((item) => item.id === snackItem.id));

const wallet = await createRecord(superToken, "wallets", { user: customerA.id, store: storeA.id, main_balance: 0 });
await rejected("/api/collections/wallets/records/" + encodeURIComponent(wallet.id), { method: "PATCH", token: customerA.token, body: { main_balance: 1000000 } });
const requested = await ok("/api/table-billing/action", { method: "POST", token: customerA.token, body: { action: "request_wallet", billId } });
assert.equal(requested.bill.status, "wallet_pending");
const walletNotifications = await ok("/api/admin/notifications", { token: adminA.token });
assert.ok(walletNotifications.items.some((item) => item.referenceId === billId && item.type === "table_bill_wallet"), "wallet request notifies admins in the same store");
assert.deepEqual(await ok("/api/admin/notifications", { token: adminB.token }), { items: [] }, "admins in another store cannot see payment notifications");
await rejected("/api/admin/notifications", { token: customerA.token }, [403]);
const failedApproval = await rejected("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "approve_wallet", billId } });
assert.equal(failedApproval.data.ok, false, "insufficient funds return a failed payment without closing the bill");
assert.equal(failedApproval.data.bill.status, "wallet_pending");
const occupiedAfterFailure = (await ok("/api/table-billing/map", { token: adminA.token })).tables.find((table) => table.id === tableA1.id);
assert.equal(occupiedAfterFailure.status, "occupied");

const requestedAmount = failedApproval.data.bill.totalAmount;
await ok(`/api/collections/wallets/records/${encodeURIComponent(wallet.id)}`, { method: "PATCH", token: superToken, body: { main_balance: requestedAmount + 20000 } });
const promo = await createRecord(superToken, "wallet_promo_lots", { wallet: wallet.id, user: customerA.id, store: storeA.id, original_amount: 5000, remaining_amount: 5000, expires_at: new Date(Date.now() + 86400000).toISOString(), status: "active" });
await rejected("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "approve_wallet", billId, paymentDiscountPercent: 101 } });
await rejected("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "approve_wallet", billId, paymentDiscountPercent: 10.5 } });
const walletDiscount = Math.round(requestedAmount * 10 / 100);
const paid = await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "approve_wallet", billId, paymentDiscountPercent: 10 } });
assert.equal(paid.bill.status, "paid");
assert.equal(paid.bill.paymentMethod, "wallet");
assert.equal(paid.bill.totalAmount, requestedAmount - walletDiscount, "wallet debit uses the total after payment discount");
assert.equal(paid.bill.requestedAmount, requestedAmount, "original requested amount remains without a schema change");
assert.equal(paid.paymentDiscountPercent, 10);
assert.equal(paid.paymentDiscountAmount, walletDiscount);
assert.equal(paid.promoUsed, Math.min(requestedAmount - walletDiscount, 5000), "promo is consumed before the main wallet balance");
assert.equal(paid.promoUsed + paid.mainUsed, paid.bill.totalAmount, "wallet balances cover the payable total");
assert.equal((await record(superToken, "wallet_promo_lots", promo.id)).remaining_amount, 0);
assert.equal((await ok("/api/table-billing/map", { token: adminA.token })).tables.find((table) => table.id === tableA1.id).status, "available");
const balanceAfter = (await record(superToken, "wallets", wallet.id)).main_balance;
const txBeforeRepeat = await ok(`/api/collections/wallet_transactions/records?filter=${encodeURIComponent(`reference_type="table_bill" && reference_id="${billId}"`)}`, { token: superToken });
assert.ok(txBeforeRepeat.items.every((transaction) => transaction.reason === "Thanh toán hóa đơn bàn Bàn 1"), "wallet history uses the sequential table name");
const repeat = await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "approve_wallet", billId } });
assert.equal(repeat.alreadyPaid, true);
assert.equal((await record(superToken, "wallets", wallet.id)).main_balance, balanceAfter, "repeat approval does not debit twice");
const txAfterRepeat = await ok(`/api/collections/wallet_transactions/records?filter=${encodeURIComponent(`reference_type="table_bill" && reference_id="${billId}"`)}`, { token: superToken });
assert.equal(txAfterRepeat.totalItems, txBeforeRepeat.totalItems);

const hourlyMergeTarget = await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "start", tableId: tableA1.id } });
await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "add_item", billId: hourlyMergeTarget.billId, productId: productHour.id } });
const hourlyMergeSource = await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "start", tableId: tableA2.id } });
await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "add_item", billId: hourlyMergeSource.billId, productId: productHour.id } });
await rejected("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "merge_bills", billId: hourlyMergeSource.billId, targetBillId: hourlyMergeTarget.billId } });
await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "pay_manual", billId: hourlyMergeTarget.billId, paymentMethod: "cash", cashReceived: 1000000000000 } });
await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "pay_manual", billId: hourlyMergeSource.billId, paymentMethod: "cash", cashReceived: 1000000000000 } });

const moveStarted = await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "start", tableId: tableA2.id, customerId: customerA.id } });
const moveStartedAt = (await record(superToken, "table_bills", moveStarted.billId)).started_at;
const moveWithItem = await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "add_item", billId: moveStarted.billId, productId: productHour.id } });
const moveItem = moveWithItem.bill.items.find((item) => item.product === productHour.id);
await rejected("/api/table-billing/action", { method: "POST", token: customerA.token, body: { action: "transfer_table", billId: moveStarted.billId, targetTableId: tableA3.id } });
await rejected("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "transfer_table", billId: moveStarted.billId, targetTableId: tableB.id } });
const occupiedDestination = await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "start", tableId: tableA3.id } });
await rejected("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "transfer_table", billId: moveStarted.billId, targetTableId: tableA3.id } });
const moved = await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "transfer_table", billId: moveStarted.billId, targetTableId: tableA1.id } });
assert.equal(moved.bill.table, tableA1.id);
assert.equal(moved.bill.tableName, "Bàn 1");
assert.equal(Date.parse(moved.bill.startedAt), Date.parse(moveStartedAt), "moving a bill preserves its table usage start time");
assert.equal(Date.parse(moved.bill.items.find((item) => item.id === moveItem.id).startedAt), Date.parse(moveItem.startedAt), "moving a bill preserves active hourly item timing");
const movedTableMap = await ok("/api/table-billing/map", { token: adminA.token });
assert.equal(movedTableMap.tables.find((table) => table.id === tableA2.id).status, "available");
assert.equal(movedTableMap.tables.find((table) => table.id === tableA1.id).status, "occupied");
assert.equal(Date.parse(movedTableMap.tables.find((table) => table.id === tableA1.id).playingSince), Date.parse(moveStartedAt));
assert.equal((await record(superToken, "table_bills", moveStarted.billId)).table_name, "Bàn 1", "the moved bill persists its destination table name");
await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "pay_manual", billId: moveStarted.billId, paymentMethod: "cash", cashReceived: 1000000000000 } });
await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "pay_manual", billId: occupiedDestination.billId, paymentMethod: "cash", cashReceived: 1000000000000 } });

const legacyOrder = await ok("/api/orders", { method: "POST", token: adminA.token, body: { userId: customerA.id, totalAmount: 1000, idempotencyKey: `legacy-${suffix}` } });
const legacyPaid = await ok("/api/wallet/pay", { method: "POST", token: customerA.token, body: { orderId: legacyOrder.id, idempotencyKey: `legacy-pay-${suffix}` } });
assert.equal(legacyPaid.alreadyPaid, false);
const legacyRepeat = await ok("/api/wallet/pay", { method: "POST", token: customerA.token, body: { orderId: legacyOrder.id, idempotencyKey: `legacy-pay-${suffix}` } });
assert.equal(legacyRepeat.alreadyPaid, true, "existing wallet order payment remains independent and idempotent");
assert.equal((await ok(`/api/orders/detail?orderId=${encodeURIComponent(legacyOrder.id)}`, { token: customerA.token })).status, "paid");

const renumberStarted = await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "start", tableId: tableA3.id, customerId: customerA.id } });
await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "configure_layout", rowCount: 2, tablesPerRow: [3, 1] } });
const renumberedBill = await billDetail(adminA.token, renumberStarted.billId);
assert.equal(renumberedBill.tableName, "Bàn 4", "an open bill follows its table's new sequential number when the layout grows");
assert.equal((await record(superToken, "table_bills", renumberStarted.billId)).table_name, "Bàn 4", "layout changes update the persisted name of open bills");
await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "pay_manual", billId: renumberStarted.billId, paymentMethod: "cash", cashReceived: 1000000000000 } });

const cashStarted = await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "start", tableId: tableA2.id } });
const cashWithItem = await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "add_item", billId: cashStarted.billId, productId: productSnack.id, quantity: 1 } });
const cashDue = cashWithItem.bill.totalAmount;
assert.equal(cashDue, 5000);
const cashAction = (cashReceived, paymentDiscountPercent) => ({ method: "POST", token: adminA.token, body: { action: "pay_manual", billId: cashStarted.billId, paymentMethod: "cash", ...(paymentDiscountPercent === undefined ? {} : { paymentDiscountPercent }), ...(cashReceived === undefined ? {} : { cashReceived }) } });
await rejected("/api/table-billing/action", cashAction(undefined));
await rejected("/api/table-billing/action", cashAction(-1));
await rejected("/api/table-billing/action", cashAction("5000"));
await rejected("/api/table-billing/action", cashAction(cashDue - 1));
await rejected("/api/table-billing/action", { ...cashAction(cashDue), body: { ...cashAction(cashDue).body, discountPercent: 10 } });
await rejected("/api/table-billing/action", cashAction(cashDue, -1));
await rejected("/api/table-billing/action", cashAction(cashDue, 101));
await rejected("/api/table-billing/action", cashAction(cashDue - 1001, 20));
assert.equal((await record(superToken, "table_bills", cashStarted.billId)).status, "open", "insufficient cash leaves the bill open");
const cashPaid = await ok("/api/table-billing/action", cashAction(cashDue, 20));
assert.equal(cashPaid.bill.status, "paid");
assert.equal(cashPaid.bill.paymentMethod, "cash");
assert.equal(cashPaid.bill.totalAmount, 4000);
assert.equal(cashPaid.grossAmount, cashDue);
assert.equal(cashPaid.paymentDiscountPercent, 20);
assert.equal(cashPaid.paymentDiscountAmount, 1000);
assert.equal(cashPaid.change, 1000, "cash change uses the server-calculated total after payment discount");
assert.equal(Object.hasOwn(cashPaid, "cashReceived"), false, "cash received is not returned or persisted");
assert.equal(Object.hasOwn(await record(superToken, "table_bills", cashStarted.billId), "cash_received"), false, "cash received is not persisted on the bill");
const cashEvents = await ok(`/api/collections/table_bill_events/records?filter=${encodeURIComponent(`bill_id="${cashStarted.billId}" && event_type="payment_completed"`)}`, { token: superToken });
assert.equal(JSON.parse(cashEvents.items[0].details).paymentDiscountAmount, 1000, "payment discount is audited in the existing bill event details");
assert.equal((await ok("/api/table-billing/map", { token: adminA.token })).tables.find((table) => table.id === tableA2.id).status, "available");

const transferStarted = await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "start", tableId: tableA3.id, customerId: customerA.id } });
await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "add_item", billId: transferStarted.billId, productId: productSnack.id, quantity: 1 } });
const transferRequested = await ok("/api/table-billing/action", { method: "POST", token: customerA.token, body: { action: "request_transfer", billId: transferStarted.billId } });
assert.equal(transferRequested.bill.status, "wallet_pending");
assert.equal(transferRequested.bill.paymentMethod, "transfer");
await rejected("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "approve_wallet", billId: transferStarted.billId } });
const transferNotifications = await ok("/api/admin/notifications", { token: adminA.token });
const transferNotification = transferNotifications.items.find((item) => item.referenceId === transferStarted.billId && item.type === "table_bill_transfer");
assert.ok(transferNotification, "transfer request notifies store admins");
const transferPaid = await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "pay_manual", billId: transferStarted.billId, paymentMethod: "transfer", paymentDiscountPercent: 20 } });
assert.equal(transferPaid.bill.paymentMethod, "transfer");
assert.equal(transferPaid.bill.totalAmount, 4000);
assert.equal(transferPaid.grossAmount, 5000);
assert.equal(transferPaid.paymentDiscountAmount, 1000);
assert.equal(Object.hasOwn(transferPaid, "change"), false, "transfer payment response has no cash change");
assert.equal(transferPaid.bill.tableName, "Bàn 4", "bill actions number tables sequentially across rows after the layout grows");
await ok("/api/admin/notifications/read", { method: "PATCH", token: adminA.token, body: { id: transferNotification.id } });
assert.equal((await ok("/api/admin/notifications", { token: adminA.token })).items.some((item) => item.id === transferNotification.id), false, "admins can mark their own notification as read");

const sessionStarted = await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "start", tableId: tableA3.id, customerId: customerA.id } });
const sessionFirstItem = (await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "add_item", billId: sessionStarted.billId, productId: productHour.id } })).bill.items[0];
await updateItemTime(adminA.token, sessionStarted.billId, sessionFirstItem.id, new Date(Date.now() - 30 * 60000).toISOString());
await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "add_item", billId: sessionStarted.billId, productId: productSnack.id, quantity: 1 } });
const sessionPromotionInput = { name: `Ưu đãi phiên ${suffix}`, active: true, promotionType: "percent", value: 10, minInvoiceAmount: 0, maxDiscount: 0, autoApply: false, startAt: new Date(Date.now() - 86400000).toISOString(), endAt: new Date(Date.now() + 86400000).toISOString(), weekdays: [0, 1, 2, 3, 4, 5, 6], timeStart: "", timeEnd: "", scope: "invoice", targetCategories: [], targetProducts: [], audience: "all", targetGroups: [], targetCards: [] };
const sessionPromotion = await ok("/api/admin/promotions", { method: "POST", token: adminA.token, body: sessionPromotionInput });
const sessionPromoBill = await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "apply_promotion", billId: sessionStarted.billId, promotionId: sessionPromotion.id } });
const sessionDiscountBeforeSplit = sessionPromoBill.bill.discountAmount;
await rejected("/api/table-billing/action", { method: "POST", token: customerA.token, body: { action: "split_session", billId: sessionStarted.billId, keepCustomer: true } });
await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "toggle_pause", billId: sessionStarted.billId } });
const sessionSplit1 = await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "split_session", billId: sessionStarted.billId, keepCustomer: true } });
assert.equal(sessionSplit1.stoppedBill.status, "stopped");
assert.equal(sessionSplit1.stoppedBill.billingPaused, false, "splitting closes the current pause interval");
assert.equal(sessionSplit1.stoppedBill.discountAmount, sessionDiscountBeforeSplit, "the stopped bill keeps its promotion discount");
assert.equal(sessionSplit1.stoppedBill.promotion.name, sessionPromotion.name);
assert.equal(sessionSplit1.bill.customer, customerA.id, "the next session bill can keep its customer");
assert.equal(sessionSplit1.bill.items.length, 0, "a split starts with an empty bill");
await ok("/api/admin/promotions", { method: "POST", token: adminA.token, body: { id: sessionPromotion.id, ...sessionPromotionInput, name: `Đã sửa ${suffix}`, value: 90 } });
await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "add_item", billId: sessionSplit1.bill.id, productId: productSnack.id, quantity: 1 } });
const sessionSplit2 = await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "split_session", billId: sessionSplit1.bill.id, keepCustomer: false } });
assert.equal(sessionSplit2.stoppedBill.status, "stopped");
assert.equal(sessionSplit2.bill.customer, "", "the next session bill can drop its customer");
await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "add_item", billId: sessionSplit2.bill.id, productId: productSnack.id, quantity: 1 } });
const sessionSplit3 = await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "split_session", billId: sessionSplit2.bill.id, keepCustomer: false } });
await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "add_item", billId: sessionSplit3.bill.id, productId: productSnack.id, quantity: 1 } });

const sessionOldBefore = await billDetail(adminA.token, sessionStarted.billId);
await new Promise((resolve) => setTimeout(resolve, 1100));
const sessionOldAfter = await billDetail(adminA.token, sessionStarted.billId);
assert.equal(sessionOldBefore.totalAmount, sessionOldAfter.totalAmount, "a stopped bill total remains frozen");
assert.equal(sessionOldBefore.items[0].stoppedAt, sessionOldAfter.items[0].stoppedAt, "a stopped hourly item does not keep running");
assert.equal(sessionOldAfter.discountAmount, sessionDiscountBeforeSplit, "editing a promotion does not rewrite a stopped bill");
assert.equal(sessionOldAfter.promotion.name, sessionPromotion.name);
assert.equal(sessionOldAfter.promotion.value, 10);
const sessionFirstTotal = sessionOldAfter.totalAmount;
const sessionSummaryBeforePay = await ok("/api/table-billing/action", { method: "POST", token: customerA.token, body: { action: "session_summary", billId: sessionSplit3.bill.id } });
assert.equal(sessionSummaryBeforePay.bills.length, 4, "session members can see every bill in a repeatedly split session");
assert.equal(sessionSummaryBeforePay.totalAmount, sessionFirstTotal + 15000);
assert.equal(sessionSummaryBeforePay.outstandingAmount, sessionFirstTotal + 15000);
assert.equal((await billDetail(customerA.token, sessionSplit3.bill.id)).customer, "", "session members can view an unassigned bill");
await rejected("/api/table-billing/action", { method: "POST", token: otherA.token, body: { action: "session_summary", billId: sessionSplit3.bill.id } });
await rejected("/api/table-billing/action", { method: "POST", token: customerB.token, body: { action: "detail", billId: sessionSplit3.bill.id } });

const walletBeforeSessionPay = await record(superToken, "wallets", wallet.id);
await ok(`/api/collections/wallets/records/${encodeURIComponent(wallet.id)}`, { method: "PATCH", token: superToken, body: { main_balance: Number(walletBeforeSessionPay.main_balance) + 10000 } });
const stoppedWalletRequest = await ok("/api/table-billing/action", { method: "POST", token: customerA.token, body: { action: "request_wallet", billId: sessionSplit3.stoppedBill.id } });
assert.equal(stoppedWalletRequest.bill.status, "stopped", "a payment request does not make a stopped bill active again");
assert.equal(stoppedWalletRequest.bill.paymentRequested, true);
assert.equal(stoppedWalletRequest.bill.customer, "", "a session member can request payment for an unassigned stopped bill");
const stoppedWalletPaid = await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "approve_wallet", billId: sessionSplit3.stoppedBill.id } });
assert.equal(stoppedWalletPaid.bill.status, "paid");
assert.equal((await record(superToken, "wallets", wallet.id)).main_balance, Number(walletBeforeSessionPay.main_balance) + 5000, "wallet payment is debited from the session member who requested it");
assert.equal((await ok("/api/table-billing/map", { token: adminA.token })).tables.find((table) => table.id === tableA3.id).status, "occupied", "collecting an older session bill does not free a table with a current bill");
const sessionCurrentPaid = await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "pay_manual", billId: sessionSplit3.bill.id, paymentMethod: "cash", cashReceived: 5000 } });
assert.equal(sessionCurrentPaid.bill.status, "paid");
assert.equal((await ok("/api/table-billing/map", { token: adminA.token })).tables.find((table) => table.id === tableA3.id).status, "available", "the table is released once no current bill remains");
const sessionSummaryAfterPay = await ok("/api/table-billing/action", { method: "POST", token: customerA.token, body: { action: "session_summary", billId: sessionStarted.billId } });
assert.equal(sessionSummaryAfterPay.totalAmount, sessionFirstTotal + 15000);
assert.equal(sessionSummaryAfterPay.outstandingAmount, sessionFirstTotal + 5000, "the session outstanding total excludes paid bills");

await rejected("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "delete_table", tableId: tableA3.id, password: "wrong-password" } });
await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "delete_table", tableId: tableA3.id, password: adminA.password } });
assert.equal((await ok("/api/table-billing/map", { token: adminA.token })).tables.some((table) => table.id === tableA3.id), false);

await ok("/api/table-billing/action", { method: "POST", token: adminA.token, body: { action: "configure_layout", rowCount: 1, tablesPerRow: [1] } });
const reducedMap = await ok("/api/table-billing/map", { token: adminA.token });
assert.equal(reducedMap.layout.rowCount, 1);
assert.equal(reducedMap.tables.length, 3, "reducing configured counts keeps extra tables until explicitly deleted");

console.log("PASS: store-scoped billing, configured time billing, repeated bill sessions, session access and totals, stopped wallet settlement, table occupancy, wallet idempotency, cash and transfer payment.");
