/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_products")

  // update collection data
  unmarshal({
    "listRule": "@request.auth.id != \"\" && @request.auth.role = \"admin\" && @request.auth.store = store",
    "viewRule": "@request.auth.id != \"\" && @request.auth.role = \"admin\" && @request.auth.store = store"
  }, collection)

  // add field
  collection.fields.addAt(13, new Field({
    "help": "",
    "hidden": false,
    "id": "number503554547",
    "max": null,
    "min": 0,
    "name": "purchase_price",
    "onlyInt": true,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_products")

  // update collection data
  unmarshal({
    "listRule": "@request.auth.id != \"\" && @request.auth.store = store",
    "viewRule": "@request.auth.id != \"\" && @request.auth.store = store"
  }, collection)

  // remove field
  collection.fields.removeById("number503554547")

  return app.save(collection)
})
