/// <reference path="../pb_data/types.d.ts" />
const ignored = new Set(["audit_logs", "staff_queue_signals"])
function writeAudit(e, action) {
  try {
    const info = e.requestInfo()
    const auth = info.authRecord || info.auth || e.httpContext.get("authRecord")
    if (!auth || !["staff", "admin"].includes(String(auth.get("role") || ""))) return
    const collection = e.record.collection().name
    if (ignored.has(collection)) return
    const store = String(auth.get("store") || e.record.get("store") || "")
    if (!store) return
    const log = new Record(e.app.findCollectionByNameOrId("audit_logs"))
    log.set("store", store); log.set("actor", auth.id); log.set("action", action)
    log.set("collection", collection); log.set("record_id", String(e.record.id || ""))
    if (action === "update") { try { log.set("details", JSON.stringify(e.record.original())) } catch (error) {} }
    e.app.save(log)
  } catch (error) { console.error("Failed to write audit log:", error) }
}
onRecordCreateRequest((e) => { writeAudit(e, "create"); return e.next() })
onRecordUpdateRequest((e) => { writeAudit(e, "update"); return e.next() })
onRecordDeleteRequest((e) => { writeAudit(e, "delete"); return e.next() })
