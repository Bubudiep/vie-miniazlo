/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const stores = app.findCollectionByNameOrId("stores")
  const users = app.findCollectionByNameOrId("users")
  const settings = new Collection({
    type: "base",
    name: "wallet_promo_settings",
    system: false,
    fields: [
      { id: "text_wallet_promo_settings_id", name: "id", type: "text", required: true, system: true, primaryKey: true, autogeneratePattern: "[a-z0-9]{15}", pattern: "^[a-z0-9]+$", min: 15, max: 15 },
      { id: "relation_wallet_promo_settings_store", name: "store", type: "relation", collectionId: stores.id, required: true, cascadeDelete: true, maxSelect: 1, minSelect: 0 },
      { id: "text_wallet_promo_settings_data", name: "settings", type: "text", required: true, max: 20000, min: 2 },
      { id: "relation_wallet_promo_settings_actor", name: "updated_by", type: "relation", collectionId: users.id, required: false, cascadeDelete: false, maxSelect: 1, minSelect: 0 },
      { id: "autodate_wallet_promo_settings_created", name: "created", type: "autodate", onCreate: true, onUpdate: false, system: false, hidden: false, presentable: false },
      { id: "autodate_wallet_promo_settings_updated", name: "updated", type: "autodate", onCreate: true, onUpdate: true, system: false, hidden: false, presentable: false }
    ],
    indexes: ["CREATE UNIQUE INDEX idx_wallet_promo_settings_store ON wallet_promo_settings (store)"],
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null
  })
  app.save(settings)
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("wallet_promo_settings")) } catch (e) {}
})
