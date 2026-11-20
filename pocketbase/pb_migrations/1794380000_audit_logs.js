migrate((app) => {
  const users = app.findCollectionByNameOrId("users")
  const stores = app.findCollectionByNameOrId("stores")
  const collection = new Collection({
    type: "base", name: "audit_logs", system: false,
    listRule: '@request.auth.id != "" && @request.auth.role = "admin" && store = @request.auth.store',
    viewRule: '@request.auth.id != "" && @request.auth.role = "admin" && store = @request.auth.store',
    createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { id: "text_audit_log_id", name: "id", type: "text", system: true, required: true, primaryKey: true, autogeneratePattern: "[a-z0-9]{15}", pattern: "^[a-z0-9]+$", min: 15, max: 15 },
      { id: "relation_audit_log_store", name: "store", type: "relation", collectionId: stores.id, required: true, cascadeDelete: true, maxSelect: 1, minSelect: 0 },
      { id: "relation_audit_log_actor", name: "actor", type: "relation", collectionId: users.id, required: true, cascadeDelete: true, maxSelect: 1, minSelect: 0 },
      { id: "text_audit_log_action", name: "action", type: "text", required: true, min: 1, max: 40, pattern: "" },
      { id: "text_audit_log_collection", name: "collection", type: "text", required: true, min: 1, max: 80, pattern: "" },
      { id: "text_audit_log_record", name: "record_id", type: "text", required: false, min: 0, max: 40, pattern: "" },
      { id: "text_audit_log_details", name: "details", type: "text", required: false, min: 0, max: 5000, pattern: "" },
      { id: "autodate_audit_log_created", name: "created", type: "autodate", onCreate: true, onUpdate: false, system: false, hidden: false, presentable: false },
      { id: "autodate_audit_log_updated", name: "updated", type: "autodate", onCreate: true, onUpdate: true, system: false, hidden: false, presentable: false }
    ],
    indexes: ["CREATE INDEX idx_audit_logs_store_created ON audit_logs (store, created)", "CREATE INDEX idx_audit_logs_store_actor_created ON audit_logs (store, actor, created)"]
  })
  return app.save(collection)
}, (app) => { try { return app.delete(app.findCollectionByNameOrId("audit_logs")) } catch (e) {} })
