/// <reference path="../pb_data/types.d.ts" />

const field = (id, name, type, options = {}) => {
  const common = { help: "", hidden: false, id, name, presentable: false, required: false, system: false, type }
  if (type === "number") return { ...common, max: null, min: 0, onlyInt: false, default: 0, ...options }
  if (type === "text") return { ...common, max: 255, min: 0, pattern: "", ...options }
  if (type === "select") return { ...common, maxSelect: 1, values: [], ...options }
  if (type === "date") return { ...common, max: "", min: "", ...options }
  return { ...common, ...options }
}

const addField = (id, name, type, options = {}) => {
  const common = { id, name, required: false, system: false, hidden: false, presentable: false, ...options }
  if (type === "number") return new NumberField({ min: 0, max: null, onlyInt: false, default: 0, ...common })
  if (type === "text") return new TextField({ min: 0, max: 255, pattern: "", ...common })
  if (type === "select") return new SelectField({ maxSelect: 1, values: [], ...common })
  if (type === "date") return new DateField({ min: "", max: "", ...common })
  return new Field({ type, ...common })
}

const relationField = (id, name, collectionId, required = true, cascadeDelete = false) => ({
  cascadeDelete,
  collectionId,
  help: "",
  hidden: false,
  id,
  maxSelect: 1,
  minSelect: 0,
  name,
  presentable: false,
  required,
  system: false,
  type: "relation"
})

const baseCollection = (name, fields, indexes, rules) => new Collection({
  type: "base",
  name,
  fields: fields.concat([
    { hidden: false, id: "autodate_table_created", name: "created", onCreate: true, onUpdate: false, presentable: false, system: false, type: "autodate" },
    { hidden: false, id: "autodate_table_updated", name: "updated", onCreate: true, onUpdate: true, presentable: false, system: false, type: "autodate" }
  ]),
  indexes,
  listRule: rules.list,
  viewRule: rules.view,
  createRule: rules.create,
  updateRule: rules.update,
  deleteRule: rules.delete
})

migrate((app) => {
  const stores = app.findCollectionByNameOrId("stores")
  const users = app.findCollectionByNameOrId("users")
  const tables = app.findCollectionByNameOrId("tables")
  const products = app.findCollectionByNameOrId("products")

  if (!tables.fields.getByName("row_number")) {
    tables.fields.add(addField("number_table_row", "row_number", "number", { onlyInt: true, min: 1, max: 20 }))
  }
  if (!tables.fields.getByName("position")) {
    tables.fields.add(addField("number_table_position", "position", "number", { onlyInt: true, min: 1, max: 100 }))
  }
  app.save(tables)

  const existingTables = app.findRecordsByFilter("tables", "store != ''", "name", -1, 0)
  const byStore = {}
  for (const table of existingTables) {
    const storeId = table.get("store")
    byStore[storeId] = byStore[storeId] || []
    byStore[storeId].push(table)
  }
  for (const storeId in byStore) {
    const storeTables = byStore[storeId]
    for (let i = 0; i < storeTables.length; i++) {
      storeTables[i].set("row_number", 1)
      storeTables[i].set("position", i + 1)
      app.save(storeTables[i])
    }
  }

  tables.fields.getByName("row_number").required = true
  tables.fields.getByName("position").required = true
  const tableLayoutAdmin = '@request.auth.id != "" && @request.auth.role = "admin" && @request.auth.store = store'
  const sameStore = '@request.auth.id != "" && @request.auth.store = store'
  const billRead = `${sameStore} && (@request.auth.role = "admin" || customer = @request.auth.id)`
  const readOnlyRules = { list: sameStore, view: sameStore, create: null, update: null, delete: null }
  tables.listRule = sameStore
  tables.viewRule = sameStore
  tables.createRule = null
  tables.updateRule = null
  tables.deleteRule = null
  tables.indexes = tables.indexes.concat([
    "CREATE UNIQUE INDEX idx_tables_store_row_position ON tables (store, row_number, position)"
  ])
  app.save(tables)

  const kind = products.fields.getByName("kind")
  if (kind && !kind.values.includes("service")) kind.values = kind.values.concat(["service"])
  if (!products.fields.getByName("category")) products.fields.add(addField("text_product_category", "category", "text", { max: 80 }))
  if (!products.fields.getByName("billing_unit")) products.fields.add(addField("select_product_unit", "billing_unit", "select", { maxSelect: 1, values: ["hour", "quantity", "weight"] }))
  if (!products.fields.getByName("unit_label")) products.fields.add(addField("text_product_unit_label", "unit_label", "text", { max: 30 }))
  if (!products.fields.getByName("description")) products.fields.add(addField("text_product_description", "description", "text", { max: 500 }))
  products.createRule = tableLayoutAdmin
  products.updateRule = tableLayoutAdmin
  products.deleteRule = tableLayoutAdmin
  app.save(products)

  const layouts = baseCollection("table_layouts", [
    relationField("relation_layout_store", "store", stores.id),
    field("number_layout_rows", "row_count", "number", { onlyInt: true, min: 1, max: 20, required: true }),
    field("text_layout_counts", "tables_per_row", "text", { max: 500, required: true })
  ], ["CREATE UNIQUE INDEX idx_table_layouts_store ON table_layouts (store)"], readOnlyRules)

  const bills = baseCollection("table_bills", [
    relationField("relation_bill_store", "store", stores.id),
    relationField("relation_bill_table", "table", tables.id, false),
    field("text_bill_table_name", "table_name", "text", { max: 100, required: true }),
    relationField("relation_bill_customer", "customer", users.id, false),
    relationField("relation_bill_opened_by", "opened_by", users.id),
    relationField("relation_bill_paid_by", "paid_by", users.id, false),
    field("select_bill_status", "status", "select", { maxSelect: 1, values: ["open", "wallet_pending", "paid", "cancelled"], required: true }),
    field("select_bill_payment_method", "payment_method", "select", { maxSelect: 1, values: ["cash", "transfer", "wallet"] }),
    field("number_bill_total", "total_amount", "number", { onlyInt: true, min: 0 }),
    field("number_bill_requested_total", "requested_amount", "number", { onlyInt: true, min: 0 }),
    field("date_bill_started", "started_at", "date", { required: true }),
    field("date_bill_wallet_requested", "wallet_requested_at", "date"),
    field("date_bill_paid", "paid_at", "date"),
    field("text_bill_payment_error", "payment_error", "text", { max: 250 })
  ], [
    "CREATE UNIQUE INDEX idx_table_bills_one_open_per_table ON table_bills (table) WHERE status IN ('open', 'wallet_pending')",
    "CREATE INDEX idx_table_bills_store_status ON table_bills (store, status, created)",
    "CREATE INDEX idx_table_bills_customer_status ON table_bills (customer, status, created)"
  ], { list: billRead, view: billRead, create: null, update: null, delete: null })

  const billItems = baseCollection("table_bill_items", [
    relationField("relation_item_store", "store", stores.id),
    relationField("relation_item_bill", "bill", bills.id, true, true),
    relationField("relation_item_customer", "customer", users.id, false),
    relationField("relation_item_product", "product", products.id, false),
    field("text_item_product_name", "product_name", "text", { max: 255, required: true }),
    field("select_item_unit", "billing_unit", "select", { maxSelect: 1, values: ["hour", "quantity", "weight"], required: true }),
    field("text_item_unit_label", "unit_label", "text", { max: 30 }),
    field("number_item_unit_price", "unit_price", "number", { onlyInt: true, min: 0 }),
    field("number_item_quantity", "quantity", "number", { onlyInt: false, min: 0, required: true }),
    field("date_item_started", "started_at", "date"),
    field("date_item_stopped", "stopped_at", "date"),
    field("number_item_line_total", "line_total", "number", { onlyInt: true, min: 0 })
  ], [
    "CREATE INDEX idx_table_bill_items_bill ON table_bill_items (bill, created)",
    "CREATE INDEX idx_table_bill_items_store ON table_bill_items (store, bill)"
  ], { list: billRead, view: billRead, create: null, update: null, delete: null })

  app.save(layouts)
  app.save(bills)
  app.save(billItems)

  for (const storeId in byStore) {
    const layout = new Record(layouts)
    layout.set("store", storeId)
    layout.set("row_count", 1)
    layout.set("tables_per_row", JSON.stringify([byStore[storeId].length]))
    app.save(layout)
  }
}, (app) => {
  for (const name of ["table_bill_items", "table_bills", "table_layouts"]) {
    try { app.delete(app.findCollectionByNameOrId(name)) } catch (e) {}
  }

  const tables = app.findCollectionByNameOrId("tables")
  tables.fields.removeByName("position")
  tables.fields.removeByName("row_number")
  tables.indexes = tables.indexes.filter((index) => !index.includes("idx_tables_store_row_position"))
  tables.listRule = '@request.auth.id != "" && @request.auth.store = store'
  tables.viewRule = '@request.auth.id != "" && @request.auth.store = store'
  tables.createRule = '@request.auth.id != "" && @request.auth.store = store'
  tables.updateRule = '@request.auth.id != "" && @request.auth.store = store'
  tables.deleteRule = '@request.auth.id != "" && @request.auth.store = store'
  app.save(tables)

  const products = app.findCollectionByNameOrId("products")
  products.fields.removeByName("description")
  products.fields.removeByName("unit_label")
  products.fields.removeByName("billing_unit")
  products.fields.removeByName("category")
  const kind = products.fields.getByName("kind")
  if (kind) kind.values = kind.values.filter((value) => value !== "service")
  products.createRule = '@request.auth.id != "" && @request.auth.store = store'
  products.updateRule = '@request.auth.id != "" && @request.auth.store = store'
  products.deleteRule = '@request.auth.id != "" && @request.auth.store = store'
  app.save(products)
})
