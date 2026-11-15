/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const users = app.findCollectionByNameOrId("users")
  const stores = app.findCollectionByNameOrId("stores")
  const collection = new Collection({
    type: "base",
    name: "staff_attendance",
    system: false,
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { id: "text_staff_attendance_id", name: "id", type: "text", required: true, system: true, primaryKey: true, autogeneratePattern: "[a-z0-9]{15}", pattern: "^[a-z0-9]+$", min: 15, max: 15 },
      { id: "relation_staff_attendance_store", name: "store", type: "relation", collectionId: stores.id, required: true, cascadeDelete: true, maxSelect: 1, minSelect: 0 },
      { id: "relation_staff_attendance_staff", name: "staff", type: "relation", collectionId: users.id, required: true, cascadeDelete: true, maxSelect: 1, minSelect: 0 },
      { id: "text_staff_attendance_work_date", name: "work_date", type: "text", required: true, min: 10, max: 10, pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
      { id: "select_staff_attendance_status", name: "status", type: "select", required: true, maxSelect: 1, minSelect: 0, values: ["present", "absent"] },
      { id: "text_staff_attendance_check_in", name: "check_in", type: "text", required: false, min: 0, max: 5, pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" },
      { id: "text_staff_attendance_check_out", name: "check_out", type: "text", required: false, min: 0, max: 5, pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" },
      { id: "autodate_staff_attendance_created", name: "created", type: "autodate", onCreate: true, onUpdate: false, system: false, hidden: false, presentable: false },
      { id: "autodate_staff_attendance_updated", name: "updated", type: "autodate", onCreate: true, onUpdate: true, system: false, hidden: false, presentable: false }
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_staff_attendance_store_staff_date ON staff_attendance (store, staff, work_date)",
      "CREATE INDEX idx_staff_attendance_store_date ON staff_attendance (store, work_date)"
    ]
  })
  return app.save(collection)
}, (app) => {
  try { return app.delete(app.findCollectionByNameOrId("staff_attendance")) } catch (e) {}
})
