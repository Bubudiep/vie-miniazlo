/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const stores = app.findCollectionByNameOrId("stores")
  const users = app.findCollectionByNameOrId("users")
  const collection = new Collection({
    type: "base",
    name: "wallet_spin_sessions",
    system: false,
    listRule: '@request.auth.id != "" && user = @request.auth.id',
    viewRule: '@request.auth.id != "" && user = @request.auth.id',
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { id: "relation_spin_session_store", name: "store", type: "relation", collectionId: stores.id, required: true, cascadeDelete: true, maxSelect: 1, minSelect: 0 },
      { id: "relation_spin_session_user", name: "user", type: "relation", collectionId: users.id, required: true, cascadeDelete: true, maxSelect: 1, minSelect: 0 },
      { id: "select_spin_session_status", name: "status", type: "select", required: true, maxSelect: 1, values: ["pending", "spun", "cancelled"] },
      { id: "text_spin_session_prize", name: "prize_name", type: "text", required: false, max: 120 },
      { id: "number_spin_session_amount", name: "prize_amount", type: "number", required: false, onlyInt: true, min: 0 },
      { id: "number_spin_session_probability", name: "probability", type: "number", required: false, min: 0 },
      { id: "autodate_spin_session_created", name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { id: "autodate_spin_session_updated", name: "updated", type: "autodate", onCreate: true, onUpdate: true }
    ],
    indexes: ["CREATE INDEX idx_wallet_spin_sessions_user_status ON wallet_spin_sessions (user, status, created)"]
  })
  app.save(collection)
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("wallet_spin_sessions")) } catch (e) {}
})
