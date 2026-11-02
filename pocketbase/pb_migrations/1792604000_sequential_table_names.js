/// <reference path="../pb_data/types.d.ts" />

const renameTableNames = (app) => {
  const tables = app.findRecordsByFilter("tables", "store != ''", "store,row_number,position,name", -1, 0)
  const labels = {}
  let previousStore = ""
  let tableNumber = 0
  for (const table of tables) {
    const store = String(table.get("store") || "")
    tableNumber = store === previousStore ? tableNumber + 1 : 1
    previousStore = store
    const name = "Bàn " + tableNumber
    table.set("name", name)
    app.save(table)
    labels[store + ":" + table.id] = name
  }

  const bills = app.findRecordsByFilter("table_bills", "store != ''", "store,created", -1, 0)
  const billNames = {}
  for (const bill of bills) {
    const name = labels[String(bill.get("store") || "") + ":" + String(bill.get("table") || "")]
    if (!name) continue
    bill.set("table_name", name)
    app.save(bill)
    billNames[bill.id] = name
  }

  const transactions = app.findRecordsByFilter("wallet_transactions", "reference_type = 'table_bill'", "created", -1, 0)
  for (const transaction of transactions) {
    const tableName = billNames[String(transaction.get("reference_id") || "")]
    if (!tableName) continue
    transaction.set("reason", "Thanh toán hóa đơn bàn " + tableName)
    app.save(transaction)
  }
}

migrate((app) => renameTableNames(app), (app) => renameTableNames(app))
