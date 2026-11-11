/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const items = app.findCollectionByNameOrId("table_bill_items")
  const status = items.fields.getByName("queue_status")
  if (status) status.values = Array.from(new Set(status.values.concat(["approval_pending", "rejected"])))
  app.save(items)

  const events = app.findCollectionByNameOrId("table_bill_events")
  const eventType = events.fields.getByName("event_type")
  if (eventType) eventType.values = Array.from(new Set(eventType.values.concat(["order_requested", "order_approved", "order_rejected"])))
  app.save(events)
}, (app) => {
  const items = app.findCollectionByNameOrId("table_bill_items")
  const status = items.fields.getByName("queue_status")
  if (status) status.values = status.values.filter((value) => !["approval_pending", "rejected"].includes(value))
  app.save(items)

  const events = app.findCollectionByNameOrId("table_bill_events")
  const eventType = events.fields.getByName("event_type")
  if (eventType) eventType.values = eventType.values.filter((value) => !["order_requested", "order_approved", "order_rejected"].includes(value))
  app.save(events)
})
