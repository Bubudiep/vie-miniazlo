/// <reference path="../pb_data/types.d.ts" />

routerAdd("GET", "/api/registration/stores", (c) => {
  const stores = $app.findAllRecords("stores")
  return c.json(200, stores.map((store) => ({ id: store.id, name: store.get("name") })))
})

routerAdd("POST", "/api/registration/register", (c) => {
  const input = c.requestInfo().body || {}
  const username = String(input.username || "").trim().toLowerCase()
  const password = String(input.password || "")
  const passwordConfirm = String(input.passwordConfirm || "")
  const fullname = String(input.fullname || "").trim()
  const phone = String(input.phone || "").trim()
  const storeId = String(input.store || "")
  const referralCode = String(input.referralCode || "").trim().toUpperCase()

  if (!/^[a-z0-9._-]{3,100}$/.test(username)) throw new BadRequestError("Tên đăng nhập không hợp lệ")
  if (password.length < 8 || password !== passwordConfirm) throw new BadRequestError("Mật khẩu cần có ít nhất 8 ký tự và xác nhận chính xác")
  if (!fullname) throw new BadRequestError("Vui lòng nhập họ tên")
  if (!/^(?:0[35789]|\+84[35789])\d{8}$/.test(phone)) throw new BadRequestError("Số điện thoại không hợp lệ")
  if (!storeId) throw new BadRequestError("Vui lòng chọn cửa hàng")
  if (input.role || input.is_approved || input.is_system_admin || input.is_internal || input.xu_referral_code) throw new BadRequestError("Không thể tự cấp quyền tài khoản")

  const existing = new DynamicModel({ count: 0 })
  $app.db().newQuery("SELECT COUNT(*) AS count FROM users WHERE LOWER(username) = LOWER({:username})").bind({ username }).one(existing)
  if (Number(existing.count) > 0) throw new BadRequestError("Tên đăng nhập đã được sử dụng")

  let store
  try { store = $app.findRecordById("stores", storeId) } catch (e) { throw new BadRequestError("Cửa hàng không tồn tại") }
  let referrer = null
  if (referralCode) {
    if (!/^[A-Z0-9]{4,16}$/.test(referralCode)) throw new BadRequestError("Mã giới thiệu không hợp lệ")
    try { referrer = $app.findFirstRecordByFilter("users", "xu_referral_code = {:code} && store = {:store}", { code: referralCode, store: storeId }) } catch (e) { throw new BadRequestError("Mã giới thiệu không tồn tại tại cửa hàng này") }
    if (!referrer.getBool("is_approved")) throw new BadRequestError("Mã giới thiệu không khả dụng")
  }

  let ownCode = ""
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = $security.randomStringWithAlphabet(9, "ABCDEFGHJKLMNPQRSTUVWXYZ23456789")
    const found = new DynamicModel({ count: 0 })
    $app.db().newQuery("SELECT COUNT(*) AS count FROM users WHERE xu_referral_code = {:code}").bind({ code: candidate }).one(found)
    if (Number(found.count) === 0) { ownCode = candidate; break }
  }
  if (!ownCode) throw new BadRequestError("Không thể tạo mã giới thiệu lúc này, vui lòng thử lại")

  const user = new Record($app.findCollectionByNameOrId("users"))
  user.set("username", username)
  user.setPassword(password)
  user.set("fullname", fullname)
  user.set("phone", phone)
  user.set("store", storeId)
  user.set("role", "user")
  user.set("is_approved", !store.getBool("approval_required"))
  user.set("xu_referral_code", ownCode)
  user.set("pending_xu_referral_code", referralCode)
  $app.save(user)
  return c.json(201, { id: user.id, username: user.get("username"), fullname: user.get("fullname"), store: storeId, is_approved: user.getBool("is_approved") })
})

routerAdd("GET", "/api/admin/registration", (c) => {
  const auth = c.requestInfo().auth || c.auth
  if (!auth) throw new UnauthorizedError("Cần đăng nhập")
  if (auth.get("role") !== "admin" || !auth.get("store")) throw new ForbiddenError("Chỉ admin cửa hàng mới được thao tác")
  const storeId = String(auth.get("store"))
  const store = $app.findRecordById("stores", storeId)
  const users = $app.findRecordsByFilter("users", "store = {:store} && is_approved = false", "created", -1, 0, { store: storeId })
  return c.json(200, {
    approvalRequired: store.getBool("approval_required"),
    users: users.map((user) => ({ id: user.id, username: user.get("username"), fullname: user.get("fullname"), phone: user.get("phone") })),
  })
})

routerAdd("PATCH", "/api/admin/registration", (c) => {
  const info = c.requestInfo()
  const auth = info.auth || c.auth
  if (!auth) throw new UnauthorizedError("Cần đăng nhập")
  if (auth.get("role") !== "admin" || !auth.get("store")) throw new ForbiddenError("Chỉ admin cửa hàng mới được thao tác")
  const value = (info.body || {}).approvalRequired
  if (typeof value !== "boolean") throw new BadRequestError("Trạng thái phê duyệt không hợp lệ")
  const store = $app.findRecordById("stores", String(auth.get("store")))
  store.set("approval_required", value)
  $app.save(store)
  return c.json(200, { approvalRequired: store.getBool("approval_required") })
})

routerAdd("POST", "/api/admin/registration/{id}/approve", (c) => {
  const auth = c.requestInfo().auth || c.auth
  if (!auth) throw new UnauthorizedError("Cần đăng nhập")
  if (auth.get("role") !== "admin" || !auth.get("store")) throw new ForbiddenError("Chỉ admin cửa hàng mới được thao tác")
  const userId = c.request.pathValue("id")
  const storeId = String(auth.get("store"))
  let result

  $app.runInTransaction((txApp) => {
    const user = txApp.findRecordById("users", userId)
    if (user.get("store") !== storeId) throw new ForbiddenError("Tài khoản khác cửa hàng")
    if (!user.getBool("is_approved")) {
      user.set("is_approved", true)
      txApp.save(user)
    }

    const code = String(user.get("pending_xu_referral_code") || "")
    if (code) {
      let referral
      try {
        referral = txApp.findFirstRecordByFilter("xu_referrals", "referred = {:user} && store = {:store}", { user: user.id, store: storeId })
      } catch (e) {
        let referrer
        try { referrer = txApp.findFirstRecordByFilter("users", "xu_referral_code = {:code} && store = {:store}", { code, store: storeId }) } catch (err) { throw new BadRequestError("Mã giới thiệu không còn hợp lệ") }
        referral = new Record(txApp.findCollectionByNameOrId("xu_referrals"))
        referral.set("referrer", referrer.id)
        referral.set("referred", user.id)
        referral.set("store", storeId)
        referral.set("used_code", code)
        referral.set("status", "pending")
        referral.set("reward_amount", 0)
        txApp.save(referral)
      }

      if (referral.get("status") !== "approved") {
        let settings
        try { settings = txApp.findFirstRecordByFilter("xu_settings", "store = {:store}", { store: storeId }) } catch (e) {}
        const referralReward = settings ? Number(settings.get("referral_reward")) || 0 : 0
        const referrerId = String(referral.get("referrer"))
        let account
        try { account = txApp.findFirstRecordByFilter("xu_accounts", "user = {:user} && store = {:store}", { user: referrerId, store: storeId }) } catch (e) {
          account = new Record(txApp.findCollectionByNameOrId("xu_accounts"))
          account.set("user", referrerId)
          account.set("store", storeId)
          account.set("balance", 0)
          txApp.save(account)
        }

        const creditXu = (amount, reason, referenceType, referenceId, idempotencyKey) => {
          if (amount <= 0) return ""
          let prior
          try { prior = txApp.findFirstRecordByFilter("xu_transactions", "idempotency_key = {:key}", { key: idempotencyKey }) } catch (e) {}
          if (prior) return prior.id
          const before = Number(account.get("balance")) || 0
          account.set("balance", before + amount)
          txApp.save(account)
          const transaction = new Record(txApp.findCollectionByNameOrId("xu_transactions"))
          transaction.set("account", account.id)
          transaction.set("user", referrerId)
          transaction.set("store", storeId)
          transaction.set("direction", "credit")
          transaction.set("amount", amount)
          transaction.set("reason", reason)
          transaction.set("actor", user.id)
          transaction.set("reference_type", referenceType)
          transaction.set("reference_id", referenceId)
          transaction.set("idempotency_key", idempotencyKey)
          transaction.set("balance_before", before)
          transaction.set("balance_after", before + amount)
          txApp.save(transaction)
          return transaction.id
        }

        creditXu(referralReward, "Thưởng giới thiệu tài khoản được duyệt", "referral", user.id, "referral-" + storeId + "-" + user.id)
        referral.set("status", "approved")
        referral.set("approved_at", new Date().toISOString())
        referral.set("reward_amount", referralReward)
        txApp.save(referral)

        const approved = txApp.findRecordsByFilter("xu_referrals", "referrer = {:user} && store = {:store} && status = 'approved'", "created", -1, 0, { user: referrerId, store: storeId })
        for (const milestoneCount of [5, 10]) {
          if (approved.length < milestoneCount) continue
          let claimed
          try { claimed = txApp.findFirstRecordByFilter("xu_milestones", "user = {:user} && store = {:store} && referral_count = {:count}", { user: referrerId, store: storeId, count: milestoneCount }) } catch (e) {}
          if (claimed) continue
          const rewardField = milestoneCount === 5 ? "referral_5_reward" : "referral_10_reward"
          const milestoneReward = settings ? Number(settings.get(rewardField)) || 0 : 0
          const transactionId = creditXu(milestoneReward, "Thưởng " + milestoneCount + " lượt giới thiệu được duyệt", "referral_milestone", String(milestoneCount), "referral-milestone-" + referrerId + "-" + milestoneCount)
          const milestone = new Record(txApp.findCollectionByNameOrId("xu_milestones"))
          milestone.set("user", referrerId)
          milestone.set("store", storeId)
          milestone.set("referral_count", milestoneCount)
          milestone.set("reward_amount", milestoneReward)
          milestone.set("transaction_id", transactionId)
          txApp.save(milestone)
        }
      }
    }

    result = { id: user.id, is_approved: user.getBool("is_approved") }
  })
  return c.json(200, result)
})
