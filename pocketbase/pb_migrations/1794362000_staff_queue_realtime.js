/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const stores = app.findCollectionByNameOrId("stores")
  const rule = '@request.auth.id != "" && @request.auth.store = store && (@request.auth.role = "admin" || @request.auth.role = "staff")'
  const collection = new Collection({
    type: "base",
    name: "staff_queue_signals",
    system: false,
    listRule: rule,
    viewRule: rule,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { id: "relation_queue_signal_store", name: "store", type: "relation", collectionId: stores.id, required: true, cascadeDelete: true, maxSelect: 1, minSelect: 0 },
      { id: "number_queue_signal_revision", name: "revision", type: "number", onlyInt: true, min: 0, max: null, default: 0, required: false },
      { id: "autodate_queue_signal_created", name: "created", type: "autodate", onCreate: true, onUpdate: false, required: false, system: false, hidden: false, presentable: false },
      { id: "autodate_queue_signal_updated", name: "updated", type: "autodate", onCreate: true, onUpdate: true, required: false, system: false, hidden: false, presentable: false }
    ],
    indexes: ["CREATE UNIQUE INDEX idx_staff_queue_signals_store ON staff_queue_signals (store)"]
  })
  app.save(collection)
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("staff_queue_signals")) } catch (e) {}
})
