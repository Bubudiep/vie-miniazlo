/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const bills = app.findCollectionByNameOrId("table_bills")
  const users = app.findCollectionByNameOrId("users")
  const status = bills.fields.getByName("status")
  if (status && !status.values.includes("stopped")) status.values = status.values.concat(["stopped"])
  if (!bills.fields.getByName("session_id")) bills.fields.add(new TextField({ id: "text_bill_session_id", name: "session_id", required: false, max: 40, min: 0, pattern: "" }))
  if (!bills.fields.getByName("stopped_at")) bills.fields.add(new DateField({ id: "date_bill_stopped_at", name: "stopped_at", required: false, min: "", max: "" }))
  if (!bills.fields.getByName("payment_requester")) bills.fields.add(new RelationField({ id: "relation_bill_payment_requester", name: "payment_requester", collectionId: users.id, required: false, cascadeDelete: false, maxSelect: 1, minSelect: 0 }))
  bills.indexes = bills.indexes.filter((index) => !index.includes("idx_table_bills_store_session"))
  bills.indexes.push("CREATE INDEX idx_table_bills_store_session ON table_bills (store, session_id, created)")
  app.save(bills)

  const events = app.findCollectionByNameOrId("table_bill_events")
  const eventType = events.fields.getByName("event_type")
  if (eventType) {
    for (const value of ["bill_session_stopped", "bill_session_started", "bill_table_transferred"]) {
      if (!eventType.values.includes(value)) eventType.values = eventType.values.concat([value])
    }
    app.save(events)
  }
}, (app) => {
  const bills = app.findCollectionByNameOrId("table_bills")
  const status = bills.fields.getByName("status")
  if (status && status.values.includes("stopped")) status.values = status.values.filter((value) => value !== "stopped")
  for (const name of ["session_id", "stopped_at", "payment_requester"]) {
    if (bills.fields.getByName(name)) bills.fields.removeByName(name)
  }
  bills.indexes = bills.indexes.filter((index) => !index.includes("idx_table_bills_store_session"))
  app.save(bills)

  const events = app.findCollectionByNameOrId("table_bill_events")
  const eventType = events.fields.getByName("event_type")
  if (eventType) {
    eventType.values = eventType.values.filter((value) => !["bill_session_stopped", "bill_session_started"].includes(value))
    app.save(events)
  }
})
