/// <reference path="../pb_data/types.d.ts" />

routerUse((c) => {
  const request = c.request
  const method = request.method.toUpperCase()
  const path = request.url.path
  const routes = {
    "GET /api/admin/inventory": true,
    "GET /api/admin/inventory/settings": true,
    "PATCH /api/admin/inventory/settings": true,
    "POST /api/admin/inventory/movement": true,
    "POST /api/admin/expenses": true,
    "GET /api/admin/dashboard": true
  }
  if (!routes[method + " " + path]) return c.next()

  const info = c.requestInfo()
  const auth = info.authRecord || info.auth || c.auth || null
  if (!auth) throw new UnauthorizedError("Cần đăng nhập")
  if (auth.get("role") !== "admin") throw new ForbiddenError("Chỉ admin mới được thao tác")
  const store = String(auth.get("store") || "")
  if (!store) throw new ForbiddenError("Tài khoản chưa thuộc cửa hàng")

  const productInventory = (app, productId) => app.findRecordsByFilter(
    "inventory_movements",
    "store = {:store} && product = {:product}",
    "created",
    -1,
    0,
    { store, product: productId }
  ).reduce((sum, movement) => sum + (Number(movement.get("quantity_delta")) || 0), 0)

  const inventoryRequired = () => {
    const value = $app.findRecordById("stores", store).get("inventory_required")
    return value === undefined || value === null || value === "" ? true : value === true || value === 1 || value === "true"
  }

  const reservedQuantity = (app, productId) => {
    const bills = app.findRecordsByFilter("table_bills", "store = {:store} && (status = 'open' || status = 'wallet_pending')", "created", -1, 0, { store })
    const activeBills = {}
    bills.forEach((bill) => { activeBills[bill.id] = true })
    const items = app.findRecordsByFilter("table_bill_items", "store = {:store} && product = {:product}", "created", -1, 0, { store, product: productId })
    return items.reduce((sum, item) => {
      if (!activeBills[String(item.get("bill") || "")] || item.get("billing_unit") === "hour") return sum
      return sum + Math.max(0, Number(item.get("quantity")) || 0)
    }, 0)
  }

  if (method === "GET" && path === "/api/admin/inventory/settings") return c.json(200, { inventoryRequired: inventoryRequired() })

  if (method === "PATCH" && path === "/api/admin/inventory/settings") {
    const input = info.body || {}
    if (typeof input.inventoryRequired !== "boolean") throw new BadRequestError("Thiết lập tồn kho không hợp lệ")
    const storeRecord = $app.findRecordById("stores", store)
    storeRecord.set("inventory_required", input.inventoryRequired)
    $app.save(storeRecord)
    return c.json(200, { inventoryRequired: input.inventoryRequired })
  }

  if (method === "GET" && path === "/api/admin/inventory") {
    const search = String((info.query || {}).search || "").trim().slice(0, 80)
    let filter = "store = {:store} && billing_unit != 'hour' && kind != 'service'"
    const params = { store }
    if (search) { filter += " && name ~ {:search}"; params.search = search }
    const products = $app.findRecordsByFilter("products", filter, "category,name", -1, 0, params)
    const items = products.map((product) => {
      const onHand = productInventory($app, product.id)
      const reserved = reservedQuantity($app, product.id)
      return {
        id: product.id,
        name: product.get("name"),
        category: product.get("category") || "Khác",
        unitLabel: product.get("unit_label") || "lần",
        purchasePrice: Number(product.get("purchase_price")) || 0,
        onHand,
        reserved,
        available: onHand - reserved
      }
    })
    const movements = $app.findRecordsByFilter("inventory_movements", "store = {:store}", "-occurred_at", 100, 0, { store })
    return c.json(200, {
      items,
      movements: movements.map((movement) => {
        let productName = "Mặt hàng"
        try { productName = $app.findRecordById("products", movement.get("product")).get("name") } catch (e) {}
        let actorName = "Hệ thống"
        try { const actor = $app.findRecordById("users", movement.get("actor")); actorName = actor.get("fullname") || actor.get("username") || actorName } catch (e) {}
        return {
          id: movement.id,
          productId: movement.get("product"),
          productName,
          movementType: movement.get("movement_type"),
          quantityDelta: Number(movement.get("quantity_delta")) || 0,
          unitCost: Number(movement.get("unit_cost")) || 0,
          note: movement.get("note") || "",
          actorName,
          occurredAt: movement.get("occurred_at")
        }
      })
    })
  }

  if (method === "POST" && path === "/api/admin/inventory/movement") {
    const input = info.body || {}
    const productId = String(input.productId || "")
    const type = String(input.movementType || "")
    const quantity = Number(input.quantity)
    const unitCost = Number(input.unitCost || 0)
    const note = String(input.note || "").trim().slice(0, 500)
    if (!productId || !["in", "adjustment"].includes(type)) throw new BadRequestError("Thông tin giao dịch kho không hợp lệ")
    if (!Number.isFinite(quantity) || Math.abs(quantity) > 1000000 || Math.round(quantity * 1000) / 1000 !== quantity || quantity === 0 || (type === "in" && quantity < 0)) throw new BadRequestError("Số lượng phải có tối đa 3 chữ số thập phân; nhập kho cần số dương")
    if (!Number.isSafeInteger(unitCost) || unitCost < 0) throw new BadRequestError("Giá nhập phải là số nguyên không âm")
    const product = $app.findRecordById("products", productId)
    if (product.get("store") !== store || product.get("billing_unit") === "hour" || product.get("kind") === "service") throw new ForbiddenError("Mặt hàng không thuộc kho cửa hàng")
    let result
    $app.runInTransaction((txApp) => {
      const txProduct = txApp.findRecordById("products", productId)
      if (txProduct.get("store") !== store || txProduct.get("billing_unit") === "hour" || txProduct.get("kind") === "service") throw new ForbiddenError("Mặt hàng không thuộc kho cửa hàng")
      const onHand = productInventory(txApp, productId)
      const reserved = reservedQuantity(txApp, productId)
      if (type === "adjustment" && onHand + quantity < reserved) throw new BadRequestError("Không thể giảm tồn thấp hơn số lượng đang giữ trong hóa đơn")
      const movement = new Record(txApp.findCollectionByNameOrId("inventory_movements"))
      movement.set("store", store)
      movement.set("product", productId)
      movement.set("movement_type", type)
      movement.set("quantity_delta", quantity)
      movement.set("unit_cost", unitCost)
      movement.set("reference_type", "manual")
      movement.set("note", note || (type === "in" ? "Nhập kho" : "Điều chỉnh tồn kho"))
      movement.set("actor", auth.id)
      movement.set("occurred_at", new Date().toISOString())
      txApp.save(movement)
      if (type === "in") {
        txProduct.set("purchase_price", unitCost)
        txApp.save(txProduct)
      }
      result = { onHand: onHand + quantity, reserved, available: onHand + quantity - reserved }
    })
    return c.json(200, { ok: true, ...result })
  }

  if (method === "POST" && path === "/api/admin/expenses") {
    const input = info.body || {}
    const amount = Number(input.amount)
    const category = String(input.category || "").trim()
    const note = String(input.note || "").trim()
    const spentAt = String(input.spentAt || "")
    const spentDate = new Date(`${spentAt}T12:00:00+07:00`)
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new BadRequestError("Số tiền chi phải là số nguyên dương")
    if (!category || category.length > 80) throw new BadRequestError("Nhóm chi phí là bắt buộc và tối đa 80 ký tự")
    if (note.length > 500) throw new BadRequestError("Ghi chú tối đa 500 ký tự")
    if (!/^\d{4}-\d{2}-\d{2}$/.test(spentAt) || !Number.isFinite(spentDate.getTime()) || spentDate.toISOString().slice(0, 10) !== spentAt) throw new BadRequestError("Ngày chi không hợp lệ")
    const expense = new Record($app.findCollectionByNameOrId("expenses"))
    expense.set("store", store)
    expense.set("amount", amount)
    expense.set("category", category)
    expense.set("note", note)
    expense.set("spent_at", spentDate.toISOString())
    expense.set("created_by", auth.id)
    $app.save(expense)
    return c.json(200, { id: expense.id, amount, category, note, spentAt })
  }

  if (method === "GET" && path === "/api/admin/dashboard") {
    const query = info.query || {}
    const from = String(query.from || "")
    const to = String(query.to || "")
    const validDate = (value) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
      const parsed = new Date(`${value}T12:00:00+07:00`)
      return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    }
    if (!validDate(from) || !validDate(to) || from > to) throw new BadRequestError("Khoảng ngày không hợp lệ")
    const fromIso = new Date(`${from}T00:00:00+07:00`).toISOString()
    const toIso = new Date(new Date(`${to}T00:00:00+07:00`).getTime() + 86400000).toISOString()
    const bills = $app.findRecordsByFilter("table_bills", "store = {:store} && status = 'paid' && paid_at >= {:from} && paid_at < {:to}", "paid_at", -1, 0, { store, from: fromIso, to: toIso })
    const products = {}
    const daily = {}
    let totalRevenue = 0
    let goodsCost = 0
    let paidBills = 0
    for (const bill of bills) {
      const lines = $app.findRecordsByFilter("table_bill_items", "store = {:store} && bill = {:bill}", "created", -1, 0, { store, bill: bill.id })
      const gross = lines.reduce((sum, item) => sum + Math.max(0, Number(item.get("line_total")) || 0), 0)
      const paid = Math.max(0, Math.round(Number(bill.get("total_amount")) || 0))
      let allocated = 0
      const date = new Date(new Date(bill.get("paid_at")).getTime() + 25200000).toISOString().slice(0, 10)
      const day = daily[date] || { date, revenue: 0, productCost: 0, expenses: 0, profit: 0 }
      for (let index = 0; index < lines.length; index++) {
        const line = lines[index]
        const quantity = Math.max(0, Number(line.get("quantity")) || 0)
        const lineGross = Math.max(0, Number(line.get("line_total")) || 0)
        const revenue = index === lines.length - 1 ? paid - allocated : gross ? Math.floor(paid * lineGross / gross) : 0
        allocated += revenue
        const cost = Math.round(quantity * (Number(line.get("purchase_price")) || 0))
        let productId = String(line.get("product") || "")
        let productName = String(line.get("product_name") || "Mặt hàng")
        const unitLabel = String(line.get("unit_label") || "")
        if (productId) {
          try { const product = $app.findRecordById("products", productId); productName = product.get("name") || productName } catch (e) {}
        } else productId = "deleted:" + productName
        const row = products[productId] || { productId, name: productName, unitLabel, outputQuantity: 0, revenue: 0, cost: 0, profit: 0 }
        row.outputQuantity += quantity
        row.revenue += revenue
        row.cost += cost
        row.profit += revenue - cost
        products[productId] = row
        totalRevenue += revenue
        goodsCost += cost
        day.revenue += revenue
        day.productCost += cost
        day.profit += revenue - cost
      }
      paidBills++
      daily[date] = day
    }
    const expenses = $app.findRecordsByFilter("expenses", "store = {:store} && spent_at >= {:from} && spent_at < {:to}", "-spent_at", -1, 0, { store, from: fromIso, to: toIso })
    let otherExpenses = 0
    for (const expense of expenses) {
      const amount = Math.max(0, Math.round(Number(expense.get("amount")) || 0))
      otherExpenses += amount
      const date = new Date(new Date(expense.get("spent_at")).getTime() + 25200000).toISOString().slice(0, 10)
      const day = daily[date] || { date, revenue: 0, productCost: 0, expenses: 0, profit: 0 }
      day.expenses += amount
      day.profit -= amount
      daily[date] = day
    }
    return c.json(200, {
      from,
      to,
      summary: { totalRevenue, goodsCost, otherExpenses, totalExpenses: goodsCost + otherExpenses, profit: totalRevenue - goodsCost - otherExpenses, paidBills },
      products: Object.values(products).sort((a, b) => b.revenue - a.revenue),
      daily: Object.values(daily).sort((a, b) => a.date.localeCompare(b.date)),
      expenses: expenses.slice(0, 50).map((expense) => ({ id: expense.id, amount: Number(expense.get("amount")) || 0, category: expense.get("category"), note: expense.get("note") || "", spentAt: expense.get("spent_at") }))
    })
  }

  return c.next()
})
