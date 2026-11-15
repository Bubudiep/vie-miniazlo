routerAdd("GET", "/api/admin/wallet-spin/settings", (c) => {
  const auth = c.requestInfo().auth || c.auth
  if (!auth) throw new UnauthorizedError("Cần đăng nhập")
  if (auth.get("role") !== "admin") throw new ForbiddenError("Chỉ admin mới được thao tác")
  const store = String(auth.get("store") || "")
  if (!store) throw new ForbiddenError("Tài khoản chưa thuộc cửa hàng")
  let record
  try { record = $app.findFirstRecordByFilter("wallet_spin_settings", "store = {:store}", { store }) } catch (e) {}
  let prizes = []
  try { prizes = JSON.parse(record ? record.get("prizes") || "[]" : "[]") } catch (e) {}
  return c.json(200, { minTopup: record ? Number(record.get("min_topup")) || 0 : 0, prizes })
})

routerAdd("PUT", "/api/admin/wallet-spin/settings", (c) => {
  const info = c.requestInfo()
  const auth = info.auth || c.auth
  if (!auth) throw new UnauthorizedError("Cần đăng nhập")
  if (auth.get("role") !== "admin") throw new ForbiddenError("Chỉ admin mới được thao tác")
  const store = String(auth.get("store") || "")
  if (!store) throw new ForbiddenError("Tài khoản chưa thuộc cửa hàng")
  const input = info.body || {}
  const minTopup = Number(input.minTopup)
  const prizes = input.prizes
  if (!Number.isSafeInteger(minTopup) || minTopup < 0 || minTopup > 100000000) throw new BadRequestError("Ngưỡng nạp không hợp lệ")
  if (!Array.isArray(prizes) || prizes.length > 50) throw new BadRequestError("Danh sách phần thưởng không hợp lệ")
  let probability = 0
  const clean = prizes.map((prize) => {
    const name = String(prize.name || "").trim()
    const amount = Number(prize.amount)
    const chance = Number(prize.probability)
    if (!name || name.length > 120 || !Number.isSafeInteger(amount) || amount < 0 || amount > 100000000 || !Number.isFinite(chance) || chance < 0 || chance > 100) throw new BadRequestError("Kiểm tra tên, số tiền (tối đa 100.000.000đ) và tỷ lệ từng phần thưởng")
    probability += chance
    return { name, amount, probability: chance }
  })
  if (probability > 100) throw new BadRequestError("Tổng tỷ lệ trúng không được vượt quá 100%")
  let record
  try { record = $app.findFirstRecordByFilter("wallet_spin_settings", "store = {:store}", { store }) }
  catch (e) { record = new Record($app.findCollectionByNameOrId("wallet_spin_settings")); record.set("store", store) }
  record.set("min_topup", minTopup)
  record.set("prizes", JSON.stringify(clean))
  record.set("updated_by", auth.id)
  $app.save(record)
  return c.json(200, { minTopup, prizes: clean })
})

routerAdd("GET", "/api/wallet/spins", (c) => {
  const auth = c.requestInfo().auth || c.auth
  if (!auth) throw new UnauthorizedError("Cần đăng nhập")
  const store = String(auth.get("store") || "")
  if (!store) throw new ForbiddenError("Tài khoản chưa thuộc cửa hàng")
  let settings
  try { settings = $app.findFirstRecordByFilter("wallet_spin_settings", "store = {:store}", { store }) } catch (e) {}
  const minTopup = settings ? Number(settings.get("min_topup")) || 0 : 0
  let prizes = []
  try { prizes = JSON.parse(settings ? settings.get("prizes") || "[]" : "[]") } catch (e) {}
  // shortcut: only the latest 100 paid top-ups are listed; add pagination if users can exceed that with unclaimed spins.
  const topups = $app.findRecordsByFilter("wallet_topup_requests", "store = {:store} && user = {:user} && status = 'paid'", "-created", 100, 0, { store, user: auth.id })
  const spins = $app.findRecordsByFilter("wallet_topup_spins", "store = {:store} && user = {:user}", "-created", 100, 0, { store, user: auth.id })
  const byTopup = {}
  spins.forEach((spin) => { byTopup[spin.get("topup")] = { id: spin.id, prizeName: spin.get("prize_name"), prizeAmount: Number(spin.get("prize_amount")) || 0, created: spin.get("created") } })
  return c.json(200, { minTopup, prizes: prizes.map((p) => ({ name: p.name, amount: p.amount, probability: p.probability })), items: topups.map((topup) => ({ topupId: topup.id, amount: Number(topup.get("amount")) || 0, created: topup.get("created"), eligible: minTopup > 0 && Number(topup.get("amount")) >= minTopup && prizes.length > 0, result: byTopup[topup.id] || null })) })
})

routerAdd("POST", "/api/admin/wallet-spin/sessions", (c) => {
  const info = c.requestInfo(), auth = info.auth || c.auth
  if (!auth) throw new UnauthorizedError("Cần đăng nhập")
  if (auth.get("role") !== "admin") throw new ForbiddenError("Chỉ admin mới được thao tác")
  const store = String(auth.get("store") || ""), userId = String((info.body || {}).userId || "")
  if (!store || !userId) throw new BadRequestError("Thiếu user cần bật quay số")
  const user = $app.findRecordById("users", userId)
  if (user.get("store") !== store || user.get("role") !== "user") throw new BadRequestError("User không thuộc cửa hàng")
  const old = $app.findRecordsByFilter("wallet_spin_sessions", "store = {:store} && user = {:user} && status = 'pending'", "-created", 1, 0, { store, user: userId })
  if (old.length) return c.json(200, { id: old[0].id, alreadyActive: true })
  const session = new Record($app.findCollectionByNameOrId("wallet_spin_sessions"))
  session.set("store", store); session.set("user", userId); session.set("status", "pending")
  $app.save(session)
  return c.json(200, { id: session.id, alreadyActive: false })
})

routerAdd("GET", "/api/wallet/spin-sessions", (c) => {
  const auth = c.requestInfo().auth || c.auth
  if (!auth) throw new UnauthorizedError("Cần đăng nhập")
  const store = String(auth.get("store") || "")
  const items = $app.findRecordsByFilter("wallet_spin_sessions", "store = {:store} && user = {:user} && status = 'pending'", "-created", 1, 0, { store, user: auth.id })
  return c.json(200, items.map((item) => ({ id: item.id, status: item.get("status"), created: item.get("created") })))
})

routerAdd("POST", "/api/wallet/spin-sessions/:id", (c) => {
  const auth = c.requestInfo().auth || c.auth
  if (!auth) throw new UnauthorizedError("Cần đăng nhập")
  const store = String(auth.get("store") || "")
  let response
  $app.runInTransaction((txApp) => {
    const session = txApp.findRecordById("wallet_spin_sessions", c.pathParam("id"))
    if (session.get("store") !== store || session.get("user") !== auth.id) throw new ForbiddenError("Phiên quay số không hợp lệ")
    if (session.get("status") === "spun") { response = { prizeName: session.get("prize_name"), prizeAmount: Number(session.get("prize_amount")) || 0, alreadySpun: true }; return }
    const settings = txApp.findFirstRecordByFilter("wallet_spin_settings", "store = {:store}", { store })
    let prizes = []; try { prizes = JSON.parse(settings.get("prizes") || "[]") } catch (e) {}
    if (!prizes.length) throw new BadRequestError("Chương trình quay số chưa có phần thưởng")
    const sample = parseInt($security.sha256($security.randomString(32)).slice(0, 8), 16) / 0x100000000 * 100
    let cumulative = 0, selected = { name: "Chúc bạn may mắn lần sau", amount: 0, probability: Math.max(0, 100 - prizes.reduce((sum, prize) => sum + Number(prize.probability), 0)) }
    for (const prize of prizes) { cumulative += Number(prize.probability); if (sample < cumulative) { selected = prize; break } }
    session.set("status", "spun"); session.set("prize_name", selected.name); session.set("prize_amount", selected.amount); session.set("probability", selected.probability); txApp.save(session)
    if (selected.amount > 0) {
      let wallet; try { wallet = txApp.findFirstRecordByFilter("wallets", "user = {:user} && store = {:store}", { user: auth.id, store }) } catch (e) { wallet = new Record(txApp.findCollectionByNameOrId("wallets")); wallet.set("user", auth.id); wallet.set("store", store); wallet.set("main_balance", 0) }
      const before = Number(wallet.get("main_balance")) || 0; wallet.set("main_balance", before + selected.amount); txApp.save(wallet)
      const transaction = new Record(txApp.findCollectionByNameOrId("wallet_transactions")); transaction.set("wallet", wallet.id); transaction.set("user", auth.id); transaction.set("store", store); transaction.set("wallet_type", "main"); transaction.set("direction", "credit"); transaction.set("amount", selected.amount); transaction.set("reason", "Thưởng quay số admin: " + selected.name); transaction.set("reference_type", "admin_spin"); transaction.set("reference_id", session.id); transaction.set("idempotency_key", "admin-spin-" + session.id); transaction.set("balance_before", before); transaction.set("balance_after", before + selected.amount); txApp.save(transaction)
    }
    response = { prizeName: selected.name, prizeAmount: Number(selected.amount) || 0, alreadySpun: false }
  })
  return c.json(200, response)
})

routerAdd("POST", "/api/wallet/spins", (c) => {
  const info = c.requestInfo()
  const auth = info.auth || c.auth
  if (!auth) throw new UnauthorizedError("Cần đăng nhập")
  const store = String(auth.get("store") || "")
  if (!store) throw new ForbiddenError("Tài khoản chưa thuộc cửa hàng")
  const topupId = String((info.body || {}).topupId || "")
  if (!topupId) throw new BadRequestError("Thiếu giao dịch nạp")
  let response
  $app.runInTransaction((txApp) => {
    const topup = txApp.findRecordById("wallet_topup_requests", topupId)
    if (topup.get("store") !== store || topup.get("user") !== auth.id || topup.get("status") !== "paid") throw new ForbiddenError("Giao dịch nạp không hợp lệ hoặc chưa thanh toán")
    let existing
    try { existing = txApp.findFirstRecordByFilter("wallet_topup_spins", "topup = {:topup}", { topup: topupId }) } catch (e) {}
    if (existing) { response = { id: existing.id, prizeName: existing.get("prize_name"), prizeAmount: Number(existing.get("prize_amount")) || 0, alreadySpun: true }; return }
    const settings = txApp.findFirstRecordByFilter("wallet_spin_settings", "store = {:store}", { store })
    const minTopup = Number(settings.get("min_topup")) || 0
    if (!minTopup || Number(topup.get("amount")) < minTopup) throw new BadRequestError("Giao dịch chưa đạt mức nạp để quay số")
    let prizes = []
    try { prizes = JSON.parse(settings.get("prizes") || "[]") } catch (e) {}
    if (!prizes.length) throw new BadRequestError("Chương trình quay số chưa có phần thưởng")
    const sample = parseInt($security.sha256($security.randomString(32)).slice(0, 8), 16) / 0x100000000 * 100
    let cumulative = 0
    let selected = { name: "Chúc bạn may mắn lần sau", amount: 0, probability: Math.max(0, 100 - prizes.reduce((sum, prize) => sum + Number(prize.probability), 0)) }
    for (const prize of prizes) {
      cumulative += Number(prize.probability)
      if (sample < cumulative) { selected = prize; break }
    }
    const spin = new Record(txApp.findCollectionByNameOrId("wallet_topup_spins"))
    spin.set("store", store); spin.set("user", auth.id); spin.set("topup", topup.id); spin.set("prize_name", selected.name); spin.set("prize_amount", selected.amount); spin.set("probability", selected.probability)
    txApp.save(spin)
    if (selected.amount > 0) {
      let wallet
      try { wallet = txApp.findFirstRecordByFilter("wallets", "user = {:user} && store = {:store}", { user: auth.id, store }) }
      catch (e) { wallet = new Record(txApp.findCollectionByNameOrId("wallets")); wallet.set("user", auth.id); wallet.set("store", store); wallet.set("main_balance", 0) }
      const before = Number(wallet.get("main_balance")) || 0
      if (!Number.isSafeInteger(before + selected.amount)) throw new BadRequestError("Số dư ví vượt giới hạn an toàn")
      wallet.set("main_balance", before + selected.amount)
      txApp.save(wallet)
      const transaction = new Record(txApp.findCollectionByNameOrId("wallet_transactions"))
      transaction.set("wallet", wallet.id); transaction.set("user", auth.id); transaction.set("store", store); transaction.set("wallet_type", "main"); transaction.set("direction", "credit"); transaction.set("amount", selected.amount); transaction.set("reason", "Thưởng quay số nạp tiền: " + selected.name); transaction.set("reference_type", "topup_spin"); transaction.set("reference_id", topup.id); transaction.set("idempotency_key", "topup-spin-" + topup.id); transaction.set("balance_before", before); transaction.set("balance_after", before + selected.amount)
      txApp.save(transaction)
    }
    response = { id: spin.id, prizeName: selected.name, prizeAmount: Number(selected.amount) || 0, alreadySpun: false }
  })
  return c.json(200, response)
})
