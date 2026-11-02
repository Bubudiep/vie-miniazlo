/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3085588762")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX `idx_ixnpjkqdtv` ON `bill_payment_settings` (`store`)"
    ]
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3085588762")

  // update collection data
  unmarshal({
    "indexes": []
  }, collection)

  return app.save(collection)
})
