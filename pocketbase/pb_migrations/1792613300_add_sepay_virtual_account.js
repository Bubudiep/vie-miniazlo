/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = app.findCollectionByNameOrId("bill_payment_settings")
  if (!collection.fields.getByName("sepay_virtual_account")) {
    collection.fields.add(new TextField({ id: "text_bill_sepay_virtual_account", name: "sepay_virtual_account", required: false, max: 24, min: 0, pattern: "" }))
  }
  if (!collection.fields.getByName("sepay_bank_code")) {
    collection.fields.add(new TextField({ id: "text_bill_sepay_bank_code", name: "sepay_bank_code", required: false, max: 20, min: 0, pattern: "" }))
  }
  app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("bill_payment_settings")
  if (collection.fields.getByName("sepay_bank_code")) collection.fields.removeByName("sepay_bank_code")
  if (collection.fields.getByName("sepay_virtual_account")) collection.fields.removeByName("sepay_virtual_account")
  app.save(collection)
})
