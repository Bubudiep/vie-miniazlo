/// <reference path="../pb_data/types.d.ts" />

routerUse((c) => {
  const request = c.request
  const path = request.url.path
  if (!path.startsWith("/api/xu/") && !path.startsWith("/api/admin/xu/")) return c.next()

  const method = request.method.toUpperCase()
  const info = c.requestInfo()
  let auth = info.authRecord || info.auth || c.auth || null
  if (auth && auth.collection().name !== "users") auth = null
  if (!auth) {
    const authToken = String(info.headers.Authorization || info.headers.authorization || "").replace(/^Bearer\s+/i, "").trim()
    if (authToken) {
      try {
        const tokenRecord = $app.findAuthRecordByToken(authToken, "auth")
        if (tokenRecord.collection().name === "users") auth = tokenRecord
      } catch (e) {}
    }
  }
  const body = info.body || info.data || {}
  const query = request.url.query()

  const requireAuth = () => {
    if (!auth) throw new UnauthorizedError("Cần đăng nhập")
    return auth
  }
  const requireStore = (record) => {
    const store = String(record.get("store") || "")
    if (!store) throw new ForbiddenError("Tài khoản chưa thuộc cửa hàng")
    return store
  }
  const requireApproved = (record) => {
    if (!record.getBool("is_approved")) throw new ForbiddenError("Tài khoản đang chờ cửa hàng phê duyệt")
    return record
  }
  const requireAdmin = (record) => {
    if (record.get("role") !== "admin") throw new ForbiddenError("Chỉ admin cửa hàng mới được thao tác")
    requireStore(record)
    return record
  }
  const findUser = (id) => {
    try { return $app.findRecordById("users", id) } catch (e) { throw new BadRequestError("Không tìm thấy tài khoản") }
  }
  const assertSameStore = (caller, target) => {
    const store = requireStore(caller)
    if (String(target.get("store") || "") !== store) throw new ForbiddenError("Tài khoản khác cửa hàng")
    return store
  }
  const positiveInteger = (value, field, allowZero = false) => {
    const number = Number(value)
    if (!Number.isSafeInteger(number) || number < (allowZero ? 0 : 1) || number > 1000000000) {
      throw new BadRequestError(field + (allowZero ? " phải là số nguyên không âm" : " phải là số nguyên dương"))
    }
    return number
  }
  const accountFor = (app, userId, storeId) => {
    try {
      return app.findFirstRecordByFilter("xu_accounts", "user = {:user} && store = {:store}", { user: userId, store: storeId })
    } catch (e) {
      const account = new Record(app.findCollectionByNameOrId("xu_accounts"))
      account.set("user", userId)
      account.set("store", storeId)
      account.set("balance", 0)
      app.save(account)
      return account
    }
  }
  const settingsFor = (app, storeId) => {
    try {
      return app.findFirstRecordByFilter("xu_settings", "store = {:store}", { store: storeId })
    } catch (e) {
      const settings = new Record(app.findCollectionByNameOrId("xu_settings"))
      settings.set("store", storeId)
      settings.set("daily_checkin_reward", 0)
      settings.set("weekly_checkin_reward", 0)
      settings.set("referral_reward", 0)
      settings.set("referral_5_reward", 0)
      settings.set("referral_10_reward", 0)
      app.save(settings)
      return settings
    }
  }
  const applyDelta = (app, input) => {
    const account = accountFor(app, input.userId, input.storeId)
    let prior
    try {
      prior = app.findFirstRecordByFilter("xu_transactions", "idempotency_key = {:key}", { key: input.idempotencyKey })
    } catch (e) {}
    if (prior) return { account, transaction: prior, alreadyApplied: true }

    const before = Number(account.get("balance")) || 0
    const after = input.direction === "credit" ? before + input.amount : before - input.amount
    if (after < 0) throw new BadRequestError("Số dư Xu không đủ")

    account.set("balance", after)
    app.save(account)

    const transaction = new Record(app.findCollectionByNameOrId("xu_transactions"))
    transaction.set("account", account.id)
    transaction.set("user", input.userId)
    transaction.set("store", input.storeId)
    transaction.set("direction", input.direction)
    transaction.set("amount", input.amount)
    transaction.set("reason", input.reason)
    transaction.set("actor", input.actor || "")
    transaction.set("reference_type", input.referenceType || "")
    transaction.set("reference_id", input.referenceId || "")
    transaction.set("idempotency_key", input.idempotencyKey)
    transaction.set("balance_before", before)
    transaction.set("balance_after", after)
    app.save(transaction)
    return { account, transaction, alreadyApplied: false }
  }
  const accountSummary = (account) => ({
    id: account.id,
    user: account.get("user"),
    store: account.get("store"),
    balance: Number(account.get("balance")) || 0
  })
  const transactionJson = (item) => ({
    id: item.id,
    account: item.get("account"),
    user: item.get("user"),
    store: item.get("store"),
    direction: item.get("direction"),
    amount: Number(item.get("amount")) || 0,
    reason: item.get("reason"),
    actor: item.get("actor") || "",
    referenceType: item.get("reference_type") || "",
    referenceId: item.get("reference_id") || "",
    balanceBefore: Number(item.get("balance_before")) || 0,
    balanceAfter: Number(item.get("balance_after")) || 0,
    created: item.get("created")
  })
  const pagedTransactions = (filter, params) => {
    const all = $app.findRecordsByFilter("xu_transactions", filter, "-created", -1, 0, params)
    const page = Math.max(1, Number(query.get("page") || 1))
    const perPage = Math.min(50, Math.max(1, Number(query.get("perPage") || 20)))
    const start = (page - 1) * perPage
    return { page, perPage, totalItems: all.length, items: all.slice(start, start + perPage).map(transactionJson) }
  }
  const settingsJson = (item) => ({
    store: item.get("store"),
    dailyCheckinReward: Number(item.get("daily_checkin_reward")) || 0,
    weeklyCheckinReward: Number(item.get("weekly_checkin_reward")) || 0,
    referralReward: Number(item.get("referral_reward")) || 0,
    referral5Reward: Number(item.get("referral_5_reward")) || 0,
    referral10Reward: Number(item.get("referral_10_reward")) || 0
  })
  const rewardJson = (item) => ({
    id: item.id,
    store: item.get("store"),
    name: item.get("name"),
    description: item.get("description") || "",
    cost: Number(item.get("cost")) || 0,
    stock: Number(item.get("stock")) || 0,
    active: item.getBool("active"),
    created: item.get("created")
  })
  const redemptionJson = (item) => ({
    id: item.id,
    user: item.get("user"),
    store: item.get("store"),
    reward: item.get("reward") || "",
    rewardName: item.get("reward_name"),
    cost: Number(item.get("cost")) || 0,
    status: item.get("status"),
    note: item.get("note") || "",
    created: item.get("created"),
    updated: item.get("updated")
  })
  const localCheckinDate = () => {
    const date = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const monday = new Date(date + "T00:00:00Z")
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7))
    return { date, week: monday.toISOString().slice(0, 10) }
  }
  const processReferralForUser = (app, user, actorId) => {
    const code = String(user.get("pending_xu_referral_code") || "")
    if (!code || !user.getBool("is_approved")) return
    const storeId = String(user.get("store") || "")
    let referral
    try {
      referral = app.findFirstRecordByFilter("xu_referrals", "referred = {:user} && store = {:store}", { user: user.id, store: storeId })
    } catch (e) {
      let referrer
      try { referrer = app.findFirstRecordByFilter("users", "xu_referral_code = {:code} && store = {:store}", { code, store: storeId }) } catch (err) { throw new BadRequestError("Mã giới thiệu không còn hợp lệ") }
      referral = new Record(app.findCollectionByNameOrId("xu_referrals"))
      referral.set("referrer", referrer.id)
      referral.set("referred", user.id)
      referral.set("store", storeId)
      referral.set("used_code", code)
      referral.set("status", "pending")
      referral.set("reward_amount", 0)
      app.save(referral)
    }
    if (referral.get("status") === "approved") return

    const settings = settingsFor(app, storeId)
    const referrerId = String(referral.get("referrer"))
    const referralReward = Number(settings.get("referral_reward")) || 0
    if (referralReward > 0) {
      applyDelta(app, { userId: referrerId, storeId, direction: "credit", amount: referralReward, reason: "Thưởng giới thiệu tài khoản được duyệt", actor: actorId, referenceType: "referral", referenceId: user.id, idempotencyKey: "referral-" + storeId + "-" + user.id })
    }
    referral.set("status", "approved")
    referral.set("approved_at", new Date().toISOString())
    referral.set("reward_amount", referralReward)
    app.save(referral)

    const approved = app.findRecordsByFilter("xu_referrals", "referrer = {:user} && store = {:store} && status = 'approved'", "created", -1, 0, { user: referrerId, store: storeId })
    for (const milestoneCount of [5, 10]) {
      if (approved.length < milestoneCount) continue
      let claimed
      try { claimed = app.findFirstRecordByFilter("xu_milestones", "user = {:user} && store = {:store} && referral_count = {:count}", { user: referrerId, store: storeId, count: milestoneCount }) } catch (e) {}
      if (claimed) continue
      const rewardField = milestoneCount === 5 ? "referral_5_reward" : "referral_10_reward"
      const milestoneReward = Number(settings.get(rewardField)) || 0
      let transactionId = ""
      if (milestoneReward > 0) {
        const applied = applyDelta(app, { userId: referrerId, storeId, direction: "credit", amount: milestoneReward, reason: "Thưởng " + milestoneCount + " lượt giới thiệu được duyệt", actor: actorId, referenceType: "referral_milestone", referenceId: String(milestoneCount), idempotencyKey: "referral-milestone-" + storeId + "-" + referrerId + "-" + milestoneCount })
        transactionId = applied.transaction.id
      }
      const milestone = new Record(app.findCollectionByNameOrId("xu_milestones"))
      milestone.set("user", referrerId)
      milestone.set("store", storeId)
      milestone.set("referral_count", milestoneCount)
      milestone.set("reward_amount", milestoneReward)
      milestone.set("transaction_id", transactionId)
      app.save(milestone)
    }
  }

  const caller = requireApproved(requireAuth())
  const callerStore = requireStore(caller)

  if (method === "GET" && path === "/api/xu/me") {
    const period = localCheckinDate()
    let checkedInToday = false
    try { $app.findFirstRecordByFilter("xu_checkins", "user = {:user} && store = {:store} && local_date = {:date}", { user: caller.id, store: callerStore, date: period.date }); checkedInToday = true } catch (e) {}
    const weeklyCheckins = $app.findRecordsByFilter("xu_checkins", "user = {:user} && store = {:store} && week_key = {:week}", "created", -1, 0, { user: caller.id, store: callerStore, week: period.week })
    return c.json(200, Object.assign(accountSummary(accountFor($app, caller.id, callerStore)), { checkedInToday, weeklyCheckinCount: weeklyCheckins.length }))
  }
  if (method === "GET" && path === "/api/xu/me/transactions") {
    const account = accountFor($app, caller.id, callerStore)
    return c.json(200, pagedTransactions("account = {:account} && user = {:user} && store = {:store}", { account: account.id, user: caller.id, store: callerStore }))
  }
  if (method === "POST" && path === "/api/xu/checkin") {
    let result
    $app.runInTransaction((txApp) => {
      const account = accountFor(txApp, caller.id, callerStore)
      const period = localCheckinDate()
      try {
        const existing = txApp.findFirstRecordByFilter("xu_checkins", "user = {:user} && store = {:store} && local_date = {:date}", { user: caller.id, store: callerStore, date: period.date })
        result = { checkedIn: true, alreadyCheckedIn: true, dailyReward: Number(existing.get("daily_reward")) || 0, weeklyReward: Number(existing.get("weekly_reward")) || 0, balance: Number(account.get("balance")) || 0 }
        return
      } catch (e) {}

      const settings = settingsFor(txApp, callerStore)
      const earlier = txApp.findRecordsByFilter("xu_checkins", "user = {:user} && store = {:store} && week_key = {:week}", "created", -1, 0, { user: caller.id, store: callerStore, week: period.week })
      const dailyReward = Number(settings.get("daily_checkin_reward")) || 0
      const weeklyReward = earlier.length === 6 ? Number(settings.get("weekly_checkin_reward")) || 0 : 0
      const checkin = new Record(txApp.findCollectionByNameOrId("xu_checkins"))
      checkin.set("user", caller.id)
      checkin.set("store", callerStore)
      checkin.set("local_date", period.date)
      checkin.set("week_key", period.week)
      checkin.set("daily_reward", dailyReward)
      checkin.set("weekly_reward", weeklyReward)

      const transactionIds = []
      let currentAccount = account
      if (dailyReward > 0) {
        const applied = applyDelta(txApp, { userId: caller.id, storeId: callerStore, direction: "credit", amount: dailyReward, reason: "Điểm danh hằng ngày", actor: caller.id, referenceType: "checkin", referenceId: period.date, idempotencyKey: "checkin-day-" + callerStore + "-" + caller.id + "-" + period.date })
        transactionIds.push(applied.transaction.id)
        currentAccount = applied.account
      }
      if (weeklyReward > 0) {
        const applied = applyDelta(txApp, { userId: caller.id, storeId: callerStore, direction: "credit", amount: weeklyReward, reason: "Thưởng điểm danh đủ 7 ngày trong tuần", actor: caller.id, referenceType: "checkin_week", referenceId: period.week, idempotencyKey: "checkin-week-" + callerStore + "-" + caller.id + "-" + period.week })
        transactionIds.push(applied.transaction.id)
        currentAccount = applied.account
      }
      checkin.set("transaction_ids", transactionIds.join(","))
      txApp.save(checkin)
      result = { checkedIn: true, alreadyCheckedIn: false, dailyReward, weeklyReward, balance: Number(currentAccount.get("balance")) || 0 }
    })
    return c.json(200, result)
  }
  if (method === "GET" && path === "/api/xu/referral") {
    let code = ""
    $app.runInTransaction((txApp) => {
      const current = txApp.findRecordById("users", caller.id)
      code = String(current.get("xu_referral_code") || "")
      processReferralForUser(txApp, current, caller.id)
      if (!code) {
        for (let attempt = 0; attempt < 10; attempt++) {
          const candidate = $security.randomStringWithAlphabet(9, "ABCDEFGHJKLMNPQRSTUVWXYZ23456789")
          let prior
          try { prior = txApp.findFirstRecordByFilter("users", "xu_referral_code = {:code}", { code: candidate }) } catch (e) {}
          if (!prior) { current.set("xu_referral_code", candidate); txApp.save(current); code = candidate; break }
        }
        if (!code) throw new BadRequestError("Không thể tạo mã giới thiệu lúc này")
      }
    })
    const referrals = $app.findRecordsByFilter("xu_referrals", "referrer = {:user} && store = {:store}", "-created", -1, 0, { user: caller.id, store: callerStore })
    const milestones = $app.findRecordsByFilter("xu_milestones", "user = {:user} && store = {:store}", "referral_count", -1, 0, { user: caller.id, store: callerStore })
    return c.json(200, {
      code,
      approvedCount: referrals.filter((item) => item.get("status") === "approved").length,
      pendingCount: referrals.filter((item) => item.get("status") === "pending").length,
      milestones: milestones.map((item) => Number(item.get("referral_count")) || 0)
    })
  }
  if (method === "GET" && path === "/api/xu/rewards") {
    const rewards = $app.findRecordsByFilter("xu_rewards", "store = {:store} && active = true", "cost,name", 100, 0, { store: callerStore })
    return c.json(200, rewards.map(rewardJson))
  }
  if (method === "POST" && path === "/api/xu/redeem") {
    const rewardId = String(body.rewardId || "")
    const idempotencyKey = String(body.idempotencyKey || "").trim()
    if (!rewardId || !idempotencyKey || idempotencyKey.length > 120) throw new BadRequestError("Yêu cầu đổi quà chưa hợp lệ")
    let result
    $app.runInTransaction((txApp) => {
      const key = "redeem-" + callerStore + "-" + caller.id + "-" + idempotencyKey
      try {
        const prior = txApp.findFirstRecordByFilter("xu_redemptions", "idempotency_key = {:key}", { key })
        result = redemptionJson(prior)
        return
      } catch (e) {}
      let reward
      try { reward = txApp.findRecordById("xu_rewards", rewardId) } catch (e) { throw new BadRequestError("Không tìm thấy quà tặng") }
      if (reward.get("store") !== callerStore || !reward.getBool("active")) throw new BadRequestError("Quà tặng không còn khả dụng tại cửa hàng này")
      const cost = positiveInteger(reward.get("cost"), "Giá đổi quà")
      const stock = Number(reward.get("stock")) || 0
      if (stock <= 0) throw new BadRequestError("Quà tặng đã hết hàng")
      const account = accountFor(txApp, caller.id, callerStore)
      if ((Number(account.get("balance")) || 0) < cost) throw new BadRequestError("Số dư Xu không đủ")
      const redemption = new Record(txApp.findCollectionByNameOrId("xu_redemptions"))
      redemption.set("user", caller.id)
      redemption.set("store", callerStore)
      redemption.set("reward", reward.id)
      redemption.set("reward_name", reward.get("name"))
      redemption.set("cost", cost)
      redemption.set("status", "pending")
      redemption.set("idempotency_key", key)
      txApp.save(redemption)
      applyDelta(txApp, { userId: caller.id, storeId: callerStore, direction: "debit", amount: cost, reason: "Đổi quà: " + reward.get("name"), actor: caller.id, referenceType: "redemption", referenceId: redemption.id, idempotencyKey: "redeem-debit-" + callerStore + "-" + caller.id + "-" + idempotencyKey })
      reward.set("stock", stock - 1)
      txApp.save(reward)
      result = redemptionJson(redemption)
    })
    return c.json(200, result)
  }
  if (method === "GET" && path === "/api/xu/redemptions") {
    const items = $app.findRecordsByFilter("xu_redemptions", "user = {:user} && store = {:store}", "-created", 100, 0, { user: caller.id, store: callerStore })
    return c.json(200, items.map(redemptionJson))
  }

  if (path.startsWith("/api/admin/xu/")) {
    requireAdmin(caller)
    const store = callerStore
    if (method === "GET" && path === "/api/admin/xu/settings") {
      return c.json(200, settingsJson(settingsFor($app, store)))
    }
    if (method === "PATCH" && path === "/api/admin/xu/settings") {
      const values = {
        daily_checkin_reward: positiveInteger(body.dailyCheckinReward, "Thưởng điểm danh", true),
        weekly_checkin_reward: positiveInteger(body.weeklyCheckinReward, "Thưởng tuần", true),
        referral_reward: positiveInteger(body.referralReward, "Thưởng giới thiệu", true),
        referral_5_reward: positiveInteger(body.referral5Reward, "Thưởng mốc 5", true),
        referral_10_reward: positiveInteger(body.referral10Reward, "Thưởng mốc 10", true)
      }
      let result
      $app.runInTransaction((txApp) => {
        const settings = settingsFor(txApp, store)
        for (const key in values) settings.set(key, values[key])
        settings.set("updated_by", caller.id)
        txApp.save(settings)
        result = settingsJson(settings)
      })
      return c.json(200, result)
    }
    if (method === "GET" && path === "/api/admin/xu/users") {
      const q = String(query.get("q") || "").trim()
      const filter = q ? "store = {:store} && (username ~ {:query} || fullname ~ {:query} || phone ~ {:query})" : "store = {:store}"
      const users = $app.findRecordsByFilter("users", filter, "username", 100, 0, { store, query: q })
      return c.json(200, users.map((item) => {
        let account
        let referrals
        try { account = $app.findFirstRecordByFilter("xu_accounts", "user = {:user} && store = {:store}", { user: item.id, store }) } catch (e) {}
        referrals = $app.findRecordsByFilter("xu_referrals", "referrer = {:user} && store = {:store} && status = 'approved'", "created", -1, 0, { user: item.id, store })
        return { id: item.id, username: item.get("username"), fullname: item.get("fullname") || "", phone: item.get("phone") || "", isApproved: item.getBool("is_approved"), balance: account ? Number(account.get("balance")) || 0 : 0, approvedReferrals: referrals.length }
      }))
    }
    if (method === "POST" && path === "/api/admin/xu/adjust") {
      const userId = String(body.userId || "")
      const direction = String(body.direction || "")
      const amount = positiveInteger(body.amount, "Số Xu")
      const reason = String(body.reason || "").trim()
      const rawKey = String(body.idempotencyKey || "").trim()
      if (!userId || !reason || reason.length > 500 || !rawKey || rawKey.length > 120) throw new BadRequestError("Vui lòng nhập tài khoản, số Xu, lý do và mã yêu cầu hợp lệ")
      if (!["credit", "debit"].includes(direction)) throw new BadRequestError("Loại điều chỉnh không hợp lệ")
      const target = findUser(userId)
      assertSameStore(caller, target)
      let result
      $app.runInTransaction((txApp) => {
        const applied = applyDelta(txApp, { userId: target.id, storeId: store, direction, amount, reason, actor: caller.id, referenceType: "admin_adjustment", referenceId: caller.id, idempotencyKey: "adjust-" + store + "-" + target.id + "-" + rawKey })
        result = accountSummary(applied.account)
      })
      return c.json(200, result)
    }

    const rewardMatch = path.match(/^\/api\/admin\/xu\/rewards(?:\/([^/]+))?$/)
    if (rewardMatch && method === "GET" && !rewardMatch[1]) {
      const items = $app.findRecordsByFilter("xu_rewards", "store = {:store}", "-created", 100, 0, { store })
      return c.json(200, items.map(rewardJson))
    }
    if (rewardMatch && method === "POST" && !rewardMatch[1]) {
      const name = String(body.name || "").trim()
      const description = String(body.description || "").trim()
      const cost = positiveInteger(body.cost, "Giá Xu")
      const stock = positiveInteger(body.stock, "Tồn kho", true)
      if (!name || name.length > 120 || description.length > 500) throw new BadRequestError("Tên hoặc mô tả quà tặng không hợp lệ")
      const reward = new Record($app.findCollectionByNameOrId("xu_rewards"))
      reward.set("store", store)
      reward.set("name", name)
      reward.set("description", description)
      reward.set("cost", cost)
      reward.set("stock", stock)
      reward.set("active", body.active !== false)
      $app.save(reward)
      return c.json(200, rewardJson(reward))
    }
    if (rewardMatch && (method === "PATCH" || method === "DELETE") && rewardMatch[1]) {
      let reward
      try { reward = $app.findRecordById("xu_rewards", rewardMatch[1]) } catch (e) { throw new BadRequestError("Không tìm thấy quà tặng") }
      if (reward.get("store") !== store) throw new ForbiddenError("Quà tặng khác cửa hàng")
      if (method === "DELETE") {
        reward.set("active", false)
      } else {
        if (body.name !== undefined) {
          const name = String(body.name || "").trim()
          if (!name || name.length > 120) throw new BadRequestError("Tên quà tặng không hợp lệ")
          reward.set("name", name)
        }
        if (body.description !== undefined) {
          const description = String(body.description || "").trim()
          if (description.length > 500) throw new BadRequestError("Mô tả quà tặng quá dài")
          reward.set("description", description)
        }
        if (body.cost !== undefined) reward.set("cost", positiveInteger(body.cost, "Giá Xu"))
        if (body.stock !== undefined) reward.set("stock", positiveInteger(body.stock, "Tồn kho", true))
        if (body.active !== undefined) {
          if (typeof body.active !== "boolean") throw new BadRequestError("Trạng thái quà tặng không hợp lệ")
          reward.set("active", body.active)
        }
      }
      $app.save(reward)
      return c.json(200, rewardJson(reward))
    }

    if (method === "GET" && path === "/api/admin/xu/redemptions") {
      const status = String(query.get("status") || "")
      const filter = status ? "store = {:store} && status = {:status}" : "store = {:store}"
      const params = status ? { store, status } : { store }
      const items = $app.findRecordsByFilter("xu_redemptions", filter, "-created", 100, 0, params)
      return c.json(200, items.map((item) => {
        const result = redemptionJson(item)
        const customer = findUser(item.get("user"))
        result.username = customer.get("username")
        result.fullname = customer.get("fullname") || ""
        return result
      }))
    }
    const redemptionMatch = path.match(/^\/api\/admin\/xu\/redemptions\/([^/]+)$/)
    if (method === "PATCH" && redemptionMatch) {
      const requestedStatus = String(body.status || "")
      if (!["approved", "rejected", "fulfilled"].includes(requestedStatus)) throw new BadRequestError("Trạng thái đổi quà không hợp lệ")
      let result
      $app.runInTransaction((txApp) => {
        let redemption
        try { redemption = txApp.findRecordById("xu_redemptions", redemptionMatch[1]) } catch (e) { throw new BadRequestError("Không tìm thấy yêu cầu đổi quà") }
        if (redemption.get("store") !== store) throw new ForbiddenError("Yêu cầu khác cửa hàng")
        const current = String(redemption.get("status"))
        if (current === requestedStatus) { result = redemptionJson(redemption); return }
        if (requestedStatus === "approved" && current !== "pending") throw new BadRequestError("Chỉ có thể duyệt yêu cầu đang chờ")
        if (requestedStatus === "rejected") {
          if (current !== "pending") throw new BadRequestError("Chỉ có thể từ chối yêu cầu đang chờ")
          const user = findUser(redemption.get("user"))
          const refund = applyDelta(txApp, { userId: user.id, storeId: store, direction: "credit", amount: Number(redemption.get("cost")) || 0, reason: "Hoàn Xu do từ chối đổi quà: " + redemption.get("reward_name"), actor: caller.id, referenceType: "redemption_refund", referenceId: redemption.id, idempotencyKey: "redemption-refund-" + redemption.id })
          const rewardId = String(redemption.get("reward") || "")
          if (rewardId) {
            let reward
            try { reward = txApp.findRecordById("xu_rewards", rewardId) } catch (e) {}
            if (reward && reward.get("store") === store) {
              reward.set("stock", (Number(reward.get("stock")) || 0) + 1)
              txApp.save(reward)
            }
          }
          redemption.set("note", String(body.note || "").trim().slice(0, 500))
        } else if (requestedStatus === "fulfilled" && current !== "approved") {
          throw new BadRequestError("Chỉ có thể hoàn tất yêu cầu đã duyệt")
        }
        redemption.set("status", requestedStatus)
        redemption.set("handled_by", caller.id)
        txApp.save(redemption)
        result = redemptionJson(redemption)
      })
      return c.json(200, result)
    }
  }

  return c.json(404, { error: "Không tìm thấy API Xu" })
})

for (const method of ["GET", "POST", "PATCH", "DELETE"]) {
  routerAdd(method, "/api/xu/{path...}", (c) => c.json(404, { error: "Không tìm thấy API Xu" }))
  routerAdd(method, "/api/admin/xu/{path...}", (c) => c.json(404, { error: "Không tìm thấy API Xu" }))
}
