/// <reference path="../pb_data/types.d.ts" />

const sameStore = '@request.auth.id != "" && @request.auth.store = store'
const adminStore = '@request.auth.id != "" && @request.auth.role = "admin" && @request.auth.store = store'

migrate((app) => {
  const stores = app.findCollectionByNameOrId("stores")
  const products = app.findCollectionByNameOrId("products")
  const items = app.findCollectionByNameOrId("table_bill_items")

  let categories
  try {
    categories = app.findCollectionByNameOrId("product_categories")
  } catch (_) {
    categories = new Collection({
      type: "base",
      name: "product_categories",
      fields: [
        { cascadeDelete: true, collectionId: stores.id, help: "", hidden: false, id: "relation_product_category_store", maxSelect: 1, minSelect: 1, name: "store", presentable: false, required: true, system: false, type: "relation" },
        { help: "", hidden: false, id: "text_product_category_name", max: 80, min: 1, name: "name", pattern: "", presentable: false, required: true, system: false, type: "text" },
        { hidden: false, id: "autodate_product_category_created", name: "created", onCreate: true, onUpdate: false, presentable: false, system: false, type: "autodate" },
        { hidden: false, id: "autodate_product_category_updated", name: "updated", onCreate: true, onUpdate: true, presentable: false, system: false, type: "autodate" }
      ],
      indexes: ["CREATE UNIQUE INDEX idx_product_categories_store_name ON product_categories (store, lower(name))"],
      listRule: sameStore,
      viewRule: sameStore,
      createRule: adminStore,
      updateRule: adminStore,
      deleteRule: adminStore
    })
    app.save(categories)
  }

  if (!products.fields.getByName("time_pricing")) {
    products.fields.add(new JSONField({ id: "json_product_time_pricing", name: "time_pricing", required: false, maxSize: 65536 }))
  }
  if (!items.fields.getByName("time_pricing")) {
    items.fields.add(new JSONField({ id: "json_bill_item_time_pricing", name: "time_pricing", required: false, maxSize: 65536 }))
  }
  app.save(products)
  app.save(items)

  const existingProducts = app.findRecordsByFilter("products", "store != ''", "store,name", -1, 0)
  const seen = {}
  const existingCategories = app.findRecordsByFilter("product_categories", "store != ''", "store,name", -1, 0)
  for (const category of existingCategories) {
    const store = String(category.get("store") || "")
    const name = String(category.get("name") || "").trim() || "Khác"
    seen[store + "|" + name.toLowerCase()] = true
  }

  for (const product of existingProducts) {
    const store = String(product.get("store") || "")
    const name = String(product.get("category") || "").trim() || "Khác"
    const key = store + "|" + name.toLowerCase()
    if (seen[key]) continue
    const category = new Record(categories)
    category.set("store", store)
    category.set("name", name)
    app.save(category)
    seen[key] = true
  }
}, (app) => {
  const products = app.findCollectionByNameOrId("products")
  const items = app.findCollectionByNameOrId("table_bill_items")
  if (products.fields.getByName("time_pricing")) products.fields.removeByName("time_pricing")
  if (items.fields.getByName("time_pricing")) items.fields.removeByName("time_pricing")
  app.save(products)
  app.save(items)
  app.delete(app.findCollectionByNameOrId("product_categories"))
})
