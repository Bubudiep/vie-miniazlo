/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = app.findCollectionByNameOrId("bill_payment_settings")
  const storeField = collection.fields.getByName("store")
  if (!storeField || storeField.type() !== "relation") throw new Error("bill_payment_settings.store must be a relation field")

  storeField.collectionId = app.findCollectionByNameOrId("stores").id
  storeField.cascadeDelete = true
  storeField.maxSelect = 1
  storeField.minSelect = 0
  storeField.required = true

  collection.indexes = ["CREATE UNIQUE INDEX idx_bill_payment_settings_store ON bill_payment_settings (store)"]
  collection.listRule = null
  collection.viewRule = null
  collection.createRule = null
  collection.updateRule = null
  collection.deleteRule = null
  app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("bill_payment_settings")
  const storeField = collection.fields.getByName("store")
  if (storeField && storeField.type() === "relation") {
    storeField.cascadeDelete = false
    storeField.maxSelect = 0
    storeField.minSelect = 0
    storeField.required = false
  }

  collection.indexes = ["CREATE UNIQUE INDEX idx_ixnpjkqdtv ON bill_payment_settings (store)"]
  collection.listRule = null
  collection.viewRule = null
  collection.createRule = null
  collection.updateRule = null
  collection.deleteRule = null
  app.save(collection)
})
