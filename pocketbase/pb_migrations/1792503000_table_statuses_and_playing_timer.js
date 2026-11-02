/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const tables = app.findCollectionByNameOrId("tables")
  const status = tables.fields.getByName("status")
  const legacyTables = app.findRecordsByFilter("tables", "status = 'cleaning'", "row_number,position", -1, 0)
  for (const table of legacyTables) {
    table.set("status", "reserved")
    app.save(table)
  }
  status.values = ["available", "occupied", "reserved"]
  app.save(tables)

  const bills = app.findCollectionByNameOrId("table_bills")
  bills.fields.getByName("started_at").required = false
  app.save(bills)

  const openBills = app.findRecordsByFilter("table_bills", "status = 'open'", "created", -1, 0)
  for (const bill of openBills) {
    const firstItems = app.findRecordsByFilter("table_bill_items", "bill = {:bill}", "created", 1, 0, { bill: bill.id })
    bill.set("started_at", firstItems.length ? firstItems[0].get("created") : "")
    app.save(bill)
  }
}, (app) => {
  const tables = app.findCollectionByNameOrId("tables")
  const status = tables.fields.getByName("status")
  if (!status.values.includes("cleaning")) status.values = status.values.concat(["cleaning"])
  app.save(tables)

  const bills = app.findRecordsByFilter("table_bills", "", "created", -1, 0)
  for (const bill of bills) {
    if (!bill.get("started_at")) {
      bill.set("started_at", bill.get("created") || new Date().toISOString())
      app.save(bill)
    }
  }
  const billCollection = app.findCollectionByNameOrId("table_bills")
  billCollection.fields.getByName("started_at").required = true
  app.save(billCollection)
})
