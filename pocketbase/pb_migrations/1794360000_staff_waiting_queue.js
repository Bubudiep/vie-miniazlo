/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const items = app.findCollectionByNameOrId("table_bill_items")
  if (!items.fields.getByName("queue_status")) items.fields.add(new SelectField({ id: "select_bill_item_queue_status", name: "queue_status", required: false, maxSelect: 1, values: ["pending", "done", "cancelled"] }))
  if (!items.fields.getByName("queued_at")) items.fields.add(new DateField({ id: "date_bill_item_queued_at", name: "queued_at", required: false }))
  if (!items.fields.getByName("queue_completed_at")) items.fields.add(new DateField({ id: "date_bill_item_queue_completed_at", name: "queue_completed_at", required: false }))
  if (!items.fields.getByName("queue_cancelled_at")) items.fields.add(new DateField({ id: "date_bill_item_queue_cancelled_at", name: "queue_cancelled_at", required: false }))
  app.save(items)

  const events = app.findCollectionByNameOrId("table_bill_events")
  const eventType = events.fields.getByName("event_type")
  if (eventType) {
    const additions = ["queue_completed", "queue_cancelled"].filter((value) => !eventType.values.includes(value))
    if (additions.length) eventType.values = eventType.values.concat(additions)
  }
  app.save(events)
}, (app) => {
  const items = app.findCollectionByNameOrId("table_bill_items")
  for (const name of ["queue_status", "queued_at", "queue_completed_at", "queue_cancelled_at"]) {
    try { items.fields.removeByName(name) } catch (e) {}
  }
  app.save(items)

  const events = app.findCollectionByNameOrId("table_bill_events")
  const eventType = events.fields.getByName("event_type")
  if (eventType) eventType.values = eventType.values.filter((value) => !["queue_completed", "queue_cancelled"].includes(value))
  app.save(events)
})
