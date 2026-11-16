/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const stores = app.findCollectionByNameOrId("stores")
  if (!stores.fields.getByName("auto_open_products")) {
    stores.fields.add(new JSONField({ id: "json_store_auto_open_products", name: "auto_open_products", required: false, maxSize: 20000 }))
  }
  return app.save(stores)
}, (app) => {
  const stores = app.findCollectionByNameOrId("stores")
  if (stores.fields.getByName("auto_open_products")) stores.fields.removeByName("auto_open_products")
  return app.save(stores)
})
