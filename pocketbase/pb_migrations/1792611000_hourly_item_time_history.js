/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const events = app.findCollectionByNameOrId("table_bill_events")
  const eventType = events.fields.getByName("event_type")
  if (eventType && !eventType.values.includes("item_time_changed")) {
    eventType.values = eventType.values.concat(["item_time_changed"])
    app.save(events)
  }
}, (app) => {
  const events = app.findCollectionByNameOrId("table_bill_events")
  const eventType = events.fields.getByName("event_type")
  if (eventType && eventType.values.includes("item_time_changed")) {
    eventType.values = eventType.values.filter((value) => value !== "item_time_changed")
    app.save(events)
  }
})
