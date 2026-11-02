/// <reference path="../pb_data/types.d.ts" />

const addNumber = (collection, id, name) => {
  if (collection.fields.getByName(name)) return
  collection.fields.add(new NumberField({ id, name, required: false, min: 0, max: null, onlyInt: true, default: 0 }))
}

const addDate = (collection, id, name) => {
  if (collection.fields.getByName(name)) return
  collection.fields.add(new DateField({ id, name, required: false, min: "", max: "" }))
}

migrate((app) => {
  const bills = app.findCollectionByNameOrId("table_bills")
  const items = app.findCollectionByNameOrId("table_bill_items")
  addNumber(bills, "number_bill_paused_seconds", "paused_seconds")
  addDate(bills, "date_bill_billing_paused_at", "billing_paused_at")
  addNumber(items, "number_item_paused_seconds_at_start", "paused_seconds_at_start")
  app.save(bills)
  app.save(items)
}, (app) => {
  const bills = app.findCollectionByNameOrId("table_bills")
  const items = app.findCollectionByNameOrId("table_bill_items")
  if (bills.fields.getByName("billing_paused_at")) bills.fields.removeByName("billing_paused_at")
  if (bills.fields.getByName("paused_seconds")) bills.fields.removeByName("paused_seconds")
  if (items.fields.getByName("paused_seconds_at_start")) items.fields.removeByName("paused_seconds_at_start")
  app.save(bills)
  app.save(items)
})
