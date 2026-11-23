/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const products = app.findRecordsByFilter("products", "", "", -1, 0)
  products.forEach((product) => {
    product.set("requires_preparation", false)
    app.save(product)
  })
  const items = app.findRecordsByFilter("table_bill_items", "queue_status = 'pending'", "", -1, 0)
  items.forEach((item) => {
    let product = null
    try { product = app.findRecordById("products", item.get("product")) } catch (e) {}
    if (product && (product.get("billing_unit") === "hour" || product.get("requires_preparation") !== true)) {
      item.set("queue_status", "done")
      app.save(item)
    }
  })
}, (app) => app)
