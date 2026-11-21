/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("bill_payment_settings")
  if (!collection.fields.getByName("tingee_virtual_account")) collection.fields.add(new TextField({ id: "text_bill_tingee_virtual_account", name: "tingee_virtual_account", required: false, max: 24, min: 0, pattern: "" }))
  app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("bill_payment_settings")
  if (collection.fields.getByName("tingee_virtual_account")) collection.fields.removeByName("tingee_virtual_account")
  app.save(collection)
})
