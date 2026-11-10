/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const users = app.findCollectionByNameOrId("users")
  const role = users.fields.getByName("role")
  if (role && !role.values.includes("staff")) role.values = role.values.concat(["staff"])
  if (!users.fields.getByName("is_locked")) users.fields.add(new Field({ id: "bool_user_locked", name: "is_locked", type: "bool", required: false }))
  unmarshal({ authRule: "is_approved = true && (is_locked = false || is_locked = null)" }, users)
  app.save(users)
  app.db().newQuery("UPDATE users SET is_locked = false WHERE is_locked IS NULL").execute()

  const bills = app.findCollectionByNameOrId("table_bills")
  if (!bills.fields.getByName("cash_received")) bills.fields.add(new Field({ id: "number_bill_cash_received", name: "cash_received", type: "number", required: false, onlyInt: true, min: 0 }))
  app.save(bills)

  const events = app.findCollectionByNameOrId("table_bill_events")
  const eventType = events.fields.getByName("event_type")
  if (eventType) {
    const additions = ["bill_printed", "bill_reprinted"].filter((value) => !eventType.values.includes(value))
    if (additions.length) eventType.values = eventType.values.concat(additions)
  }
  app.save(events)
}, (app) => {
  const users = app.findCollectionByNameOrId("users")
  const role = users.fields.getByName("role")
  if (role && role.values.includes("staff")) role.values = role.values.filter((value) => value !== "staff")
  try { users.fields.removeByName("is_locked") } catch (e) {}
  unmarshal({ authRule: "is_approved = true" }, users)
  app.save(users)

  const bills = app.findCollectionByNameOrId("table_bills")
  try { bills.fields.removeByName("cash_received") } catch (e) {}
  app.save(bills)

  const events = app.findCollectionByNameOrId("table_bill_events")
  const eventType = events.fields.getByName("event_type")
  if (eventType) eventType.values = eventType.values.filter((value) => !["bill_printed", "bill_reprinted"].includes(value))
  app.save(events)
})
