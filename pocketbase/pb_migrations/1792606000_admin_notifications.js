/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = new Collection({
    type: "base",
    name: "admin_notifications",
    system: false,
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { autogeneratePattern: "[a-z0-9]{15}", id: "text_admin_notification_id", name: "id", pattern: "^[a-z0-9]+$", required: true, system: true, type: "text", max: 15, min: 15, primaryKey: true },
      { id: "relation_admin_notification_store", name: "store", type: "relation", collectionId: app.findCollectionByNameOrId("stores").id, required: true, cascadeDelete: true, maxSelect: 1, minSelect: 0 },
      { id: "relation_admin_notification_recipient", name: "recipient", type: "relation", collectionId: app.findCollectionByNameOrId("users").id, required: true, cascadeDelete: true, maxSelect: 1, minSelect: 0 },
      { id: "select_admin_notification_type", name: "type", type: "select", required: true, maxSelect: 1, minSelect: 0, values: ["table_bill_wallet", "table_bill_transfer"] },
      { id: "text_admin_notification_title", name: "title", type: "text", required: true, max: 120, min: 0, pattern: "" },
      { id: "text_admin_notification_body", name: "body", type: "text", required: true, max: 500, min: 0, pattern: "" },
      { id: "text_admin_notification_reference_type", name: "reference_type", type: "text", required: false, max: 40, min: 0, pattern: "" },
      { id: "text_admin_notification_reference_id", name: "reference_id", type: "text", required: false, max: 40, min: 0, pattern: "" },
      { id: "bool_admin_notification_read", name: "read", type: "bool", required: false, system: false, hidden: false, presentable: false },
      { id: "autodate_admin_notification_created", name: "created", type: "autodate", onCreate: true, onUpdate: false, system: false, hidden: false, presentable: false },
      { id: "autodate_admin_notification_updated", name: "updated", onCreate: true, onUpdate: true, system: false, hidden: false, presentable: false, type: "autodate" }
    ],
    indexes: [
      "CREATE INDEX idx_admin_notifications_recipient_read ON admin_notifications (recipient, read, created)",
      "CREATE INDEX idx_admin_notifications_reference ON admin_notifications (reference_type, reference_id)"
    ]
  })
  return app.save(collection)
}, (app) => {
  try { return app.delete(app.findCollectionByNameOrId("admin_notifications")) } catch (e) {}
})
