/// <reference path="../pb_data/types.d.ts" />
const ignored = new Set(["audit_logs", "staff_queue_signals"])
onRecordCreateRequest((e) => {
  try {
    const info = e.requestInfo(); const auth = info.authRecord || info.auth || e.httpContext.get("authRecord")
    const collection = e.record.collection().name
    if (!auth || !["staff", "admin"].includes(String(auth.get("role") || "")) || ignored.has(collection)) return e.next()
    const store = String(auth.get("store") || e.record.get("store") || ""); if (!store) return e.next()
    const log = new Record(e.app.findCollectionByNameOrId("audit_logs"))
    log.set("store", store); log.set("actor", auth.id); log.set("action", "create"); log.set("collection", collection); log.set("record_id", String(e.record.id || "")); e.app.save(log)
  } catch (error) { console.error("Failed to write audit log:", error) }
  return e.next()
})
onRecordUpdateRequest((e) => {
  try {
    const info = e.requestInfo(); const auth = info.authRecord || info.auth || e.httpContext.get("authRecord")
    const collection = e.record.collection().name
    if (!auth || !["staff", "admin"].includes(String(auth.get("role") || "")) || ignored.has(collection)) return e.next()
    const store = String(auth.get("store") || e.record.get("store") || ""); if (!store) return e.next()
    const log = new Record(e.app.findCollectionByNameOrId("audit_logs"))
    log.set("store", store); log.set("actor", auth.id); log.set("action", "update"); log.set("collection", collection); log.set("record_id", String(e.record.id || "")); try { log.set("details", JSON.stringify(e.record.original())) } catch (error) {} e.app.save(log)
  } catch (error) { console.error("Failed to write audit log:", error) }
  return e.next()
})
onRecordDeleteRequest((e) => {
  try {
    const info = e.requestInfo(); const auth = info.authRecord || info.auth || e.httpContext.get("authRecord")
    const collection = e.record.collection().name
    if (!auth || !["staff", "admin"].includes(String(auth.get("role") || "")) || ignored.has(collection)) return e.next()
    const store = String(auth.get("store") || e.record.get("store") || ""); if (!store) return e.next()
    const log = new Record(e.app.findCollectionByNameOrId("audit_logs"))
    log.set("store", store); log.set("actor", auth.id); log.set("action", "delete"); log.set("collection", collection); log.set("record_id", String(e.record.id || "")); e.app.save(log)
  } catch (error) { console.error("Failed to write audit log:", error) }
  return e.next()
})
