/// <reference path="../pb_data/types.d.ts" />

const sameStore = '@request.auth.id != "" && @request.auth.store = store'
const adminStore = '@request.auth.id != "" && @request.auth.role = "admin" && @request.auth.store = store'

migrate((app) => {
  const products = app.findCollectionByNameOrId("products")
  if (!products.fields.getByName("purchase_price")) {
    products.fields.add(new NumberField({ id: "number_product_purchase_price", name: "purchase_price", required: false, onlyInt: true, min: 0 }))
  }
  products.listRule = adminStore
  products.viewRule = adminStore
  app.save(products)
}, (app) => {
  const products = app.findCollectionByNameOrId("products")
  if (products.fields.getByName("purchase_price")) products.fields.removeByName("purchase_price")
  products.listRule = sameStore
  products.viewRule = sameStore
  app.save(products)
})
