import assert from "node:assert/strict";

const baseUrl = (process.env.PB_TEST_URL || "http://127.0.0.1:9996").replace(/\/$/, "");
const email = process.env.PB_TEST_SUPERUSER_EMAIL;
const password = process.env.PB_TEST_SUPERUSER_PASSWORD;
assert.ok(email && password, "Set PB_TEST_SUPERUSER_EMAIL and PB_TEST_SUPERUSER_PASSWORD");

async function request(path, { method = "GET", body, token } = {}) {
  const response = await fetch(`${baseUrl}${path}`, { method, headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(token ? { Authorization: token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const raw = await response.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { message: raw }; }
  return { response, data };
}
async function ok(path, options) {
  const result = await request(path, options);
  assert.ok(result.response.ok, `${options?.method || "GET"} ${path}: ${result.response.status} ${JSON.stringify(result.data)}`);
  return result.data;
}
async function rejected(path, options) {
  const result = await request(path, options);
  assert.ok([400, 401, 403, 404, 409].includes(result.response.status), `${options?.method || "GET"} ${path} should reject: ${result.response.status} ${JSON.stringify(result.data)}`);
  return result;
}
const billDetail = async (token, billId) => (await ok("/api/table-billing/action", { method: "POST", token, body: { action: "detail", billId } })).bill;

const superAuth = await ok("/api/collections/_superusers/auth-with-password", { method: "POST", body: { identity: email, password } });
const superToken = superAuth.token;
const suffix = `promo${Date.now()}`;
let phoneCounter = 0;
const create = (collection, body) => ok(`/api/collections/${collection}/records`, { method: "POST", token: superToken, body });
const makeUser = async (store, username, role = "user") => {
  const userPassword = `Promo-${username}-2026!`;
  const phone = `09${String(Date.now() + phoneCounter++).slice(-8)}`;
  const record = await create("users", { username, email: `${username}@example.com`, phone, password: userPassword, passwordConfirm: userPassword, fullname: username, store, role, is_approved: true, verified: true });
  const auth = await ok("/api/collections/users/auth-with-password", { method: "POST", body: { identity: username, password: userPassword } });
  return { id: record.id, token: auth.token };
};
const store = await create("stores", { name: `Promo Store ${suffix}`, service_type: "service" });
const otherStore = await create("stores", { name: `Other Promo Store ${suffix}`, service_type: "service" });
const admin = await makeUser(store.id, `admin${suffix}`, "admin");
const customer = await makeUser(store.id, `customer${suffix}`);
const otherCustomer = await makeUser(store.id, `second${suffix}`);
const otherAdmin = await makeUser(otherStore.id, `otheradmin${suffix}`, "admin");
const categoryDrink = await create("product_categories", { store: store.id, name: `Đồ uống ${suffix}` });
const categoryFood = await create("product_categories", { store: store.id, name: `Đồ ăn ${suffix}` });
const otherCategory = await create("product_categories", { store: otherStore.id, name: `Ngoài cửa hàng ${suffix}` });
const drink = await create("products", { store: store.id, name: `Nước test ${suffix}`, category: categoryDrink.name, kind: "drink", price: 100000, billing_unit: "quantity", unit_label: "phần", is_active: true });
const food = await create("products", { store: store.id, name: `Món test ${suffix}`, category: categoryFood.name, kind: "food", price: 50000, billing_unit: "quantity", unit_label: "phần", is_active: true });
const hourly = await create("products", { store: store.id, name: `Bàn giờ ${suffix}`, category: categoryFood.name, kind: "food", price: 60000, billing_unit: "hour", unit_label: "giờ", is_active: true });
const otherProduct = await create("products", { store: otherStore.id, name: `Mặt hàng khác ${suffix}`, category: otherCategory.name, kind: "drink", price: 100000, billing_unit: "quantity", unit_label: "phần", is_active: true });
for (const product of [drink, food]) {
  await ok("/api/admin/inventory/movement", { method: "POST", token: admin.token, body: { productId: product.id, movementType: "in", quantity: 1000, unitCost: 0, note: "Tồn kiểm thử" } });
}
const group = await ok("/api/admin/customer-segments", { method: "POST", token: admin.token, body: { action: "create_group", name: `Khách thân thiết ${suffix}` } });
const card = await ok("/api/admin/customer-segments", { method: "POST", token: admin.token, body: { action: "create_card", code: `VIP${Date.now()}`, name: `Thẻ vàng ${suffix}` } });
const otherGroup = await ok("/api/admin/customer-segments", { method: "POST", token: otherAdmin.token, body: { action: "create_group", name: `Nhóm khác ${suffix}` } });
const otherCard = await ok("/api/admin/customer-segments", { method: "POST", token: otherAdmin.token, body: { action: "create_card", code: `OTHER${Date.now()}`, name: `Thẻ khác ${suffix}` } });
await ok("/api/admin/customer-segments", { method: "POST", token: admin.token, body: { action: "add_group_member", parentId: group.id, userId: customer.id } });
await ok("/api/admin/customer-segments", { method: "POST", token: admin.token, body: { action: "add_card_member", parentId: card.id, userId: customer.id, cardNumber: "VIP-0001" } });

const localNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
const localWeekday = localNow.getUTCDay();
const localMinute = localNow.getUTCHours() * 60 + localNow.getUTCMinutes();
const pad2 = (value) => String(value).padStart(2, "0");
const timeText = (minutes) => `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`;
const promotionInput = (name, overrides = {}) => ({
  name: `${name} ${suffix}`, active: true, promotionType: "percent", value: 10, minInvoiceAmount: 0, maxDiscount: 0, autoApply: false,
  startAt: new Date(Date.now() - 86_400_000).toISOString(), endAt: new Date(Date.now() + 86_400_000).toISOString(), weekdays: [0, 1, 2, 3, 4, 5, 6],
  timeStart: "", timeEnd: "", scope: "invoice", targetCategories: [], targetProducts: [], audience: "all", targetGroups: [], targetCards: [], ...overrides
});
const createPromotion = (name, overrides = {}) => {
  const input = promotionInput(name, overrides);
  return ok("/api/admin/promotions", { method: "POST", token: admin.token, body: input }).then((record) => ({ ...record, input }));
};
const disablePromotion = async (promotion) => ok("/api/admin/promotions", { method: "POST", token: admin.token, body: { id: promotion.id, ...promotion.input, active: false } });

await rejected("/api/admin/promotions", { method: "POST", token: admin.token, body: promotionInput("Cross-store product", { scope: "product", targetProducts: [otherProduct.id] }) });
await rejected("/api/admin/promotions", { method: "POST", token: admin.token, body: promotionInput("Cross-store category", { scope: "category", targetCategories: [otherCategory.name] }) });
await rejected("/api/admin/promotions", { method: "POST", token: admin.token, body: promotionInput("Cross-store group", { audience: "group", targetGroups: [otherGroup.id] }) });
await rejected("/api/admin/promotions", { method: "POST", token: admin.token, body: promotionInput("Cross-store card", { audience: "card", targetCards: [otherCard.id] }) });
await rejected("/api/collections/promotions/records", { method: "POST", token: admin.token, body: { store: store.id, name: "Ghi trực tiếp", promotion_type: "percent", value: 99 } });
await rejected("/api/collections/promotions/records", { token: admin.token });
await rejected("/api/admin/promotions", { token: customer.token });
assert.equal((await ok("/api/admin/promotions", { token: otherAdmin.token })).items.length, 0, "admin sees only promotions from their store");

await ok("/api/table-billing/action", { method: "POST", token: admin.token, body: { action: "configure_layout", rowCount: 1, tablesPerRow: [1] } });
const tableMap = await ok("/api/table-billing/map", { token: admin.token });
const tableId = tableMap.tables[0].id;
const autoTen = await createPromotion("Tự động 10%", { autoApply: true });
const autoTwenty = await createPromotion("Tự động 20%", { value: 20, autoApply: true });
const startBill = async (customerId = "", items = [{ productId: drink.id, quantity: 1 }]) => {
  const started = await ok("/api/table-billing/action", { method: "POST", token: admin.token, body: { action: "start", tableId, ...(customerId ? { customerId } : {}) } });
  let bill = null;
  for (const item of items) bill = (await ok("/api/table-billing/action", { method: "POST", token: admin.token, body: { action: "add_item", billId: started.billId, ...item } })).bill;
  return { billId: started.billId, bill };
};
const finishBill = (billId) => ok("/api/table-billing/action", { method: "POST", token: admin.token, body: { action: "pay_manual", billId, paymentMethod: "cash", cashReceived: 1_000_000_000_000 } });
const first = await startBill(customer.id);
const byTable = await ok("/api/table-billing/action", { method: "POST", token: admin.token, body: { action: "detail", tableId } });
assert.equal(byTable.bill.id, first.billId, "table detail uses the same bill calculator");
assert.equal(first.bill.grossAmount, 100000);
assert.equal(first.bill.discountAmount, 20000, "largest automatic discount wins");
assert.equal(first.bill.totalAmount, 80000);
assert.equal(first.bill.promotion.name, autoTwenty.name);
const resized = await ok("/api/table-billing/action", { method: "POST", token: admin.token, body: { action: "update_item", billId: first.billId, itemId: first.bill.items[0].id, quantity: 2 } });
assert.equal(resized.bill.grossAmount, 200000, "item changes recalculate the gross total");
assert.equal(resized.bill.discountAmount, 40000, "automatic promotion is recalculated after an item change");
const manuallySelected = await ok("/api/table-billing/action", { method: "POST", token: admin.token, body: { action: "apply_promotion", billId: first.billId, promotionId: autoTen.id } });
assert.equal(manuallySelected.bill.discountAmount, 20000, "manual selection overrides the automatic winner");
assert.equal(manuallySelected.bill.promotion.name, autoTen.name);
const customerDetail = await billDetail(customer.token, first.billId);
assert.equal(customerDetail.totalAmount, 180000, "customer receives the server-calculated promotion");
assert.equal(customerDetail.promotion.name, autoTen.name);
await rejected("/api/table-billing/action", { method: "POST", token: customer.token, body: { action: "apply_promotion", billId: first.billId, promotionId: autoTwenty.id } });
await rejected("/api/table-billing/action", { method: "POST", token: admin.token, body: { action: "pay_manual", billId: first.billId, paymentMethod: "cash", cashReceived: 1_000_000_000_000, discountPercent: 50 } });
assert.equal((await billDetail(admin.token, first.billId)).totalAmount, 180000, "client discount input cannot change the payable amount");
const firstPaid = await ok("/api/table-billing/action", { method: "POST", token: admin.token, body: { action: "pay_manual", billId: first.billId, paymentMethod: "cash", cashReceived: 1_000_000_000_000 } });
assert.equal(firstPaid.bill.totalAmount, 180000);
const eventHistory = await ok(`/api/table-billing/history?billId=${encodeURIComponent(first.billId)}`, { token: admin.token });
assert.equal(eventHistory.items.find((event) => event.eventType === "payment_completed")?.details.promotion.name, autoTen.name, "payment history stores the promotion snapshot");
const editedAutoTen = { ...autoTen.input, name: `Đã sửa ${suffix}`, value: 90 };
await ok("/api/admin/promotions", { method: "POST", token: admin.token, body: { id: autoTen.id, ...editedAutoTen } });
const historicalBill = await billDetail(customer.token, first.billId);
assert.equal(historicalBill.promotion.name, autoTen.name, "editing a program does not rewrite a paid bill snapshot");
assert.equal(historicalBill.promotion.value, 10);
await disablePromotion({ ...autoTen, input: editedAutoTen });
await disablePromotion(autoTwenty);

const amount = await createPromotion("Giảm số tiền", { promotionType: "amount", value: 25000 });
const amountBill = await startBill();
const amountResult = await ok("/api/table-billing/action", { method: "POST", token: admin.token, body: { action: "apply_promotion", billId: amountBill.billId, promotionId: amount.id } });
assert.equal(amountResult.bill.discountAmount, 25000, "fixed amount discount applies to eligible subtotal");
await finishBill(amountBill.billId);

const capped = await createPromotion("Phần trăm có trần", { value: 50, maxDiscount: 12000 });
const cappedBill = await startBill();
const cappedResult = await ok("/api/table-billing/action", { method: "POST", token: admin.token, body: { action: "apply_promotion", billId: cappedBill.billId, promotionId: capped.id } });
assert.equal(cappedResult.bill.discountAmount, 12000, "maximum discount caps percentage reductions");
await finishBill(cappedBill.billId);

const fixedPrice = await createPromotion("Đồng giá", { promotionType: "fixed_price", value: 80000 });
const fixedBill = await startBill("", [{ productId: drink.id, quantity: 2 }, { productId: hourly.id }]);
const fixedResult = await ok("/api/table-billing/action", { method: "POST", token: admin.token, body: { action: "apply_promotion", billId: fixedBill.billId, promotionId: fixedPrice.id } });
assert.equal(fixedResult.bill.discountAmount, 40000, "fixed price reduces quantity products and excludes hourly lines");
await finishBill(fixedBill.billId);
const hourlyOnly = await startBill("", [{ productId: hourly.id }]);
await rejected("/api/table-billing/action", { method: "POST", token: admin.token, body: { action: "apply_promotion", billId: hourlyOnly.billId, promotionId: fixedPrice.id } });
await finishBill(hourlyOnly.billId);

const minimum = await createPromotion("Ngưỡng hóa đơn", { minInvoiceAmount: 200000 });
const minimumBill = await startBill();
await rejected("/api/table-billing/action", { method: "POST", token: admin.token, body: { action: "apply_promotion", billId: minimumBill.billId, promotionId: minimum.id } });
await finishBill(minimumBill.billId);

const categoryPromo = await createPromotion("Theo danh mục", { value: 10, scope: "category", targetCategories: [categoryDrink.name] });
const categoryBill = await startBill("", [{ productId: drink.id, quantity: 1 }, { productId: food.id, quantity: 1 }]);
const categoryResult = await ok("/api/table-billing/action", { method: "POST", token: admin.token, body: { action: "apply_promotion", billId: categoryBill.billId, promotionId: categoryPromo.id } });
assert.equal(categoryResult.bill.grossAmount, 150000);
assert.equal(categoryResult.bill.discountAmount, 10000, "category scope discounts matching lines only");
await finishBill(categoryBill.billId);

const productPromo = await createPromotion("Theo mặt hàng", { value: 10, scope: "product", targetProducts: [food.id] });
const productBill = await startBill("", [{ productId: drink.id, quantity: 1 }, { productId: food.id, quantity: 1 }]);
const productResult = await ok("/api/table-billing/action", { method: "POST", token: admin.token, body: { action: "apply_promotion", billId: productBill.billId, promotionId: productPromo.id } });
assert.equal(productResult.bill.discountAmount, 5000, "product scope discounts matching lines only");
const productItem = productBill.bill.items.find((item) => item.product === food.id);
assert.ok(productItem, "the target product was added to the bill");
const afterDelete = await ok("/api/table-billing/action", { method: "POST", token: admin.token, body: { action: "delete_item", billId: productBill.billId, itemId: productItem.id } });
assert.equal(afterDelete.bill.grossAmount, 100000);
assert.equal(afterDelete.bill.discountAmount, 0, "deleting the only eligible line clears the promotion");
await finishBill(productBill.billId);

const matchingStart = timeText(Math.max(0, localMinute - 120));
const matchingEnd = timeText(Math.min(1439, localMinute + 120));
const scheduled = await createPromotion("Lịch Việt Nam", { value: 5, weekdays: [localWeekday], timeStart: matchingStart, timeEnd: matchingEnd });
const scheduledBill = await startBill();
const scheduledResult = await ok("/api/table-billing/action", { method: "POST", token: admin.token, body: { action: "apply_promotion", billId: scheduledBill.billId, promotionId: scheduled.id } });
assert.equal(scheduledResult.bill.discountAmount, 5000, "weekday and time use the Vietnam UTC+7 clock");
await finishBill(scheduledBill.billId);
const wrongDay = await createPromotion("Sai thứ", { weekdays: [(localWeekday + 1) % 7] });
const wrongDayBill = await startBill();
await rejected("/api/table-billing/action", { method: "POST", token: admin.token, body: { action: "apply_promotion", billId: wrongDayBill.billId, promotionId: wrongDay.id } });
await finishBill(wrongDayBill.billId);
if (localMinute !== 1439) {
  const wrongTime = await createPromotion("Sai giờ", { timeStart: localMinute < 1438 ? "23:58" : "00:00", timeEnd: localMinute < 1438 ? "23:59" : "00:01" });
  const wrongTimeBill = await startBill();
  await rejected("/api/table-billing/action", { method: "POST", token: admin.token, body: { action: "apply_promotion", billId: wrongTimeBill.billId, promotionId: wrongTime.id } });
  await finishBill(wrongTimeBill.billId);
}

const groupPromo = await createPromotion("Theo nhóm", { value: 5, audience: "group", targetGroups: [group.id] });
const groupBill = await startBill(customer.id);
const groupResult = await ok("/api/table-billing/action", { method: "POST", token: admin.token, body: { action: "apply_promotion", billId: groupBill.billId, promotionId: groupPromo.id } });
assert.equal(groupResult.bill.discountAmount, 5000, "group membership qualifies a linked customer");
await finishBill(groupBill.billId);
const wrongGroupBill = await startBill(otherCustomer.id);
await rejected("/api/table-billing/action", { method: "POST", token: admin.token, body: { action: "apply_promotion", billId: wrongGroupBill.billId, promotionId: groupPromo.id } });
await finishBill(wrongGroupBill.billId);
const unlinkedGroupBill = await startBill();
await rejected("/api/table-billing/action", { method: "POST", token: admin.token, body: { action: "apply_promotion", billId: unlinkedGroupBill.billId, promotionId: groupPromo.id } });
await finishBill(unlinkedGroupBill.billId);

const cardPromo = await createPromotion("Theo thẻ", { value: 7, audience: "card", targetCards: [card.id] });
const cardBill = await startBill(customer.id);
const cardResult = await ok("/api/table-billing/action", { method: "POST", token: admin.token, body: { action: "apply_promotion", billId: cardBill.billId, promotionId: cardPromo.id } });
assert.equal(cardResult.bill.discountAmount, 7000, "membership card qualifies a linked customer");
assert.equal(cardResult.bill.promotion.targetCards[0].name, card.name, "bill snapshot keeps the card label");
await finishBill(cardBill.billId);

const everyonePromo = await createPromotion("Tất cả khách", { value: 3, autoApply: true });
const noCustomerBill = await startBill();
assert.equal(noCustomerBill.bill.discountAmount, 3000, "all-customer promotions apply to bills without a linked account");
await finishBill(noCustomerBill.billId);

const transferPromo = await createPromotion("Chuyển khoản", { value: 10 });
const transferBill = await startBill(customer.id);
const transferApplied = await ok("/api/table-billing/action", { method: "POST", token: admin.token, body: { action: "apply_promotion", billId: transferBill.billId, promotionId: transferPromo.id } });
const transferRequested = await ok("/api/table-billing/action", { method: "POST", token: customer.token, body: { action: "request_transfer", billId: transferBill.billId } });
assert.equal(transferRequested.bill.totalAmount, transferApplied.bill.totalAmount);
await ok("/api/admin/promotions", { method: "POST", token: admin.token, body: { id: transferPromo.id, ...transferPromo.input, active: false } });
const pendingTransfer = await billDetail(customer.token, transferBill.billId);
assert.equal(pendingTransfer.totalAmount, 90000, "pending transfer keeps its requested amount when a promotion is disabled");
assert.equal(pendingTransfer.promotion.name, transferPromo.name, "pending bill keeps its promotion snapshot");
const transferPaid = await ok("/api/table-billing/action", { method: "POST", token: admin.token, body: { action: "pay_manual", billId: transferBill.billId, paymentMethod: "transfer" } });
assert.equal(transferPaid.bill.totalAmount, 90000, "transfer payment preserves the promotion-calculated payable amount");

const wallet = await create("wallets", { user: customer.id, store: store.id, main_balance: 200000 });
const walletPromo = await createPromotion("Thanh toán ví", { value: 10 });
const walletBill = await startBill(customer.id);
await ok("/api/table-billing/action", { method: "POST", token: admin.token, body: { action: "apply_promotion", billId: walletBill.billId, promotionId: walletPromo.id } });
const walletRequest = await ok("/api/table-billing/action", { method: "POST", token: customer.token, body: { action: "request_wallet", billId: walletBill.billId } });
assert.equal(walletRequest.bill.totalAmount, 90000);
const walletDiscounted = await ok("/api/table-billing/action", { method: "POST", token: admin.token, body: { action: "approve_wallet", billId: walletBill.billId, paymentDiscountPercent: 50 } });
assert.equal(walletDiscounted.bill.totalAmount, 45000, "wallet payment applies the explicit payment discount after the promotion");
assert.equal((await ok(`/api/collections/wallets/records/${encodeURIComponent(wallet.id)}`, { token: superToken })).main_balance, 155000);

console.log(JSON.stringify({ ok: true, store: store.id, automatic: firstPaid.bill.discountAmount, cash: firstPaid.bill.totalAmount, transfer: transferPaid.bill.totalAmount, wallet: walletDiscounted.bill.totalAmount }));
