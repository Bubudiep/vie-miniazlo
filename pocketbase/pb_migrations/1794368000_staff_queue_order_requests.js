/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const signals = app.findCollectionByNameOrId("staff_queue_signals")
  const eventType = signals.fields.getByName("event_type")
  if (eventType) eventType.values = Array.from(new Set(eventType.values.concat(["payment", "requests"])))
  app.save(signals)
}, (app) => {
  const signals = app.findCollectionByNameOrId("staff_queue_signals")
  const eventType = signals.fields.getByName("event_type")
  if (eventType) eventType.values = eventType.values.filter((value) => value !== "requests")
  app.save(signals)
})
