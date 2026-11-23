/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const products = app.findCollectionByNameOrId("products")
  if (!products.fields.getByName("requires_preparation")) {
    products.fields.add(new Field({ id: "bool_product_requires_preparation", name: "requires_preparation", type: "bool", required: false }))
  }
  const records = app.findRecordsByFilter("products", "", "", -1, 0)
  records.forEach((product) => {
    product.set("requires_preparation", false)
    app.save(product)
  })
  return app.save(products)
}, (app) => {
  const products = app.findCollectionByNameOrId("products")
  if (products.fields.getByName("requires_preparation")) products.fields.removeByName("requires_preparation")
  return app.save(products)
})
