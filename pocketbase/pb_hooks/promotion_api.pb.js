/// <reference path="../pb_data/types.d.ts" />

routerAdd("GET", "/api/admin/promotions", (c) => {
  const info = c.requestInfo()
  const auth = info.auth || c.auth
  if (!auth) throw new UnauthorizedError("Cần đăng nhập")
  if (auth.get("role") !== "admin") throw new ForbiddenError("Chỉ admin mới được thao tác")
  const store = String(auth.get("store") || "")
  if (!store) throw new ForbiddenError("Tài khoản chưa thuộc cửa hàng")
  const readArray = (value) => {
    if (Array.isArray(value)) return value
    if (typeof value === "string") { try { const parsed = JSON.parse(value || "[]"); return Array.isArray(parsed) ? parsed : [] } catch (e) {} }
    return []
  }
  const records = $app.findRecordsByFilter("promotions", "store = {:store}", "-created", -1, 0, { store })
  return c.json(200, { items: records.map((record) => ({
    id: record.id,
    store: record.get("store"),
    name: record.get("name"),
    active: record.getBool("active"),
    promotionType: record.get("promotion_type"),
    value: Number(record.get("value")) || 0,
    minInvoiceAmount: Number(record.get("min_invoice_amount")) || 0,
    maxDiscount: Number(record.get("max_discount")) || 0,
    autoApply: record.getBool("auto_apply"),
    startAt: record.get("start_at"),
    endAt: record.get("end_at"),
    weekdays: readArray(record.get("weekdays")),
    timeStart: record.get("time_start") || "",
    timeEnd: record.get("time_end") || "",
    scope: record.get("scope"),
    targetCategories: readArray(record.get("target_categories")),
    targetProducts: readArray(record.get("target_products")),
    audience: record.get("audience"),
    targetGroups: readArray(record.get("target_groups")),
    targetCards: readArray(record.get("target_cards")),
    created: record.get("created"),
    updated: record.get("updated")
  })) })
})

routerAdd("POST", "/api/admin/promotions", (c) => {
  const info = c.requestInfo()
  const auth = info.auth || c.auth
  if (!auth) throw new UnauthorizedError("Cần đăng nhập")
  if (auth.get("role") !== "admin") throw new ForbiddenError("Chỉ admin mới được thao tác")
  const store = String(auth.get("store") || "")
  if (!store) throw new ForbiddenError("Tài khoản chưa thuộc cửa hàng")
  const input = info.body || info.data || {}
  const text = (value, max = 255) => String(value == null ? "" : value).trim().slice(0, max)
  const jsonArray = (value) => {
    if (Array.isArray(value)) return value
    if (typeof value === "string") { try { const parsed = JSON.parse(value || "[]"); return Array.isArray(parsed) ? parsed : [] } catch (e) {} }
    return []
  }
  const num = (value, label) => {
    const result = Number(value)
    if (!Number.isSafeInteger(result) || result < 0) throw new BadRequestError(label + " không hợp lệ")
    return result
  }
  const arrayText = (value, max = 80) => jsonArray(value).map((item) => text(item, max)).filter(Boolean)
  const name = text(input.name, 160)
  const type = text(input.promotionType || input.promotion_type, 30)
  const scope = text(input.scope, 30)
  const audience = text(input.audience, 30)
  if (!name) throw new BadRequestError("Tên chương trình là bắt buộc")
  if (!["percent", "amount", "fixed_price"].includes(type)) throw new BadRequestError("Loại khuyến mại không hợp lệ")
  if (!["invoice", "category", "product"].includes(scope)) throw new BadRequestError("Phạm vi áp dụng không hợp lệ")
  if (!["all", "group", "card"].includes(audience)) throw new BadRequestError("Đối tượng áp dụng không hợp lệ")
  const value = num(input.value, "Giá trị")
  if (type === "percent" && value > 100) throw new BadRequestError("Phần trăm giảm tối đa là 100")
  const startAt = String(input.startAt || input.start_at || "")
  const endAt = String(input.endAt || input.end_at || "")
  if (!Number.isFinite(Date.parse(startAt)) || !Number.isFinite(Date.parse(endAt))) throw new BadRequestError("Ngày áp dụng không hợp lệ")
  if (Date.parse(startAt) >= Date.parse(endAt)) throw new BadRequestError("Ngày kết thúc phải sau ngày bắt đầu")
  const timeStart = text(input.timeStart || input.time_start, 5)
  const timeEnd = text(input.timeEnd || input.time_end, 5)
  const validTime = (time) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time)
  if ((timeStart || timeEnd) && (!validTime(timeStart) || !validTime(timeEnd) || timeStart >= timeEnd)) throw new BadRequestError("Khung giờ áp dụng không hợp lệ")
  const weekdays = jsonArray(input.weekdays)
  if (!weekdays.length || weekdays.some((day) => !Number.isInteger(Number(day)) || Number(day) < 0 || Number(day) > 6) || new Set(weekdays.map(Number)).size !== weekdays.length) throw new BadRequestError("Ngày áp dụng không hợp lệ")
  const targetCategories = arrayText(input.targetCategories || input.target_categories)
  const targetProducts = arrayText(input.targetProducts || input.target_products, 40)
  const targetGroups = arrayText(input.targetGroups || input.target_groups, 40)
  const targetCards = arrayText(input.targetCards || input.target_cards, 40)
  if (scope === "category" && !targetCategories.length) throw new BadRequestError("Hãy chọn ít nhất một danh mục")
  if (scope === "product" && !targetProducts.length) throw new BadRequestError("Hãy chọn ít nhất một mặt hàng")
  if (audience === "group" && !targetGroups.length) throw new BadRequestError("Hãy chọn ít nhất một nhóm khách")
  if (audience === "card" && !targetCards.length) throw new BadRequestError("Hãy chọn ít nhất một thẻ thành viên")
  if (scope === "category") {
    const categories = $app.findRecordsByFilter("product_categories", "store = {:store}", "name", -1, 0, { store }).map((record) => String(record.get("name") || ""))
    if (targetCategories.some((category) => !categories.includes(category))) throw new BadRequestError("Danh mục không thuộc cửa hàng")
  }
  const assertStoreRecords = (collection, ids, label) => {
    for (const id of ids) {
      let record
      try { record = $app.findRecordById(collection, id) } catch (e) { throw new BadRequestError(label + " không hợp lệ") }
      if (record.get("store") !== store) throw new BadRequestError(label + " không thuộc cửa hàng")
    }
  }
  if (scope === "product") assertStoreRecords("products", targetProducts, "Mặt hàng")
  if (audience === "group") assertStoreRecords("customer_groups", targetGroups, "Nhóm khách hàng")
  if (audience === "card") assertStoreRecords("member_card_types", targetCards, "Thẻ thành viên")
  const id = text(input.id, 40)
  let record
  if (id) {
    record = $app.findRecordById("promotions", id)
    if (record.get("store") !== store) throw new ForbiddenError("Chương trình khác cửa hàng")
  } else record = new Record($app.findCollectionByNameOrId("promotions"))
  record.set("store", store)
  record.set("name", name)
  record.set("active", input.active === undefined ? true : input.active === true || input.active === "true")
  record.set("promotion_type", type)
  record.set("value", value)
  record.set("min_invoice_amount", num(input.minInvoiceAmount === undefined ? input.min_invoice_amount : input.minInvoiceAmount, "Giá trị hóa đơn tối thiểu"))
  record.set("max_discount", num(input.maxDiscount === undefined ? input.max_discount : input.maxDiscount, "Giảm giá tối đa"))
  record.set("auto_apply", input.autoApply === undefined && input.auto_apply === undefined ? true : input.autoApply === true || input.autoApply === "true" || input.auto_apply === true || input.auto_apply === "true")
  record.set("start_at", startAt)
  record.set("end_at", endAt)
  record.set("weekdays", JSON.stringify(weekdays.map(Number)))
  record.set("time_start", timeStart)
  record.set("time_end", timeEnd)
  record.set("scope", scope)
  record.set("target_categories", JSON.stringify(targetCategories))
  record.set("target_products", JSON.stringify(targetProducts))
  record.set("audience", audience)
  record.set("target_groups", JSON.stringify(targetGroups))
  record.set("target_cards", JSON.stringify(targetCards))
  $app.save(record)
  const readArray = (field) => jsonArray(record.get(field))
  return c.json(200, {
    id: record.id, store: record.get("store"), name: record.get("name"), active: record.getBool("active"), promotionType: record.get("promotion_type"), value: Number(record.get("value")) || 0,
    minInvoiceAmount: Number(record.get("min_invoice_amount")) || 0, maxDiscount: Number(record.get("max_discount")) || 0, autoApply: record.getBool("auto_apply"), startAt: record.get("start_at"), endAt: record.get("end_at"),
    weekdays: readArray("weekdays"), timeStart: record.get("time_start") || "", timeEnd: record.get("time_end") || "", scope: record.get("scope"), targetCategories: readArray("target_categories"),
    targetProducts: readArray("target_products"), audience: record.get("audience"), targetGroups: readArray("target_groups"), targetCards: readArray("target_cards"), created: record.get("created"), updated: record.get("updated")
  })
})

routerAdd("DELETE", "/api/admin/promotions", (c) => {
  const info = c.requestInfo()
  const auth = info.auth || c.auth
  if (!auth) throw new UnauthorizedError("Cần đăng nhập")
  if (auth.get("role") !== "admin") throw new ForbiddenError("Chỉ admin mới được thao tác")
  const store = String(auth.get("store") || "")
  const id = String((info.body || info.data || {}).id || "").trim()
  const record = $app.findRecordById("promotions", id)
  if (record.get("store") !== store) throw new ForbiddenError("Chương trình khác cửa hàng")
  let used = false
  try { $app.findFirstRecordByFilter("table_bills", "store = {:store} && promotion = {:promotion}", { store, promotion: id }); used = true } catch (e) {}
  if (used) throw new BadRequestError("Không thể xóa chương trình đã dùng trong bill")
  $app.delete(record)
  return c.json(200, { ok: true })
})

routerAdd("GET", "/api/admin/customer-segments", (c) => {
  const info = c.requestInfo()
  const auth = info.auth || c.auth
  if (!auth) throw new UnauthorizedError("Cần đăng nhập")
  if (auth.get("role") !== "admin") throw new ForbiddenError("Chỉ admin mới được thao tác")
  const store = String(auth.get("store") || "")
  if (!store) throw new ForbiddenError("Tài khoản chưa thuộc cửa hàng")
  const groups = $app.findRecordsByFilter("customer_groups", "store = {:store}", "name", -1, 0, { store })
  const cards = $app.findRecordsByFilter("member_card_types", "store = {:store}", "name", -1, 0, { store })
  const users = $app.findRecordsByFilter("users", "store = {:store} && role = 'user'", "fullname,username", -1, 0, { store })
  const members = $app.findRecordsByFilter("customer_group_members", "store = {:store}", "created", -1, 0, { store })
  const cardMembers = $app.findRecordsByFilter("customer_member_cards", "store = {:store}", "created", -1, 0, { store })
  return c.json(200, {
    groups: groups.map((item) => ({ id: item.id, name: item.get("name"), active: item.getBool("active"), members: members.filter((member) => member.get("group") === item.id).length })),
    cards: cards.map((item) => ({ id: item.id, code: item.get("code"), name: item.get("name"), active: item.getBool("active"), members: cardMembers.filter((member) => member.get("card") === item.id).length })),
    users: users.map((item) => ({ id: item.id, username: item.get("username"), fullname: item.get("fullname") || "" })),
    memberships: members.map((item) => ({ id: item.id, group: item.get("group"), user: item.get("user") })),
    cardMemberships: cardMembers.map((item) => ({ id: item.id, card: item.get("card"), user: item.get("user"), cardNumber: item.get("card_number") || "" }))
  })
})

routerAdd("POST", "/api/admin/customer-segments", (c) => {
  const info = c.requestInfo()
  const auth = info.auth || c.auth
  if (!auth) throw new UnauthorizedError("Cần đăng nhập")
  if (auth.get("role") !== "admin") throw new ForbiddenError("Chỉ admin mới được thao tác")
  const store = String(auth.get("store") || "")
  if (!store) throw new ForbiddenError("Tài khoản chưa thuộc cửa hàng")
  const input = info.body || info.data || {}
  const text = (value, max = 255) => String(value == null ? "" : value).trim().slice(0, max)
  const action = text(input.action, 40)
  const findStore = (name, id) => {
    const record = $app.findRecordById(name, id)
    if (record.get("store") !== store) throw new ForbiddenError("Dữ liệu khác cửa hàng")
    return record
  }
  if (action === "create_group" || action === "create_card") {
    const isGroup = action === "create_group"
    const record = new Record($app.findCollectionByNameOrId(isGroup ? "customer_groups" : "member_card_types"))
    record.set("store", store)
    record.set("active", true)
    const name = text(input.name, 100)
    if (!name) throw new BadRequestError("Tên không được để trống")
    record.set("name", name)
    if (!isGroup) {
      const code = text(input.code, 40).toUpperCase()
      if (!code) throw new BadRequestError("Mã thẻ không được để trống")
      record.set("code", code)
    }
    $app.save(record)
    return c.json(200, isGroup ? { id: record.id, name, active: true, members: 0 } : { id: record.id, code: record.get("code"), name, active: true, members: 0 })
  }
  if (action === "delete_group" || action === "delete_card") {
    const isGroup = action === "delete_group"
    const record = findStore(isGroup ? "customer_groups" : "member_card_types", text(input.id, 40))
    $app.delete(record)
    return c.json(200, { ok: true })
  }
  if (action === "add_group_member" || action === "add_card_member") {
    const isGroup = action === "add_group_member"
    const parent = findStore(isGroup ? "customer_groups" : "member_card_types", text(input.parentId, 40))
    const user = $app.findRecordById("users", text(input.userId, 40))
    if (user.get("store") !== store || user.get("role") !== "user") throw new BadRequestError("Khách hàng không thuộc cửa hàng")
    const collectionName = isGroup ? "customer_group_members" : "customer_member_cards"
    const parentField = isGroup ? "group" : "card"
    try { $app.findFirstRecordByFilter(collectionName, `store = {:store} && ${parentField} = {:parent} && user = {:user}`, { store, parent: parent.id, user: user.id }); return c.json(200, { ok: true, alreadyExists: true }) } catch (e) {}
    const record = new Record($app.findCollectionByNameOrId(collectionName))
    record.set("store", store)
    record.set(parentField, parent.id)
    record.set("user", user.id)
    if (!isGroup) record.set("card_number", text(input.cardNumber, 60))
    $app.save(record)
    return c.json(200, { ok: true, id: record.id })
  }
  if (action === "remove_group_member" || action === "remove_card_member") {
    const isGroup = action === "remove_group_member"
    const record = $app.findRecordById(isGroup ? "customer_group_members" : "customer_member_cards", text(input.id, 40))
    if (record.get("store") !== store) throw new ForbiddenError("Dữ liệu khác cửa hàng")
    $app.delete(record)
    return c.json(200, { ok: true })
  }
  throw new BadRequestError("Thao tác không hợp lệ")
})
