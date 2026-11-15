/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const stores = app.findCollectionByNameOrId("stores")
  const users = app.findCollectionByNameOrId("users")
  const settings = new Collection({
    type: "base", name: "wallet_spin_settings", system: false,
    fields: [
      { id: "text_spin_settings_id", name: "id", type: "text", required: true, system: true, primaryKey: true, autogeneratePattern: "[a-z0-9]{15}", pattern: "^[a-z0-9]+$", min: 15, max: 15 },
      { id: "relation_spin_settings_store", name: "store", type: "relation", collectionId: stores.id, required: true, cascadeDelete: true, maxSelect: 1, minSelect: 0 },
      { id: "number_spin_min_topup", name: "min_topup", type: "number", required: true, onlyInt: true, min: 0 },
      { id: "text_spin_prizes", name: "prizes", type: "text", required: false, max: 20000, min: 0 },
      { id: "relation_spin_settings_actor", name: "updated_by", type: "relation", collectionId: users.id, required: false, cascadeDelete: false, maxSelect: 1, minSelect: 0 },
      { id: "autodate_spin_settings_created", name: "created", type: "autodate", onCreate: true, onUpdate: false, system: false, hidden: false, presentable: false },
      { id: "autodate_spin_settings_updated", name: "updated", type: "autodate", onCreate: true, onUpdate: true, system: false, hidden: false, presentable: false }
    ], indexes: ["CREATE UNIQUE INDEX idx_wallet_spin_settings_store ON wallet_spin_settings (store)"],
    listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null
  })
  const spins = new Collection({
    type: "base", name: "wallet_topup_spins", system: false,
    fields: [
      { id: "text_topup_spin_id", name: "id", type: "text", required: true, system: true, primaryKey: true, autogeneratePattern: "[a-z0-9]{15}", pattern: "^[a-z0-9]+$", min: 15, max: 15 },
      { id: "relation_topup_spin_store", name: "store", type: "relation", collectionId: stores.id, required: true, cascadeDelete: true, maxSelect: 1, minSelect: 0 },
      { id: "relation_topup_spin_user", name: "user", type: "relation", collectionId: users.id, required: true, cascadeDelete: true, maxSelect: 1, minSelect: 0 },
      { id: "relation_topup_spin_topup", name: "topup", type: "relation", collectionId: app.findCollectionByNameOrId("wallet_topup_requests").id, required: true, cascadeDelete: true, maxSelect: 1, minSelect: 0 },
      { id: "text_topup_spin_prize", name: "prize_name", type: "text", required: true, max: 120, min: 1 },
      { id: "number_topup_spin_amount", name: "prize_amount", type: "number", required: true, onlyInt: true, min: 0 },
      { id: "number_topup_spin_probability", name: "probability", type: "number", required: true, min: 0 },
      { id: "autodate_topup_spin_created", name: "created", type: "autodate", onCreate: true, onUpdate: false, system: false, hidden: false, presentable: false }
    ], indexes: ["CREATE UNIQUE INDEX idx_wallet_topup_spins_topup ON wallet_topup_spins (topup)", "CREATE INDEX idx_wallet_topup_spins_user_created ON wallet_topup_spins (user, created)"],
    listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null
  })
  app.save(settings)
  app.save(spins)
}, (app) => {
  for (const name of ["wallet_topup_spins", "wallet_spin_settings"]) {
    try { app.delete(app.findCollectionByNameOrId(name)) } catch (e) {}
  }
})
