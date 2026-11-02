/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const activeBills = app.findRecordsByFilter("table_bills", "status = 'open' || status = 'wallet_pending'", "created", -1, 0)
  for (const bill of activeBills) {
    bill.set("started_at", bill.get("created"))
    app.save(bill)
  }
})
