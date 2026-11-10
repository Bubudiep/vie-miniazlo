/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const stores = app.findCollectionByNameOrId("stores")
  let added = false
  if (!stores.fields.getByName("inventory_required")) {
    stores.fields.add(new Field({ id: "bool_store_inventory_required", name: "inventory_required", type: "bool", required: false, default: true }))
    app.save(stores)
    added = true
  }
  if (added) app.db().newQuery("UPDATE stores SET inventory_required = true").execute()
}, (app) => {
  const stores = app.findCollectionByNameOrId("stores")
  if (stores.fields.getByName("inventory_required")) {
    stores.fields.removeByName("inventory_required")
    app.save(stores)
  }
})
