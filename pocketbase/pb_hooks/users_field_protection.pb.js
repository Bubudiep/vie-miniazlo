/// <reference path="../pb_data/types.d.ts" />

// Keep registration privileges controlled by the server.

onRecordCreateRequest((e) => {
  const username = String(e.record.get("username") || "")
  const existingUser = new DynamicModel({ count: 0 })
  $app.db().newQuery("SELECT COUNT(*) AS count FROM users WHERE LOWER(username) = LOWER({:username})").bind({ username }).one(existingUser)
  if (Number(existingUser.count) > 0) {
    throw new BadRequestError("Tên đăng nhập đã được sử dụng")
  }
  e.record.set("username", username.toLowerCase())

  if (e.hasSuperuserAuth()) {
    if (!e.record.get("xu_referral_code")) {
      for (let attempt = 0; attempt < 10; attempt++) {
        const code = $security.randomStringWithAlphabet(9, "ABCDEFGHJKLMNPQRSTUVWXYZ23456789")
        const found = new DynamicModel({ count: 0 })
        $app.db().newQuery("SELECT COUNT(*) AS count FROM users WHERE xu_referral_code = {:code}").bind({ code }).one(found)
        if (Number(found.count) === 0) { e.record.set("xu_referral_code", code); break }
      }
    }
    return e.next()
  }

  const storeId = String(e.record.get("store") || "")
  if (!storeId) throw new BadRequestError("Vui lòng chọn cửa hàng")
  let store
  try {
    store = $app.findRecordById("stores", storeId)
  } catch (err) {
    throw new BadRequestError("Cửa hàng không tồn tại")
  }

  const phone = String(e.record.get("phone") || "").trim()
  if (!/^(?:0[35789]|\+84[35789])\d{8}$/.test(phone)) {
    throw new BadRequestError("Số điện thoại không hợp lệ")
  }
  const fullname = String(e.record.get("fullname") || "").trim()
  if (!fullname) {
    throw new BadRequestError("Vui lòng nhập họ tên")
  }
  if (e.record.get("role") || e.record.get("zalo_id") || e.record.get("employee_code") || e.record.getBool("is_system_admin") || e.record.getBool("is_internal") || e.record.getBool("is_approved")) {
    throw new BadRequestError("Không thể tự cấp quyền tài khoản")
  }

  e.record.set("fullname", fullname)
  e.record.set("phone", phone)
  e.record.set("role", "user")
  e.record.set("is_approved", !store.getBool("approval_required"))

  const registrationBody = e.requestInfo().body || {}
  const suppliedCode = String(registrationBody.pending_xu_referral_code || "").trim().toUpperCase()
  if (registrationBody.xu_referral_code) throw new BadRequestError("Mã giới thiệu không hợp lệ")
  if (suppliedCode) {
    if (!/^[A-Z0-9]{4,16}$/.test(suppliedCode)) throw new BadRequestError("Mã giới thiệu không hợp lệ")
    let referrer
    try {
      referrer = $app.findFirstRecordByFilter("users", "xu_referral_code = {:code} && store = {:store}", { code: suppliedCode, store: storeId })
    } catch (err) {
      throw new BadRequestError("Mã giới thiệu không tồn tại tại cửa hàng này")
    }
    if (referrer.id === e.record.id || !referrer.getBool("is_approved")) {
      throw new BadRequestError("Mã giới thiệu không khả dụng")
    }
  }
  e.record.set("pending_xu_referral_code", suppliedCode)

  let referralCode = ""
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = $security.randomStringWithAlphabet(9, "ABCDEFGHJKLMNPQRSTUVWXYZ23456789")
    const found = new DynamicModel({ count: 0 })
    $app.db().newQuery("SELECT COUNT(*) AS count FROM users WHERE xu_referral_code = {:code}").bind({ code: candidate }).one(found)
    if (Number(found.count) === 0) { referralCode = candidate; break }
  }
  if (!referralCode) throw new BadRequestError("Không thể tạo mã Xu lúc này, vui lòng thử lại")
  e.record.set("xu_referral_code", referralCode)
  e.next()
}, "users")

onRecordAuthWithPasswordRequest((e) => {
  if (e.record || (e.identityField && e.identityField !== "username")) return e.next()

  const username = String(e.identity || "")
  const matchingUser = new DynamicModel({ count: 0, id: "" })
  $app.db().newQuery("SELECT COUNT(*) AS count, COALESCE(MIN(id), '') AS id FROM users WHERE LOWER(username) = LOWER({:username})").bind({ username }).one(matchingUser)
  if (Number(matchingUser.count) === 1) {
    e.record = $app.findRecordById("users", matchingUser.id)
  }

  e.next()
}, "users")

onRecordUpdateRequest((e) => {
  // Only apply to users collection
  if (e.collection.name !== "users") {
    return e.next()
  }

  // Allow superusers (admin panel) to modify protected fields
  if (e.hasSuperuserAuth()) {
    return e.next()
  }

  const protectedFields = ["store", "role", "is_system_admin", "is_internal", "is_approved", "zalo_id", "employee_code", "xu_referral_code", "pending_xu_referral_code"]
  const original = e.record.original()

  // Check if any protected field is being changed
  let changedFields = []
  for (const field of protectedFields) {
    const oldValue = original.get(field)
    const newValue = e.record.get(field)

    if (oldValue !== newValue) {
      changedFields.push(field)
    }
  }

  // If protected fields were modified, reject the request
  if (changedFields.length > 0) {
    throw new BadRequestError(
      `Cannot modify protected fields: ${changedFields.join(", ")}. Only superusers can modify these fields.`
    )
  }

  e.next()
}, "users")

