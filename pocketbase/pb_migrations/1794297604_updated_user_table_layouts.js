/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3550508673")

  // update collection data
  unmarshal({
    "createRule": "@request.auth.id != \"\" && user = @request.auth.id && store = @request.auth.store && @request.auth.role = \"admin\"",
    "deleteRule": "@request.auth.id != \"\" && user = @request.auth.id && store = @request.auth.store && @request.auth.role = \"admin\"",
    "listRule": "@request.auth.id != \"\" && user = @request.auth.id && store = @request.auth.store",
    "updateRule": "@request.auth.id != \"\" && user = @request.auth.id && store = @request.auth.store && @request.auth.role = \"admin\"",
    "viewRule": "@request.auth.id != \"\" && user = @request.auth.id && store = @request.auth.store"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3550508673")

  // update collection data
  unmarshal({
    "createRule": null,
    "deleteRule": null,
    "listRule": null,
    "updateRule": null,
    "viewRule": null
  }, collection)

  return app.save(collection)
})
