/// <reference path="../pb_data/types.d.ts" />

routerAdd("GET", "/api/admin/attendance", (c) => {
  const info = c.requestInfo()
  const auth = info.authRecord || info.auth || c.auth || null
  if (!auth) throw new UnauthorizedError("Cần đăng nhập")
  if (auth.get("role") !== "admin" || !auth.get("store")) throw new ForbiddenError("Chỉ admin cửa hàng mới được thao tác")
  const store = String(auth.get("store"))
  const workDate = String((info.query || {}).date || "")
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(workDate) && (() => {
    const [year, month, day] = workDate.split("-").map(Number)
    const date = new Date(Date.UTC(year, month - 1, day))
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  })()
  if (!validDate) throw new BadRequestError("Ngày chấm công không hợp lệ")

  const staff = $app.findRecordsByFilter("users", "store = {:store} && role = 'staff'", "fullname,username", 500, 0, { store })
  const records = $app.findRecordsByFilter("staff_attendance", "store = {:store} && work_date = {:date}", "created", 1000, 0, { store, date: workDate })
  const byStaff = {}
  records.forEach((record) => {
    byStaff[record.get("staff")] = {
      id: record.id,
      staff: record.get("staff"),
      workDate: record.get("work_date"),
      status: record.get("status"),
      checkIn: record.get("check_in") || "",
      checkOut: record.get("check_out") || ""
    }
  })
  return c.json(200, { items: staff.map((user) => ({
    id: user.id,
    username: user.get("username") || "",
    fullname: user.get("fullname") || "",
    phone: user.get("phone") || "",
    role: user.get("role"),
    approved: user.getBool("is_approved"),
    locked: user.getBool("is_locked"),
    attendance: byStaff[user.id] || null
  })) })
})

routerAdd("POST", "/api/admin/attendance", (c) => {
  const info = c.requestInfo()
  const auth = info.authRecord || info.auth || c.auth || null
  if (!auth) throw new UnauthorizedError("Cần đăng nhập")
  if (auth.get("role") !== "admin" || !auth.get("store")) throw new ForbiddenError("Chỉ admin cửa hàng mới được thao tác")
  const store = String(auth.get("store"))
  const input = info.body || {}
  const staffId = String(input.staff || "")
  const workDate = String(input.workDate || "")
  const status = String(input.status || "")
  const checkIn = String(input.checkIn || "")
  const checkOut = String(input.checkOut || "")
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(workDate) && (() => {
    const [year, month, day] = workDate.split("-").map(Number)
    const date = new Date(Date.UTC(year, month - 1, day))
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  })()
  const validTime = (value) => value === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(value)

  if (!staffId || !validDate) throw new BadRequestError("Nhân viên hoặc ngày chấm công không hợp lệ")
  if (!["present", "absent"].includes(status)) throw new BadRequestError("Trạng thái chấm công không hợp lệ")
  if (!validTime(checkIn) || !validTime(checkOut)) throw new BadRequestError("Giờ vào hoặc giờ ra không hợp lệ")
  if (status === "absent" && (checkIn || checkOut)) throw new BadRequestError("Nhân viên nghỉ không thể có giờ vào/ra")
  if (checkIn && checkOut && checkOut <= checkIn) throw new BadRequestError("Giờ ra phải sau giờ vào")

  const staff = $app.findRecordById("users", staffId)
  if (staff.get("store") !== store || staff.get("role") !== "staff") throw new ForbiddenError("Nhân viên không thuộc cửa hàng này")

  let saved
  $app.runInTransaction((txApp) => {
    let record
    try {
      record = txApp.findFirstRecordByFilter("staff_attendance", "store = {:store} && staff = {:staff} && work_date = {:date}", { store, staff: staffId, date: workDate })
    } catch (e) {
      record = new Record(txApp.findCollectionByNameOrId("staff_attendance"))
    }
    record.set("store", store)
    record.set("staff", staffId)
    record.set("work_date", workDate)
    record.set("status", status)
    record.set("check_in", checkIn)
    record.set("check_out", checkOut)
    txApp.save(record)
    saved = {
      id: record.id,
      staff: staffId,
      workDate,
      status,
      checkIn,
      checkOut
    }
  })
  return c.json(200, saved)
})
