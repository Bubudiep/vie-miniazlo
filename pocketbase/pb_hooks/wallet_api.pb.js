/// <reference path="../pb_data/types.d.ts" />

// PocketBase 0.40.x executes stored route callbacks without the hook module scope.
// Keep wallet helpers inside this callback so every endpoint runs in the same scope.
function walletDisabled() {
  const request = c.request()
  const path = request.url.path
  const method = request.method.toUpperCase()
  const query = request.url.query()
  const info = $apis.requestInfo(c)
  const auth = info.authRecord || info.auth || null

  if (!["/api/wallet/me", "/api/wallet/me/transactions", "/api/wallet/pay", "/api/orders"].includes(path) &&
      !path.startsWith("/api/admin/wallets/") && !path.startsWith("/api/orders/")) {
    return c.json(404, { error: "Not found" })
  }

  const requireAuth = () => {
    if (!auth) throw new UnauthorizedError("Cần đăng nhập")
    return auth
  }
  const body = () => info.data || {}
  const storeOf = (record) => record ? String(record.get("store") || "") : ""
  const requireStore = (record) => {
    const store = storeOf(record)
    if (!store) throw new ForbiddenError("Tài khoản chưa thuộc cửa hàng")
    return store
  }
  const requireAdmin = (record) => {
    if (record.get("role") !== "admin") throw new ForbiddenError("Chỉ admin mới được thao tác")
  }
  const positiveInteger = (value, field) => {
    const number = Number(value)
    if (!Number.isInteger(number) || number <= 0) throw new BadRequestError(field + " phải là số nguyên dương")
    return number
  }
  const findUser = (id) => {
    try { return $app.dao().findRecordById("users", id) } catch (e) { throw new BadRequestError("Không tìm thấy tài khoản") }
  }
  const assertStore = (caller, target) => {
    const store = requireStore(caller)
    if (storeOf(target) !== store) throw new ForbiddenError("Tài khoản khác cửa hàng")
    return store
  }
  const walletFor = (app, userId, storeId) => {
    try {
      return app.dao().findFirstRecordByFilter("wallets", "user = {:user} && store = {:store}", { user: userId, store: storeId })
    } catch (e) {
      const wallet = new Record(app.findCollectionByNameOrId("wallets"))
      wallet.set("user", userId)
      wallet.set("store", storeId)
      wallet.set("main_balance", 0)
      app.dao().saveRecord(wallet)
      return wallet
    }
  }
  const now = () => new Date().toISOString()
  const expireLots = (app, walletId) => {
    const lots = app.dao().findRecordsByFilter("wallet_promo_lots", "wallet = {:wallet} && status = 'active'", "expires_at", -1, 0, { wallet: walletId })
    const current = Date.now()
    for (const lot of lots) {
      if (new Date(lot.get("expires_at")).getTime() <= current) {
        lot.set("remaining_amount", 0)
        lot.set("status", "expired")
        app.dao().saveRecord(lot)
      }
    }
  }
  const activeLots = (app, walletId) => {
    expireLots(app, walletId)
    return app.dao().findRecordsByFilter(
      "wallet_promo_lots",
      "wallet = {:wallet} && status = 'active' && remaining_amount > 0 && expires_at > {:now}",
      "expires_at,created",
      -1,
      0,
      { wallet: walletId, now: now() }
    )
  }
  const promoBalance = (lots) => lots.reduce((sum, lot) => sum + Math.max(0, Number(lot.get("remaining_amount")) || 0), 0)
  const summary = (app, wallet) => {
    const lots = activeLots(app, wallet.id)
    return {
      id: wallet.id,
      user: wallet.get("user"),
      store: wallet.get("store"),
      mainBalance: Number(wallet.get("main_balance")) || 0,
      promoBalance: promoBalance(lots),
      promoLots: lots.map((lot) => ({
        id: lot.id,
        originalAmount: Number(lot.get("original_amount")) || 0,
        remainingAmount: Number(lot.get("remaining_amount")) || 0,
        expiresAt: lot.get("expires_at"),
        status: lot.get("status")
      }))
    }
  }
  const transaction = (app, data) => {
    const record = new Record(app.findCollectionByNameOrId("wallet_transactions"))
    for (const key in data) record.set(key, data[key])
    app.dao().saveRecord(record)
    return record
  }
  const promoDebit = (app, wallet, amount, common) => {
    const lots = activeLots(app, wallet.id)
    const before = promoBalance(lots)
    if (before < amount) throw new BadRequestError("Số dư khuyến mại không đủ")
    let remaining = amount
    const result = []
    for (const lot of lots) {
      if (remaining <= 0) break
      const available = Number(lot.get("remaining_amount")) || 0
      const used = Math.min(available, remaining)
      const after = before - (amount - remaining + used)
      lot.set("remaining_amount", available - used)
      lot.set("status", available - used === 0 ? "consumed" : "active")
      app.dao().saveRecord(lot)
      result.push(transaction(app, Object.assign({}, common, {
        wallet_type: "promo",
        direction: "debit",
        amount: used,
        promo_lot: lot.id,
        balance_before: after + used,
        balance_after: after
      })))
      remaining -= used
    }
    return result
  }
  const transactionList = (walletId) => {
    const all = $app.dao().findRecordsByFilter("wallet_transactions", "wallet = {:wallet}", "-created", -1, 0, { wallet: walletId })
    const page = Math.max(1, Number(query.get("page") || 1))
    const perPage = Math.min(50, Math.max(1, Number(query.get("perPage") || 20)))
    const start = (page - 1) * perPage
    return { page, perPage, totalItems: all.length, items: all.slice(start, start + perPage).map((item) => item.publicExport()) }
  }
  const findOrder = (id) => {
    try { return $app.dao().findRecordById("orders", id) } catch (e) { throw new BadRequestError("Không tìm thấy hóa đơn") }
  }
  const orderJson = (order) => ({
    id: order.id,
    user: order.get("user"),
    store: order.get("store"),
    table: order.get("table"),
    totalAmount: Number(order.get("total_amount")) || 0,
    status: order.get("status"),
    paymentMethod: order.get("payment_method") || "",
    paidAt: order.get("paid_at") || ""
  })

  if (method === "GET" && path === "/api/wallet/me") {
    const caller = requireAuth()
    const store = requireStore(caller)
    return c.json(200, summary($app, walletFor($app, caller.id, store)))
  }
  if (method === "GET" && path === "/api/wallet/me/transactions") {
    const caller = requireAuth()
    const store = requireStore(caller)
    return c.json(200, transactionList(walletFor($app, caller.id, store).id))
  }

  if (method === "GET" && path === "/api/admin/wallets/users") {
    const caller = requireAuth()
    requireAdmin(caller)
    const store = requireStore(caller)
    const q = String(query.get("q") || "").trim()
    const filter = q ? "store = {:store} && (username ~ {:query} || email ~ {:query})" : "store = {:store}"
    const users = $app.dao().findRecordsByFilter("users", filter, "username", 100, 0, { store, query: q })
    return c.json(200, users.map((user) => ({ id: user.id, username: user.get("username"), email: user.get("email") || "", role: user.get("role") || "user" })))
  }

  const adminWalletMatch = path.match(/^\/api\/admin\/wallets\/([^/]+)(?:\/transactions)?$/)
  if (method === "GET" && adminWalletMatch) {
    const caller = requireAuth()
    requireAdmin(caller)
    const target = findUser(adminWalletMatch[1])
    const store = assertStore(caller, target)
    const wallet = walletFor($app, target.id, store)
    if (path.endsWith("/transactions")) return c.json(200, transactionList(wallet.id))
    return c.json(200, summary($app, wallet))
  }

  const adjustMatch = path.match(/^\/api\/admin\/wallets\/([^/]+)\/adjust$/)
  if (method === "POST" && adjustMatch) {
    const caller = requireAuth()
    requireAdmin(caller)
    const target = findUser(adjustMatch[1])
    const store = assertStore(caller, target)
    const input = body()
    const walletType = input.walletType
    const direction = input.direction
    const amount = positiveInteger(input.amount, "amount")
    const reason = String(input.reason || "").trim()
    if (!["main", "promo"].includes(walletType)) throw new BadRequestError("Loại tài khoản không hợp lệ")
    if (!["credit", "debit"].includes(direction)) throw new BadRequestError("Loại giao dịch không hợp lệ")
    if (!reason) throw new BadRequestError("Lý do là bắt buộc")
    let result
    $app.runInTransaction((txApp) => {
      const wallet = walletFor(txApp, target.id, store)
      const common = { wallet: wallet.id, user: target.id, store, actor: caller.id, reason, reference_type: "admin_adjustment", reference_id: caller.id, idempotency_key: String(input.idempotencyKey || ("admin-" + Date.now() + "-" + Math.random())) }
      if (walletType === "promo") {
        const before = promoBalance(activeLots(txApp, wallet.id))
        if (direction === "debit") {
          promoDebit(txApp, wallet, amount, common)
        } else {
          const expiresAt = String(input.expiresAt || "")
          if (!expiresAt || new Date(expiresAt).getTime() <= Date.now()) throw new BadRequestError("Ngày hết hạn khuyến mại phải ở tương lai")
          const lot = new Record(txApp.findCollectionByNameOrId("wallet_promo_lots"))
          lot.set("wallet", wallet.id)
          lot.set("user", target.id)
          lot.set("store", store)
          lot.set("original_amount", amount)
          lot.set("remaining_amount", amount)
          lot.set("expires_at", expiresAt)
          lot.set("status", "active")
          lot.set("created_by", caller.id)
          txApp.dao().saveRecord(lot)
          const tx = transaction(txApp, Object.assign({}, common, { wallet_type: "promo", direction: "credit", amount, promo_lot: lot.id, balance_before: before, balance_after: before + amount }))
          lot.set("source_transaction", tx.id)
          txApp.dao().saveRecord(lot)
        }
      } else {
        const before = Number(wallet.get("main_balance")) || 0
        const after = direction === "credit" ? before + amount : before - amount
        if (after < 0) throw new BadRequestError("Số dư tài khoản chính không đủ")
        wallet.set("main_balance", after)
        txApp.dao().saveRecord(wallet)
        transaction(txApp, Object.assign({}, common, { wallet_type: "main", direction, amount, balance_before: before, balance_after: after }))
      }
      result = summary(txApp, wallet)
    })
    return c.json(200, result)
  }

  if (method === "POST" && path === "/api/admin/wallets/promo-expiry-bulk") {
    const caller = requireAuth()
    requireAdmin(caller)
    const store = requireStore(caller)
    const input = body()
    const fromRaw = String(input.fromDate || "")
    const toRaw = String(input.toDate || "")
    const from = new Date(/^\d{4}-\d{2}-\d{2}$/.test(fromRaw) ? fromRaw + "T00:00:00+07:00" : fromRaw).getTime()
    const to = new Date(/^\d{4}-\d{2}-\d{2}$/.test(toRaw) ? toRaw + "T23:59:59.999+07:00" : toRaw).getTime()
    const next = String(input.newExpiresAt || "")
    if (!Number.isFinite(from) || !Number.isFinite(to) || from > to || !next) throw new BadRequestError("Khoảng ngày hết hạn không hợp lệ")
    const userIds = Array.isArray(input.userIds) ? input.userIds : []
    const lots = $app.dao().findRecordsByFilter("wallet_promo_lots", "store = {:store} && status = 'active'", "expires_at", -1, 0, { store })
    let updated = 0
    $app.runInTransaction((txApp) => {
      for (const lot of lots) {
        if (userIds.length && userIds.indexOf(lot.get("user")) === -1) continue
        const expiry = new Date(lot.get("expires_at")).getTime()
        if (expiry < from || expiry > to) continue
        lot.set("expires_at", next)
        if (new Date(next).getTime() <= Date.now()) { lot.set("remaining_amount", 0); lot.set("status", "expired") }
        txApp.dao().saveRecord(lot)
        updated++
      }
      const log = new Record(txApp.findCollectionByNameOrId("wallet_admin_logs"))
      log.set("store", store)
      log.set("actor", caller.id)
      log.set("action", "promo_expiry_bulk")
      log.set("details", "from=" + String(input.fromDate || "") + ";to=" + String(input.toDate || "") + ";new=" + next + ";users=" + userIds.join(","))
      log.set("affected_count", updated)
      txApp.dao().saveRecord(log)
    })
    return c.json(200, { updated })
  }

  if (method === "POST" && path === "/api/orders") {
    const caller = requireAuth()
    requireAdmin(caller)
    const store = requireStore(caller)
    const input = body()
    const target = findUser(String(input.userId || ""))
    if (storeOf(target) !== store) throw new ForbiddenError("Tài khoản khác cửa hàng")
    const total = positiveInteger(input.totalAmount, "totalAmount")
    if (input.tableId) {
      const table = $app.dao().findRecordById("tables", String(input.tableId))
      if (storeOf(table) !== store) throw new ForbiddenError("Bàn khác cửa hàng")
    }
    const order = new Record($app.findCollectionByNameOrId("orders"))
    order.set("user", target.id)
    order.set("store", store)
    order.set("table", input.tableId || "")
    order.set("total_amount", total)
    order.set("status", "unpaid")
    order.set("payment_method", "")
    order.set("idempotency_key", String(input.idempotencyKey || ""))
    $app.dao().saveRecord(order)
    return c.json(200, orderJson(order))
  }
  const orderMatch = path.match(/^\/api\/orders\/([^/]+)$/)
  if (method === "GET" && orderMatch) {
    const caller = requireAuth()
    const order = findOrder(orderMatch[1])
    const target = findUser(order.get("user"))
    assertStore(caller, target)
    if (order.get("user") !== caller.id && caller.get("role") !== "admin") throw new ForbiddenError("Không có quyền xem hóa đơn")
    return c.json(200, orderJson(order))
  }

  if (method === "POST" && path === "/api/wallet/pay") {
    const caller = requireAuth()
    const input = body()
    const order = findOrder(String(input.orderId || ""))
    const target = findUser(order.get("user"))
    const store = assertStore(caller, target)
    if (target.id !== caller.id) throw new ForbiddenError("Chỉ chủ hóa đơn mới được thanh toán")
    const key = String(input.idempotencyKey || "").trim()
    if (!key) throw new BadRequestError("idempotencyKey là bắt buộc")
    if (order.get("status") === "paid") return c.json(200, { alreadyPaid: true, order: orderJson(order) })
    if (order.get("status") !== "unpaid") throw new BadRequestError("Hóa đơn không thể thanh toán")
    let result
    $app.runInTransaction((txApp) => {
      const txOrder = txApp.dao().findRecordById("orders", order.id)
      if (txOrder.get("status") === "paid") { result = { alreadyPaid: true, order: orderJson(txOrder) }; return }
      const wallet = walletFor(txApp, target.id, store)
      const total = Number(txOrder.get("total_amount")) || 0
      const promoAvailable = promoBalance(activeLots(txApp, wallet.id))
      const mainBefore = Number(wallet.get("main_balance")) || 0
      const promoUsed = Math.min(total, promoAvailable)
      const mainUsed = total - promoUsed
      if (mainBefore < mainUsed) throw new BadRequestError("Tổng số dư không đủ thanh toán")
      const common = { wallet: wallet.id, user: target.id, store, actor: caller.id, reason: "Thanh toán hóa đơn " + txOrder.id, reference_type: "order", reference_id: txOrder.id }
      if (promoUsed > 0) promoDebit(txApp, wallet, promoUsed, Object.assign({}, common, { idempotency_key: key }))
      if (mainUsed > 0) {
        wallet.set("main_balance", mainBefore - mainUsed)
        txApp.dao().saveRecord(wallet)
        transaction(txApp, Object.assign({}, common, { wallet_type: "main", direction: "debit", amount: mainUsed, balance_before: mainBefore, balance_after: mainBefore - mainUsed, idempotency_key: promoUsed > 0 ? key + "-main" : key }))
      }
      txOrder.set("status", "paid")
      txOrder.set("payment_method", "wallet")
      txOrder.set("paid_at", now())
      txOrder.set("idempotency_key", key)
      txApp.dao().saveRecord(txOrder)
      result = { alreadyPaid: false, order: orderJson(txOrder), promoUsed, mainUsed, wallet: summary(txApp, wallet) }
    })
    return c.json(200, result)
  }

  return c.json(404, { error: "Not found" })
}

routerAdd("GET", "/api/wallet/me", (c) => {
  const auth = c.requestInfo().auth || c.auth
  if (!auth) throw new UnauthorizedError("Cần đăng nhập")
  const store = String(auth.get("store") || "")
  if (!store) throw new ForbiddenError("Tài khoản chưa thuộc cửa hàng")
  let wallet
  try {
    wallet = $app.findFirstRecordByFilter("wallets", "user = {:user} && store = {:store}", { user: auth.id, store })
  } catch (e) {
    wallet = new Record($app.findCollectionByNameOrId("wallets"))
    wallet.set("user", auth.id)
    wallet.set("store", store)
    wallet.set("main_balance", 0)
    $app.save(wallet)
  }
  const lots = $app.findRecordsByFilter("wallet_promo_lots", "wallet = {:wallet} && status = 'active'", "expires_at", -1, 0, { wallet: wallet.id })
  const active = []
  let promoBalance = 0
  const now = Date.now()
  for (const lot of lots) {
    if (new Date(lot.get("expires_at")).getTime() <= now) {
      lot.set("remaining_amount", 0)
      lot.set("status", "expired")
      $app.save(lot)
      continue
    }
    const remaining = Number(lot.get("remaining_amount")) || 0
    if (remaining <= 0) continue
    promoBalance += remaining
    active.push({ id: lot.id, originalAmount: Number(lot.get("original_amount")) || 0, remainingAmount: remaining, expiresAt: lot.get("expires_at"), status: lot.get("status") })
  }
  return c.json(200, { id: wallet.id, user: auth.id, store, mainBalance: Number(wallet.get("main_balance")) || 0, promoBalance, promoLots: active })
})

routerAdd("GET", "/api/wallet/me/transactions", (c) => {
  const info = c.requestInfo()
  const auth = info.auth || c.auth
  if (!auth) throw new UnauthorizedError("Cần đăng nhập")
  const store = String(auth.get("store") || "")
  if (!store) throw new ForbiddenError("Tài khoản chưa thuộc cửa hàng")
  let wallet
  try { wallet = $app.findFirstRecordByFilter("wallets", "user = {:user} && store = {:store}", { user: auth.id, store }) }
  catch (e) { return c.json(200, { page: 1, perPage: 20, totalItems: 0, items: [] }) }
  const query = info.query || {}
  const page = Math.max(1, Number(query.page || 1))
  const perPage = Math.min(50, Math.max(1, Number(query.perPage || 20)))
  const all = $app.findRecordsByFilter("wallet_transactions", "wallet = {:wallet}", "-created", -1, 0, { wallet: wallet.id })
  const start = (page - 1) * perPage
  return c.json(200, { page, perPage, totalItems: all.length, items: all.slice(start, start + perPage).map((item) => item.publicExport()) })
})

routerAdd("GET", "/api/admin/wallets/users", (c) => {
  const info = c.requestInfo()
  const auth = info.auth || c.auth
  if (!auth) throw new UnauthorizedError("Cần đăng nhập")
  if (auth.get("role") !== "admin") throw new ForbiddenError("Chỉ admin mới được thao tác")
  const store = String(auth.get("store") || "")
  if (!store) throw new ForbiddenError("Tài khoản chưa thuộc cửa hàng")
  const query = info.query || {}
  const q = String(query.q || "").trim()
  const filter = q ? "store = {:store} && (username ~ {:query} || email ~ {:query})" : "store = {:store}"
  const users = $app.findRecordsByFilter("users", filter, "username", 100, 0, { store, query: q })
  return c.json(200, users.map((user) => ({ id: user.id, username: user.get("username"), email: user.get("email") || "", role: user.get("role") || "user" })))
})

routerAdd("GET", "/api/admin/wallets/detail", (c) => {
  const info = c.requestInfo()
  const auth = info.auth || c.auth
  if (!auth) throw new UnauthorizedError("Cần đăng nhập")
  if (auth.get("role") !== "admin") throw new ForbiddenError("Chỉ admin mới được thao tác")
  const userId = String((info.query || {}).userId || "")
  const target = $app.findRecordById("users", userId)
  const store = String(auth.get("store") || "")
  if (!store || target.get("store") !== store) throw new ForbiddenError("Tài khoản khác cửa hàng")
  let wallet
  try { wallet = $app.findFirstRecordByFilter("wallets", "user = {:user} && store = {:store}", { user: userId, store }) }
  catch (e) {
    wallet = new Record($app.findCollectionByNameOrId("wallets"))
    wallet.set("user", userId); wallet.set("store", store); wallet.set("main_balance", 0); $app.save(wallet)
  }
  const lots = $app.findRecordsByFilter("wallet_promo_lots", "wallet = {:wallet} && status = 'active'", "expires_at", -1, 0, { wallet: wallet.id })
  let promoBalance = 0
  const promoLots = []
  for (const lot of lots) {
    if (new Date(lot.get("expires_at")).getTime() <= Date.now()) { lot.set("remaining_amount", 0); lot.set("status", "expired"); $app.save(lot); continue }
    const remaining = Number(lot.get("remaining_amount")) || 0
    if (remaining > 0) { promoBalance += remaining; promoLots.push({ id: lot.id, originalAmount: Number(lot.get("original_amount")) || 0, remainingAmount: remaining, expiresAt: lot.get("expires_at"), status: lot.get("status") }) }
  }
  return c.json(200, { id: wallet.id, user: userId, store, mainBalance: Number(wallet.get("main_balance")) || 0, promoBalance, promoLots })
})

routerAdd("GET", "/api/admin/wallets/transactions", (c) => {
  const info = c.requestInfo()
  const auth = info.auth || c.auth
  if (!auth) throw new UnauthorizedError("Cần đăng nhập")
  if (auth.get("role") !== "admin") throw new ForbiddenError("Chỉ admin mới được thao tác")
  const userId = String((info.query || {}).userId || "")
  const target = $app.findRecordById("users", userId)
  const store = String(auth.get("store") || "")
  if (!store || target.get("store") !== store) throw new ForbiddenError("Tài khoản khác cửa hàng")
  let wallet
  try { wallet = $app.findFirstRecordByFilter("wallets", "user = {:user} && store = {:store}", { user: userId, store }) }
  catch (e) { return c.json(200, { page: 1, perPage: 20, totalItems: 0, items: [] }) }
  const query = info.query || {}
  const page = Math.max(1, Number(query.page || 1))
  const perPage = Math.min(50, Math.max(1, Number(query.perPage || 20)))
  const all = $app.findRecordsByFilter("wallet_transactions", "wallet = {:wallet}", "-created", -1, 0, { wallet: wallet.id })
  const start = (page - 1) * perPage
  return c.json(200, { page, perPage, totalItems: all.length, items: all.slice(start, start + perPage).map((item) => item.publicExport()) })
})

routerAdd("POST", "/api/admin/wallets/adjust", (c) => {
  const info = c.requestInfo()
  const auth = info.auth || c.auth
  if (!auth) throw new UnauthorizedError("Cần đăng nhập")
  if (auth.get("role") !== "admin") throw new ForbiddenError("Chỉ admin mới được thao tác")
  const input = info.body || {}
  const target = $app.findRecordById("users", String(input.userId || ""))
  const store = String(auth.get("store") || "")
  if (!store || target.get("store") !== store) throw new ForbiddenError("Tài khoản khác cửa hàng")
  const walletType = input.walletType
  const direction = input.direction
  const amount = Number(input.amount)
  const reason = String(input.reason || "").trim()
  if (!["main", "promo"].includes(walletType)) throw new BadRequestError("Loại tài khoản không hợp lệ")
  if (!["credit", "debit"].includes(direction)) throw new BadRequestError("Loại giao dịch không hợp lệ")
  if (!Number.isInteger(amount) || amount <= 0) throw new BadRequestError("Số tiền phải là số nguyên dương")
  if (!reason) throw new BadRequestError("Lý do là bắt buộc")
  let response
  $app.runInTransaction((txApp) => {
    let wallet
    try { wallet = txApp.findFirstRecordByFilter("wallets", "user = {:user} && store = {:store}", { user: target.id, store }) }
    catch (e) { wallet = new Record(txApp.findCollectionByNameOrId("wallets")); wallet.set("user", target.id); wallet.set("store", store); wallet.set("main_balance", 0); txApp.save(wallet) }
    const key = String(input.idempotencyKey || ("admin-" + Date.now() + "-" + Math.random()))
    const tx = new Record(txApp.findCollectionByNameOrId("wallet_transactions"))
    tx.set("wallet", wallet.id); tx.set("user", target.id); tx.set("store", store); tx.set("actor", auth.id); tx.set("reason", reason); tx.set("reference_type", "admin_adjustment"); tx.set("reference_id", auth.id); tx.set("idempotency_key", key)
    if (walletType === "main") {
      const before = Number(wallet.get("main_balance")) || 0
      const after = direction === "credit" ? before + amount : before - amount
      if (after < 0) throw new BadRequestError("Số dư tài khoản chính không đủ")
      wallet.set("main_balance", after); txApp.save(wallet)
      tx.set("wallet_type", "main"); tx.set("direction", direction); tx.set("amount", amount); tx.set("balance_before", before); tx.set("balance_after", after); txApp.save(tx)
    } else if (direction === "credit") {
      const expiresAt = String(input.expiresAt || "")
      if (!expiresAt || new Date(expiresAt).getTime() <= Date.now()) throw new BadRequestError("Ngày hết hạn khuyến mại phải ở tương lai")
      const lots = txApp.findRecordsByFilter("wallet_promo_lots", "wallet = {:wallet} && status = 'active' && expires_at > {:now}", "expires_at", -1, 0, { wallet: wallet.id, now: new Date().toISOString() })
      const before = lots.reduce((sum, lot) => sum + (Number(lot.get("remaining_amount")) || 0), 0)
      const lot = new Record(txApp.findCollectionByNameOrId("wallet_promo_lots")); lot.set("wallet", wallet.id); lot.set("user", target.id); lot.set("store", store); lot.set("original_amount", amount); lot.set("remaining_amount", amount); lot.set("expires_at", expiresAt); lot.set("status", "active"); lot.set("created_by", auth.id); txApp.save(lot)
      tx.set("wallet_type", "promo"); tx.set("direction", "credit"); tx.set("amount", amount); tx.set("promo_lot", lot.id); tx.set("balance_before", before); tx.set("balance_after", before + amount); txApp.save(tx); lot.set("source_transaction", tx.id); txApp.save(lot)
    } else {
      const lots = txApp.findRecordsByFilter("wallet_promo_lots", "wallet = {:wallet} && status = 'active' && remaining_amount > 0 && expires_at > {:now}", "expires_at,created", -1, 0, { wallet: wallet.id, now: new Date().toISOString() })
      const before = lots.reduce((sum, lot) => sum + (Number(lot.get("remaining_amount")) || 0), 0)
      if (before < amount) throw new BadRequestError("Số dư khuyến mại không đủ")
      let left = amount
      for (const lot of lots) { if (left <= 0) break; const available = Number(lot.get("remaining_amount")) || 0; const used = Math.min(available, left); lot.set("remaining_amount", available - used); lot.set("status", available === used ? "consumed" : "active"); txApp.save(lot); const debitTx = new Record(txApp.findCollectionByNameOrId("wallet_transactions")); debitTx.set("wallet", wallet.id); debitTx.set("user", target.id); debitTx.set("store", store); debitTx.set("actor", auth.id); debitTx.set("reason", reason); debitTx.set("reference_type", "admin_adjustment"); debitTx.set("reference_id", auth.id); debitTx.set("wallet_type", "promo"); debitTx.set("direction", "debit"); debitTx.set("amount", used); debitTx.set("promo_lot", lot.id); debitTx.set("balance_before", before - (amount - left)); debitTx.set("balance_after", before - (amount - left) - used); debitTx.set("idempotency_key", key + "-" + lot.id); txApp.save(debitTx); left -= used }
    }
    const active = txApp.findRecordsByFilter("wallet_promo_lots", "wallet = {:wallet} && status = 'active' && remaining_amount > 0 && expires_at > {:now}", "expires_at", -1, 0, { wallet: wallet.id, now: new Date().toISOString() })
    response = { walletId: wallet.id, mainBalance: Number(wallet.get("main_balance")) || 0, promoBalance: active.reduce((sum, lot) => sum + (Number(lot.get("remaining_amount")) || 0), 0) }
  })
  return c.json(200, response)
})

routerAdd("GET", "/api/admin/wallets/:userId", (c) => {
  const info = c.requestInfo()
  const auth = info.auth || c.auth
  if (!auth) throw new UnauthorizedError("Cần đăng nhập")
  if (auth.get("role") !== "admin") throw new ForbiddenError("Chỉ admin mới được thao tác")
  let target
  try { target = $app.findRecordById("users", c.pathParam("userId")) } catch (e) { throw new BadRequestError("Không tìm thấy tài khoản") }
  const store = String(auth.get("store") || "")
  if (!store || target.get("store") !== store) throw new ForbiddenError("Tài khoản khác cửa hàng")
  let wallet
  try { wallet = $app.findFirstRecordByFilter("wallets", "user = {:user} && store = {:store}", { user: target.id, store }) }
  catch (e) {
    wallet = new Record($app.findCollectionByNameOrId("wallets"))
    wallet.set("user", target.id)
    wallet.set("store", store)
    wallet.set("main_balance", 0)
    $app.save(wallet)
  }
  const lots = $app.findRecordsByFilter("wallet_promo_lots", "wallet = {:wallet} && status = 'active'", "expires_at", -1, 0, { wallet: wallet.id })
  const promoLots = []
  let promoBalance = 0
  for (const lot of lots) {
    if (new Date(lot.get("expires_at")).getTime() <= Date.now()) { lot.set("remaining_amount", 0); lot.set("status", "expired"); $app.save(lot); continue }
    const remaining = Number(lot.get("remaining_amount")) || 0
    if (remaining <= 0) continue
    promoBalance += remaining
    promoLots.push({ id: lot.id, originalAmount: Number(lot.get("original_amount")) || 0, remainingAmount: remaining, expiresAt: lot.get("expires_at"), status: lot.get("status") })
  }
  return c.json(200, { id: wallet.id, user: target.id, store, mainBalance: Number(wallet.get("main_balance")) || 0, promoBalance, promoLots })
})

routerAdd("GET", "/api/admin/wallets/:userId/transactions", (c) => {
  const info = c.requestInfo()
  const auth = info.auth || c.auth
  if (!auth) throw new UnauthorizedError("Cần đăng nhập")
  if (auth.get("role") !== "admin") throw new ForbiddenError("Chỉ admin mới được thao tác")
  const target = $app.findRecordById("users", c.pathParam("userId"))
  const store = String(auth.get("store") || "")
  if (!store || target.get("store") !== store) throw new ForbiddenError("Tài khoản khác cửa hàng")
  let wallet
  try { wallet = $app.findFirstRecordByFilter("wallets", "user = {:user} && store = {:store}", { user: target.id, store }) }
  catch (e) { return c.json(200, { page: 1, perPage: 20, totalItems: 0, items: [] }) }
  const query = info.query || {}
  const page = Math.max(1, Number(query.page || 1))
  const perPage = Math.min(50, Math.max(1, Number(query.perPage || 20)))
  const all = $app.findRecordsByFilter("wallet_transactions", "wallet = {:wallet}", "-created", -1, 0, { wallet: wallet.id })
  const start = (page - 1) * perPage
  return c.json(200, { page, perPage, totalItems: all.length, items: all.slice(start, start + perPage).map((item) => item.publicExport()) })
})

routerAdd("POST", "/api/admin/wallets/:userId/adjust", (c) => {
  const info = c.requestInfo()
  const auth = info.auth || c.auth
  if (!auth) throw new UnauthorizedError("Cần đăng nhập")
  if (auth.get("role") !== "admin") throw new ForbiddenError("Chỉ admin mới được thao tác")
  const target = $app.findRecordById("users", c.pathParam("userId"))
  const store = String(auth.get("store") || "")
  if (!store || target.get("store") !== store) throw new ForbiddenError("Tài khoản khác cửa hàng")
  const input = info.body || {}
  const walletType = input.walletType
  const direction = input.direction
  const amount = Number(input.amount)
  const reason = String(input.reason || "").trim()
  if (!["main", "promo"].includes(walletType)) throw new BadRequestError("Loại tài khoản không hợp lệ")
  if (!["credit", "debit"].includes(direction)) throw new BadRequestError("Loại giao dịch không hợp lệ")
  if (!Number.isInteger(amount) || amount <= 0) throw new BadRequestError("Số tiền phải là số nguyên dương")
  if (!reason) throw new BadRequestError("Lý do là bắt buộc")
  let response
  $app.runInTransaction((txApp) => {
    let wallet
    try { wallet = txApp.findFirstRecordByFilter("wallets", "user = {:user} && store = {:store}", { user: target.id, store }) }
    catch (e) {
      wallet = new Record(txApp.findCollectionByNameOrId("wallets"))
      wallet.set("user", target.id)
      wallet.set("store", store)
      wallet.set("main_balance", 0)
      txApp.save(wallet)
    }
    const key = String(input.idempotencyKey || ("admin-" + Date.now() + "-" + Math.random()))
    const common = { wallet: wallet.id, user: target.id, store, actor: auth.id, reason, reference_type: "admin_adjustment", reference_id: auth.id, idempotency_key: key }
    if (walletType === "main") {
      const before = Number(wallet.get("main_balance")) || 0
      const after = direction === "credit" ? before + amount : before - amount
      if (after < 0) throw new BadRequestError("Số dư tài khoản chính không đủ")
      wallet.set("main_balance", after)
      txApp.save(wallet)
      const tx = new Record(txApp.findCollectionByNameOrId("wallet_transactions"))
      for (const field in common) tx.set(field, common[field])
      tx.set("wallet_type", "main")
      tx.set("direction", direction)
      tx.set("amount", amount)
      tx.set("balance_before", before)
      tx.set("balance_after", after)
      txApp.save(tx)
    } else {
      const lots = txApp.findRecordsByFilter("wallet_promo_lots", "wallet = {:wallet} && status = 'active'", "expires_at,created", -1, 0, { wallet: wallet.id })
      const activeLots = []
      let before = 0
      for (const lot of lots) {
        if (new Date(lot.get("expires_at")).getTime() <= Date.now()) { lot.set("remaining_amount", 0); lot.set("status", "expired"); txApp.save(lot); continue }
        const remaining = Number(lot.get("remaining_amount")) || 0
        if (remaining > 0) { activeLots.push(lot); before += remaining }
      }
      if (direction === "credit") {
        const expiresAt = String(input.expiresAt || "")
        if (!expiresAt || new Date(expiresAt).getTime() <= Date.now()) throw new BadRequestError("Ngày hết hạn khuyến mại phải ở tương lai")
        const lot = new Record(txApp.findCollectionByNameOrId("wallet_promo_lots"))
        lot.set("wallet", wallet.id)
        lot.set("user", target.id)
        lot.set("store", store)
        lot.set("original_amount", amount)
        lot.set("remaining_amount", amount)
        lot.set("expires_at", expiresAt)
        lot.set("status", "active")
        lot.set("created_by", auth.id)
        txApp.save(lot)
        const tx = new Record(txApp.findCollectionByNameOrId("wallet_transactions"))
        for (const field in common) tx.set(field, common[field])
        tx.set("wallet_type", "promo")
        tx.set("direction", "credit")
        tx.set("amount", amount)
        tx.set("promo_lot", lot.id)
        tx.set("balance_before", before)
        tx.set("balance_after", before + amount)
        txApp.save(tx)
        lot.set("source_transaction", tx.id)
        txApp.save(lot)
      } else {
        if (before < amount) throw new BadRequestError("Số dư khuyến mại không đủ")
        let remainingToDebit = amount
        for (const lot of activeLots) {
          if (remainingToDebit <= 0) break
          const available = Number(lot.get("remaining_amount")) || 0
          const used = Math.min(available, remainingToDebit)
          const after = before - (amount - remainingToDebit + used)
          lot.set("remaining_amount", available - used)
          lot.set("status", available - used === 0 ? "consumed" : "active")
          txApp.save(lot)
          const tx = new Record(txApp.findCollectionByNameOrId("wallet_transactions"))
          for (const field in common) tx.set(field, field === "idempotency_key" ? key + "-" + lot.id : common[field])
          tx.set("wallet_type", "promo")
          tx.set("direction", "debit")
          tx.set("amount", used)
          tx.set("promo_lot", lot.id)
          tx.set("balance_before", after + used)
          tx.set("balance_after", after)
          txApp.save(tx)
          remainingToDebit -= used
        }
      }
    }
    const currentLots = txApp.findRecordsByFilter("wallet_promo_lots", "wallet = {:wallet} && status = 'active' && remaining_amount > 0 && expires_at > {:now}", "expires_at", -1, 0, { wallet: wallet.id, now: new Date().toISOString() })
    response = { walletId: wallet.id, mainBalance: Number(wallet.get("main_balance")) || 0, promoBalance: currentLots.reduce((sum, lot) => sum + (Number(lot.get("remaining_amount")) || 0), 0) }
  })
  return c.json(200, response)
})

routerAdd("POST", "/api/admin/wallets/promo-expiry-bulk", (c) => {
  const info = c.requestInfo()
  const auth = info.auth || c.auth
  if (!auth) throw new UnauthorizedError("Cần đăng nhập")
  if (auth.get("role") !== "admin") throw new ForbiddenError("Chỉ admin mới được thao tác")
  const store = String(auth.get("store") || "")
  if (!store) throw new ForbiddenError("Tài khoản chưa thuộc cửa hàng")
  const input = info.body || {}
  const fromRaw = String(input.fromDate || "")
  const toRaw = String(input.toDate || "")
  const from = new Date(/^\d{4}-\d{2}-\d{2}$/.test(fromRaw) ? fromRaw + "T00:00:00+07:00" : fromRaw).getTime()
  const to = new Date(/^\d{4}-\d{2}-\d{2}$/.test(toRaw) ? toRaw + "T23:59:59.999+07:00" : toRaw).getTime()
  const next = String(input.newExpiresAt || "")
  if (!Number.isFinite(from) || !Number.isFinite(to) || from > to || !next) throw new BadRequestError("Khoảng ngày hết hạn không hợp lệ")
  const userIds = Array.isArray(input.userIds) ? input.userIds : []
  const lots = $app.findRecordsByFilter("wallet_promo_lots", "store = {:store} && status = 'active'", "expires_at", -1, 0, { store })
  let updated = 0
  $app.runInTransaction((txApp) => {
    for (const lot of lots) {
      if (userIds.length && userIds.indexOf(lot.get("user")) === -1) continue
      const expiry = new Date(lot.get("expires_at")).getTime()
      if (expiry < from || expiry > to) continue
      lot.set("expires_at", next)
      if (new Date(next).getTime() <= Date.now()) { lot.set("remaining_amount", 0); lot.set("status", "expired") }
      txApp.save(lot)
      updated++
    }
    const log = new Record(txApp.findCollectionByNameOrId("wallet_admin_logs"))
    log.set("store", store)
    log.set("actor", auth.id)
    log.set("action", "promo_expiry_bulk")
    log.set("details", "from=" + String(input.fromDate || "") + ";to=" + String(input.toDate || "") + ";new=" + next + ";users=" + userIds.join(","))
    log.set("affected_count", updated)
    txApp.save(log)
  })
  return c.json(200, { updated })
})

routerAdd("POST", "/api/webhooks/sepay", (c) => {
  const request = c.request
  const headers = request.header
  const rawBody = toString(request.body, 2 * 1024 * 1024)
  const signature = String(headers.get("X-SePay-Signature") || "").trim()
  const timestamp = String(headers.get("X-SePay-Timestamp") || "").trim()
  const secret = String($os.getenv("SEPAY_WEBHOOK_SECRET") || "").trim()
  if (!secret) throw new Error("SEPAY_WEBHOOK_SECRET chưa được cấu hình trên server")
  const timestampNumber = Number(timestamp)
  if (!/^\d+$/.test(timestamp) || !Number.isSafeInteger(timestampNumber) || Math.abs(Math.floor(Date.now() / 1000) - timestampNumber) > 300) throw new UnauthorizedError("Webhook hết hạn")
  const expected = "sha256=" + $security.hs256(timestamp + "." + rawBody, secret)
  if (!signature || !$security.equal(expected, signature)) throw new UnauthorizedError("Chữ ký webhook không hợp lệ")
  if (!rawBody.trim()) return c.json(200, { success: true, ignored: true, reason: "Payload kiểm tra rỗng" })
  let payload
  try { payload = JSON.parse(rawBody) } catch (e) { throw new BadRequestError("Payload webhook không hợp lệ") }

  const provider = "sepay"
  const eventKey = String(payload.id || payload.referenceCode || payload.code || payload.transactionId || payload.transaction_id || "").trim()
  const gatewayId = String(payload.id || payload.referenceCode || payload.code || payload.transactionId || payload.transaction_id || "").trim()
  const accountNumber = String(payload.accountNumber || payload.account_number || payload.toAccountNumber || "").trim()
  const subAccount = String(payload.subAccount || payload.sub_account || "").trim().toUpperCase()
  const content = String(payload.content || payload.description || payload.transferContent || payload.transfer_content || "").trim()
  const transferType = String(payload.transferType || payload.transfer_type || payload.type || "").trim().toLowerCase()
  const amount = Number(payload.transferAmount ?? payload.amount ?? payload.transfer_amount)
  // SePay's test payload can be empty. It is safe to acknowledge it because no wallet mutation is possible.
  if (!eventKey || !gatewayId || !accountNumber || !Number.isSafeInteger(amount) || amount <= 0) return c.json(200, { success: true, ignored: true, reason: "Thiếu dữ liệu giao dịch" })

  let duplicate = null
  try { duplicate = $app.findFirstRecordByFilter("wallet_webhook_events", "provider = {:provider} && event_key = {:eventKey}", { provider, eventKey }) } catch (e) {}
  if (duplicate) return c.json(200, { success: true, duplicate: true })

  const event = new Record($app.findCollectionByNameOrId("wallet_webhook_events"))
  event.set("provider", provider)
  event.set("event_key", eventKey)
  event.set("gateway_transaction_id", gatewayId)
  event.set("account_number", accountNumber)
  event.set("amount", amount)
  event.set("transfer_content", content.slice(0, 500))
  event.set("received_at", new Date().toISOString())
  event.set("payload_hash", $security.sha256(rawBody))
  event.set("status", transferType === "in" ? "received" : "ignored")

  if (transferType !== "in") {
    event.set("failure_reason", "Không phải giao dịch tiền vào")
    $app.save(event)
    return c.json(200, { success: true, ignored: true })
  }

  let settingsRecord = null
  try { settingsRecord = $app.findFirstRecordByFilter("bill_payment_settings", "account_number = {:account}", { account: accountNumber }) } catch (e) {}
  if (!settingsRecord) {
    const virtualAccount = String(accountNumber || subAccount).toUpperCase()
    try { settingsRecord = $app.findFirstRecordByFilter("bill_payment_settings", "sepay_virtual_account = {:account}", { account: virtualAccount }) } catch (e) {}
  }
  if (!settingsRecord) {
    event.set("status", "failed")
    event.set("failure_reason", "Không tìm thấy tài khoản nhận tiền đã cấu hình")
    $app.save(event)
    return c.json(200, { success: true, matched: false })
  }
  const configuredVirtualAccount = String(settingsRecord.get("sepay_virtual_account") || "").toUpperCase()
  if (subAccount && configuredVirtualAccount && subAccount !== configuredVirtualAccount) {
    event.set("store", settingsRecord.get("store"))
    event.set("status", "failed")
    event.set("failure_reason", "VA SePay không khớp tài khoản đã cấu hình")
    $app.save(event)
    return c.json(200, { success: true, matched: false })
  }
  const store = String(settingsRecord.get("store") || "")
  const topups = $app.findRecordsByFilter("wallet_topup_requests", "store = {:store} && status = 'pending'", "-created", 200, 0, { store })
  const normalizedContent = content.toUpperCase().replace(/\s+/g, "")
  const match = topups.find((item) => normalizedContent.includes(String(item.get("transfer_code") || "").toUpperCase()))
  if (!match) {
    event.set("store", store)
    event.set("status", "failed")
    event.set("failure_reason", "Không tìm thấy yêu cầu nạp đang chờ với mã chuyển khoản")
    $app.save(event)
    return c.json(200, { success: true, matched: false })
  }
  if (Number(match.get("amount")) !== amount) {
    event.set("store", store)
    event.set("topup", match.id)
    event.set("status", "failed")
    event.set("failure_reason", "Số tiền chuyển khoản không khớp yêu cầu nạp")
    $app.save(event)
    return c.json(200, { success: true, matched: false })
  }
  let response
  $app.runInTransaction((txApp) => {
    const topup = txApp.findRecordById("wallet_topup_requests", match.id)
    if (topup.get("status") !== "pending") throw new BadRequestError("Yêu cầu nạp đã được xử lý")
    let wallet
    try { wallet = txApp.findFirstRecordByFilter("wallets", "user = {:user} && store = {:store}", { user: topup.get("user"), store }) }
    catch (e) { wallet = new Record(txApp.findCollectionByNameOrId("wallets")); wallet.set("user", topup.get("user")); wallet.set("store", store); wallet.set("main_balance", 0); txApp.save(wallet) }
    const before = Number(wallet.get("main_balance")) || 0
    wallet.set("main_balance", before + amount)
    txApp.save(wallet)
    const transaction = new Record(txApp.findCollectionByNameOrId("wallet_transactions"))
    transaction.set("wallet", wallet.id); transaction.set("user", topup.get("user")); transaction.set("store", store); transaction.set("wallet_type", "main"); transaction.set("direction", "credit"); transaction.set("amount", amount); transaction.set("reason", "Nạp tiền SePay " + topup.get("transfer_code")); transaction.set("reference_type", "topup"); transaction.set("reference_id", topup.id); transaction.set("idempotency_key", "topup-" + topup.id); transaction.set("balance_before", before); transaction.set("balance_after", before + amount)
    txApp.save(transaction)
    topup.set("status", "paid"); topup.set("reviewed_at", new Date().toISOString()); topup.set("gateway_transaction_id", gatewayId); txApp.save(topup)
    const txEvent = txApp.findRecordById("wallet_webhook_events", event.id)
    txEvent.set("store", store); txEvent.set("topup", topup.id); txEvent.set("status", "processed"); txApp.save(txEvent)
    response = { success: true, processed: true, topupId: topup.id }
  })
  return c.json(200, response)
})

routerAdd("POST", "/api/wallet/topups", (c) => {
  const info = c.requestInfo()
  const auth = info.auth || c.auth
  if (!auth) throw new UnauthorizedError("Cần đăng nhập")
  if (auth.get("role") === "admin") throw new ForbiddenError("Admin không tạo yêu cầu nạp cho hội viên")
  const store = String(auth.get("store") || "")
  if (!store) throw new ForbiddenError("Tài khoản chưa thuộc cửa hàng")
  const input = info.body || {}
  const amount = Number(input.amount)
  if (!Number.isSafeInteger(amount) || amount < 1000 || amount > 100000000) throw new BadRequestError("Số tiền nạp phải từ 1.000đ đến 100.000.000đ")
  const idempotencyKey = String(input.idempotencyKey || "").trim()
  if (!idempotencyKey || idempotencyKey.length > 120) throw new BadRequestError("Mã yêu cầu không hợp lệ")
  const note = String(input.note || "").trim()
  const proof = String(input.proof || "").trim()
  if (note.length > 500 || proof.length > 500) throw new BadRequestError("Ghi chú hoặc chứng từ quá dài")
  let settingsRecord = null
  try { settingsRecord = $app.findFirstRecordByFilter("bill_payment_settings", "store = {:store}", { store }) } catch (e) {}
  if (!settingsRecord || !settingsRecord.get("bank_id") || !settingsRecord.get("account_number") || !settingsRecord.get("account_name")) throw new BadRequestError("Cửa hàng chưa cấu hình tài khoản nhận tiền QR")
  const virtualAccount = String(settingsRecord.get("sepay_virtual_account") || "").trim().toUpperCase()
  const virtualBankCode = String(settingsRecord.get("sepay_bank_code") || "").trim().toUpperCase()
  if (!/^[A-Z0-9]{4,24}$/.test(virtualAccount) || !/^[A-Z0-9]{2,20}$/.test(virtualBankCode)) throw new BadRequestError("Admin chưa cấu hình VA SePay trong mục Tài khoản")
  const topupPayment = { bankId: virtualBankCode, accountNumber: virtualAccount, accountName: settingsRecord.get("account_name") || "" }
  const toJson = (record, user) => ({ id: record.id, store: record.get("store"), user: record.get("user"), username: user.get("username") || "", fullname: user.get("fullname") || "", amount: Number(record.get("amount")) || 0, status: record.get("status") || "pending", transferCode: record.get("transfer_code") || "", proof: record.get("proof") || "", note: record.get("note") || "", reviewedBy: record.get("reviewed_by") || "", reviewedAt: record.get("reviewed_at") || "", rejectionReason: record.get("rejection_reason") || "", gatewayTransactionId: record.get("gateway_transaction_id") || "", idempotencyKey: record.get("idempotency_key") || "", created: record.get("created"), updated: record.get("updated") })
  let existing = null
  try { existing = $app.findFirstRecordByFilter("wallet_topup_requests", "user = {:user} && store = {:store} && idempotency_key = {:key}", { user: auth.id, store, key: idempotencyKey }) } catch (e) {}
  if (existing) return c.json(200, { topup: toJson(existing, auth), payment: topupPayment, alreadyCreated: true })
  let transferCode = ""
  do {
    transferCode = "NAP" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase()
    try { $app.findFirstRecordByFilter("wallet_topup_requests", "transfer_code = {:code}", { code: transferCode }); transferCode = "" } catch (e) {}
  } while (!transferCode)
  const topup = new Record($app.findCollectionByNameOrId("wallet_topup_requests"))
  topup.set("store", store)
  topup.set("user", auth.id)
  topup.set("amount", amount)
  topup.set("status", "pending")
  topup.set("transfer_code", transferCode)
  topup.set("proof", proof)
  topup.set("note", note)
  topup.set("idempotency_key", idempotencyKey)
  $app.save(topup)
  return c.json(200, { topup: toJson(topup, auth), payment: topupPayment, alreadyCreated: false })
})

routerAdd("GET", "/api/wallet/topups", (c) => {
  const info = c.requestInfo()
  const auth = info.auth || c.auth
  if (!auth) throw new UnauthorizedError("Cần đăng nhập")
  const store = String(auth.get("store") || "")
  if (!store) throw new ForbiddenError("Tài khoản chưa thuộc cửa hàng")
  const query = info.query || {}
  const page = Math.max(1, Number(query.page || 1))
  const perPage = Math.min(50, Math.max(1, Number(query.perPage || 20)))
  const records = $app.findRecordsByFilter("wallet_topup_requests", "user = {:user} && store = {:store} && status != 'expired'", "-created", -1, 0, { user: auth.id, store })
  const toJson = (record) => ({ id: record.id, store: record.get("store"), user: record.get("user"), username: auth.get("username") || "", fullname: auth.get("fullname") || "", amount: Number(record.get("amount")) || 0, status: record.get("status") || "pending", transferCode: record.get("transfer_code") || "", proof: record.get("proof") || "", note: record.get("note") || "", reviewedBy: record.get("reviewed_by") || "", reviewedAt: record.get("reviewed_at") || "", rejectionReason: record.get("rejection_reason") || "", gatewayTransactionId: record.get("gateway_transaction_id") || "", idempotencyKey: record.get("idempotency_key") || "", created: record.get("created"), updated: record.get("updated") })
  const start = (page - 1) * perPage
  return c.json(200, { page, perPage, totalItems: records.length, items: records.slice(start, start + perPage).map(toJson) })
})

routerAdd("POST", "/api/wallet/topups/{topupId}/cancel", (c) => {
  const info = c.requestInfo()
  const auth = info.auth || c.auth
  if (!auth) throw new UnauthorizedError("Cần đăng nhập")
  const store = String(auth.get("store") || "")
  const topupId = String(c.request.url.path).split("/")[4] || ""
  const topup = $app.findRecordById("wallet_topup_requests", topupId)
  if (!store || topup.get("store") !== store || topup.get("user") !== auth.id) throw new ForbiddenError("Yêu cầu nạp không hợp lệ")
  if (topup.get("status") !== "pending") return c.json(200, { topup: { id: topup.id, status: topup.get("status") } })
  topup.set("status", "expired")
  $app.save(topup)
  return c.json(200, { topup: { id: topup.id, status: topup.get("status") } })
})

routerAdd("GET", "/api/admin/wallet-topups", (c) => {
  const info = c.requestInfo()
  const auth = info.auth || c.auth
  if (!auth) throw new UnauthorizedError("Cần đăng nhập")
  if (auth.get("role") !== "admin") throw new ForbiddenError("Chỉ admin mới được thao tác")
  const store = String(auth.get("store") || "")
  if (!store) throw new ForbiddenError("Tài khoản chưa thuộc cửa hàng")
  const query = info.query || {}
  const status = String(query.status || "").trim()
  const search = String(query.q || "").trim()
  if (status && !["pending", "paid", "rejected", "expired"].includes(status)) throw new BadRequestError("Trạng thái không hợp lệ")
  let filter = "store = {:store}"
  const params = { store }
  if (status) { filter += " && status = {:status}"; params.status = status }
  const records = $app.findRecordsByFilter("wallet_topup_requests", filter, "-created", 100, 0, params)
  const toJson = (record, user) => ({ id: record.id, store: record.get("store"), user: record.get("user"), username: user ? user.get("username") || "" : "", fullname: user ? user.get("fullname") || "" : "", amount: Number(record.get("amount")) || 0, status: record.get("status") || "pending", transferCode: record.get("transfer_code") || "", proof: record.get("proof") || "", note: record.get("note") || "", reviewedBy: record.get("reviewed_by") || "", reviewedAt: record.get("reviewed_at") || "", rejectionReason: record.get("rejection_reason") || "", gatewayTransactionId: record.get("gateway_transaction_id") || "", idempotencyKey: record.get("idempotency_key") || "", created: record.get("created"), updated: record.get("updated") })
  const items = records.map((item) => {
    let user = null
    try { user = $app.findRecordById("users", item.get("user")) } catch (e) {}
    return toJson(item, user)
  }).filter((item) => !search || `${item.username} ${item.fullname} ${item.transferCode}`.toLowerCase().includes(search.toLowerCase()))
  return c.json(200, { items })
})

routerAdd("POST", "/api/admin/wallet-topups/{topupId}/approve", (c) => {
  const info = c.requestInfo()
  const auth = info.auth || c.auth
  if (!auth) throw new UnauthorizedError("Cần đăng nhập")
  if (auth.get("role") !== "admin") throw new ForbiddenError("Chỉ admin mới được thao tác")
  const store = String(auth.get("store") || "")
  if (!store) throw new ForbiddenError("Tài khoản chưa thuộc cửa hàng")
  const input = info.body || {}
  const gatewayId = String(input.gatewayTransactionId || "").trim()
  const note = String(input.note || "").trim()
  if (gatewayId.length > 120 || note.length > 500) throw new BadRequestError("Thông tin duyệt không hợp lệ")
  const toJson = (record, user) => ({ id: record.id, store: record.get("store"), user: record.get("user"), username: user.get("username") || "", fullname: user.get("fullname") || "", amount: Number(record.get("amount")) || 0, status: record.get("status") || "pending", transferCode: record.get("transfer_code") || "", proof: record.get("proof") || "", note: record.get("note") || "", reviewedBy: record.get("reviewed_by") || "", reviewedAt: record.get("reviewed_at") || "", rejectionReason: record.get("rejection_reason") || "", gatewayTransactionId: record.get("gateway_transaction_id") || "", idempotencyKey: record.get("idempotency_key") || "", created: record.get("created"), updated: record.get("updated") })
  let response
  $app.runInTransaction((txApp) => {
    const topupId = String(c.request.url.path).split("/")[4] || ""
    const topup = txApp.findRecordById("wallet_topup_requests", topupId)
    if (topup.get("store") !== store) throw new ForbiddenError("Yêu cầu khác cửa hàng")
    if (topup.get("status") === "paid") { response = { alreadyPaid: true, topup: toJson(topup, txApp.findRecordById("users", topup.get("user"))) }; return }
    if (topup.get("status") !== "pending") throw new BadRequestError("Yêu cầu nạp không còn chờ duyệt")
    const target = txApp.findRecordById("users", topup.get("user"))
    if (target.get("store") !== store || target.get("role") === "admin") throw new ForbiddenError("Hội viên không hợp lệ")
    let wallet
    try { wallet = txApp.findFirstRecordByFilter("wallets", "user = {:user} && store = {:store}", { user: target.id, store }) }
    catch (e) { wallet = new Record(txApp.findCollectionByNameOrId("wallets")); wallet.set("user", target.id); wallet.set("store", store); wallet.set("main_balance", 0); txApp.save(wallet) }
    const amount = Number(topup.get("amount")) || 0
    const before = Number(wallet.get("main_balance")) || 0
    wallet.set("main_balance", before + amount)
    txApp.save(wallet)
    const transaction = new Record(txApp.findCollectionByNameOrId("wallet_transactions"))
    transaction.set("wallet", wallet.id); transaction.set("user", target.id); transaction.set("store", store); transaction.set("wallet_type", "main"); transaction.set("direction", "credit"); transaction.set("amount", amount); transaction.set("reason", "Nạp tiền qua QR " + topup.get("transfer_code")); transaction.set("actor", auth.id); transaction.set("reference_type", "topup"); transaction.set("reference_id", topup.id); transaction.set("idempotency_key", "topup-" + topup.id); transaction.set("balance_before", before); transaction.set("balance_after", before + amount)
    txApp.save(transaction)
    topup.set("status", "paid"); topup.set("reviewed_by", auth.id); topup.set("reviewed_at", new Date().toISOString()); topup.set("gateway_transaction_id", gatewayId); topup.set("note", note || topup.get("note") || ""); topup.set("rejection_reason", "")
    txApp.save(topup)
    response = { alreadyPaid: false, topup: toJson(topup, target), wallet: { id: wallet.id, mainBalance: before + amount } }
  })
  return c.json(200, response)
})

routerAdd("POST", "/api/admin/wallet-topups/{topupId}/reject", (c) => {
  const info = c.requestInfo()
  const auth = info.auth || c.auth
  if (!auth) throw new UnauthorizedError("Cần đăng nhập")
  if (auth.get("role") !== "admin") throw new ForbiddenError("Chỉ admin mới được thao tác")
  const store = String(auth.get("store") || "")
  const reason = String((info.body || {}).reason || "").trim()
  if (!reason || reason.length > 500) throw new BadRequestError("Cần nhập lý do từ chối")
  const topupId = String(c.request.url.path).split("/")[4] || ""
  const topup = $app.findRecordById("wallet_topup_requests", topupId)
  if (topup.get("store") !== store) throw new ForbiddenError("Yêu cầu khác cửa hàng")
  if (topup.get("status") !== "pending") throw new BadRequestError("Yêu cầu nạp không còn chờ duyệt")
  topup.set("status", "rejected"); topup.set("reviewed_by", auth.id); topup.set("reviewed_at", new Date().toISOString()); topup.set("rejection_reason", reason)
  $app.save(topup)
  let target
  try { target = $app.findRecordById("users", topup.get("user")) } catch (e) { throw new BadRequestError("Không tìm thấy hội viên") }
  const toJson = (record, user) => ({ id: record.id, store: record.get("store"), user: record.get("user"), username: user.get("username") || "", fullname: user.get("fullname") || "", amount: Number(record.get("amount")) || 0, status: record.get("status") || "pending", transferCode: record.get("transfer_code") || "", proof: record.get("proof") || "", note: record.get("note") || "", reviewedBy: record.get("reviewed_by") || "", reviewedAt: record.get("reviewed_at") || "", rejectionReason: record.get("rejection_reason") || "", gatewayTransactionId: record.get("gateway_transaction_id") || "", idempotencyKey: record.get("idempotency_key") || "", created: record.get("created"), updated: record.get("updated") })
  return c.json(200, { topup: toJson(topup, target) })
})

routerAdd("POST", "/api/orders", (c) => {
  const info = c.requestInfo()
  const auth = info.auth || c.auth
  if (!auth) throw new UnauthorizedError("Cần đăng nhập")
  if (auth.get("role") !== "admin") throw new ForbiddenError("Chỉ admin mới được tạo hóa đơn")
  const store = String(auth.get("store") || "")
  const input = info.body || {}
  const target = $app.findRecordById("users", String(input.userId || ""))
  if (!store || target.get("store") !== store) throw new ForbiddenError("Tài khoản khác cửa hàng")
  const total = Number(input.totalAmount)
  if (!Number.isInteger(total) || total <= 0) throw new BadRequestError("Tổng tiền phải là số nguyên dương")
  if (input.tableId) {
    const table = $app.findRecordById("tables", String(input.tableId))
    if (table.get("store") !== store) throw new ForbiddenError("Bàn khác cửa hàng")
  }
  const order = new Record($app.findCollectionByNameOrId("orders"))
  order.set("user", target.id)
  order.set("store", store)
  order.set("table", input.tableId || "")
  order.set("total_amount", total)
  order.set("status", "unpaid")
  order.set("payment_method", "")
  order.set("idempotency_key", String(input.idempotencyKey || ""))
  $app.save(order)
  return c.json(200, { id: order.id, user: target.id, store, table: order.get("table"), totalAmount: total, status: "unpaid" })
})

routerAdd("GET", "/api/orders/detail", (c) => {
  const info = c.requestInfo()
  const auth = info.auth || c.auth
  if (!auth) throw new UnauthorizedError("Cần đăng nhập")
  const order = $app.findRecordById("orders", String((info.query || {}).orderId || ""))
  const target = $app.findRecordById("users", order.get("user"))
  const store = String(auth.get("store") || "")
  if (!store || target.get("store") !== store) throw new ForbiddenError("Hóa đơn khác cửa hàng")
  if (target.id !== auth.id && auth.get("role") !== "admin") throw new ForbiddenError("Không có quyền xem hóa đơn")
  return c.json(200, { id: order.id, user: target.id, store, table: order.get("table"), totalAmount: Number(order.get("total_amount")) || 0, status: order.get("status"), paymentMethod: order.get("payment_method") || "", paidAt: order.get("paid_at") || "" })
})

routerAdd("GET", "/api/orders/:orderId", (c) => {
  const info = c.requestInfo()
  const auth = info.auth || c.auth
  if (!auth) throw new UnauthorizedError("Cần đăng nhập")
  const order = $app.findRecordById("orders", c.pathParam("orderId"))
  const target = $app.findRecordById("users", order.get("user"))
  const store = String(auth.get("store") || "")
  if (!store || target.get("store") !== store) throw new ForbiddenError("Hóa đơn khác cửa hàng")
  if (target.id !== auth.id && auth.get("role") !== "admin") throw new ForbiddenError("Không có quyền xem hóa đơn")
  return c.json(200, { id: order.id, user: target.id, store, table: order.get("table"), totalAmount: Number(order.get("total_amount")) || 0, status: order.get("status"), paymentMethod: order.get("payment_method") || "", paidAt: order.get("paid_at") || "" })
})

routerAdd("POST", "/api/wallet/pay", (c) => {
  const info = c.requestInfo()
  const auth = info.auth || c.auth
  if (!auth) throw new UnauthorizedError("Cần đăng nhập")
  const input = info.body || {}
  const order = $app.findRecordById("orders", String(input.orderId || ""))
  const target = $app.findRecordById("users", order.get("user"))
  const store = String(auth.get("store") || "")
  if (!store || target.get("store") !== store) throw new ForbiddenError("Hóa đơn khác cửa hàng")
  if (target.id !== auth.id) throw new ForbiddenError("Chỉ chủ hóa đơn mới được thanh toán")
  const key = String(input.idempotencyKey || "").trim()
  if (!key) throw new BadRequestError("idempotencyKey là bắt buộc")
  if (order.get("status") === "paid") return c.json(200, { alreadyPaid: true, orderId: order.id })
  if (order.get("status") !== "unpaid") throw new BadRequestError("Hóa đơn không thể thanh toán")
  let response
  $app.runInTransaction((txApp) => {
    const txOrder = txApp.findRecordById("orders", order.id)
    if (txOrder.get("status") === "paid") { response = { alreadyPaid: true, orderId: txOrder.id }; return }
    let wallet
    try { wallet = txApp.findFirstRecordByFilter("wallets", "user = {:user} && store = {:store}", { user: target.id, store }) }
    catch (e) {
      wallet = new Record(txApp.findCollectionByNameOrId("wallets"))
      wallet.set("user", target.id)
      wallet.set("store", store)
      wallet.set("main_balance", 0)
      txApp.save(wallet)
    }
    const lots = txApp.findRecordsByFilter("wallet_promo_lots", "wallet = {:wallet} && status = 'active'", "expires_at,created", -1, 0, { wallet: wallet.id })
    const activeLots = []
    let promoAvailable = 0
    for (const lot of lots) {
      if (new Date(lot.get("expires_at")).getTime() <= Date.now()) { lot.set("remaining_amount", 0); lot.set("status", "expired"); txApp.save(lot); continue }
      const amount = Number(lot.get("remaining_amount")) || 0
      if (amount > 0) { activeLots.push(lot); promoAvailable += amount }
    }
    const total = Number(txOrder.get("total_amount")) || 0
    const promoUsed = Math.min(total, promoAvailable)
    const mainBefore = Number(wallet.get("main_balance")) || 0
    const mainUsed = total - promoUsed
    if (mainBefore < mainUsed) throw new BadRequestError("Tổng số dư không đủ thanh toán")
    let left = promoUsed
    for (const lot of activeLots) {
      if (left <= 0) break
      const available = Number(lot.get("remaining_amount")) || 0
      const used = Math.min(available, left)
      lot.set("remaining_amount", available - used)
      lot.set("status", available - used === 0 ? "consumed" : "active")
      txApp.save(lot)
      const tx = new Record(txApp.findCollectionByNameOrId("wallet_transactions"))
      tx.set("wallet", wallet.id); tx.set("user", target.id); tx.set("store", store); tx.set("wallet_type", "promo"); tx.set("direction", "debit"); tx.set("amount", used); tx.set("reason", "Thanh toán hóa đơn " + txOrder.id); tx.set("actor", auth.id); tx.set("promo_lot", lot.id); tx.set("reference_type", "order"); tx.set("reference_id", txOrder.id); tx.set("idempotency_key", key + "-promo-" + lot.id); tx.set("balance_before", promoAvailable - (promoUsed - left)); tx.set("balance_after", promoAvailable - (promoUsed - left) - used)
      txApp.save(tx)
      left -= used
    }
    if (mainUsed > 0) {
      wallet.set("main_balance", mainBefore - mainUsed)
      txApp.save(wallet)
      const tx = new Record(txApp.findCollectionByNameOrId("wallet_transactions"))
      tx.set("wallet", wallet.id); tx.set("user", target.id); tx.set("store", store); tx.set("wallet_type", "main"); tx.set("direction", "debit"); tx.set("amount", mainUsed); tx.set("reason", "Thanh toán hóa đơn " + txOrder.id); tx.set("actor", auth.id); tx.set("reference_type", "order"); tx.set("reference_id", txOrder.id); tx.set("idempotency_key", key + "-main"); tx.set("balance_before", mainBefore); tx.set("balance_after", mainBefore - mainUsed)
      txApp.save(tx)
    }
    txOrder.set("status", "paid")
    txOrder.set("payment_method", "wallet")
    txOrder.set("paid_at", new Date().toISOString())
    txOrder.set("idempotency_key", key)
    txApp.save(txOrder)
    response = { alreadyPaid: false, orderId: txOrder.id, promoUsed, mainUsed, mainBalance: Number(wallet.get("main_balance")) || 0 }
  })
  return c.json(200, response)
})
