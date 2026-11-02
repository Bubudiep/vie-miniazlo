/// <reference path="../pb_data/types.d.ts" />

const relationField = (id, name, collectionId, required = true, cascadeDelete = true) => ({
  id,
  name,
  type: "relation",
  collectionId,
  required,
  cascadeDelete,
  maxSelect: 1,
  minSelect: 0,
  system: false,
  hidden: false,
  presentable: false
})

const textField = (id, name, max, required = false) => ({
  id,
  name,
  type: "text",
  required,
  max,
  min: 0,
  pattern: "",
  system: false,
  hidden: false,
  presentable: false,
  help: ""
})

const dateField = (id, name, required = false) => ({
  id,
  name,
  type: "date",
  required,
  min: "",
  max: "",
  system: false,
  hidden: false,
  presentable: false
})

const numberField = (id, name, options = {}) => ({
  id,
  name,
  type: "number",
  required: false,
  min: null,
  max: null,
  onlyInt: false,
  default: 0,
  system: false,
  hidden: false,
  presentable: false,
  help: "",
  ...options
})

const dates = (prefix) => [
  { id: `autodate_${prefix}_created`, name: "created", type: "autodate", onCreate: true, onUpdate: false, system: false, hidden: false, presentable: false },
  { id: `autodate_${prefix}_updated`, name: "updated", type: "autodate", onCreate: true, onUpdate: true, system: false, hidden: false, presentable: false }
]

const locked = { listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null }

migrate((app) => {
  const stores = app.findCollectionByNameOrId("stores")
  const users = app.findCollectionByNameOrId("users")
  const products = app.findCollectionByNameOrId("products")
  const billItems = app.findCollectionByNameOrId("table_bill_items")

  if (!billItems.fields.getByName("purchase_price")) {
    billItems.fields.add(new NumberField({
      id: "number_bill_item_purchase_price",
      name: "purchase_price",
      required: false,
      min: 0,
      onlyInt: true,
      default: 0
    }))
    app.save(billItems)
  }

  let inventory
  try { inventory = app.findCollectionByNameOrId("inventory_movements") } catch (e) {
    inventory = new Collection({
      type: "base",
      name: "inventory_movements",
      fields: [
        relationField("relation_inventory_store", "store", stores.id),
        relationField("relation_inventory_product", "product", products.id, false, false),
        { id: "select_inventory_type", name: "movement_type", type: "select", required: true, maxSelect: 1, minSelect: 0, values: ["in", "sale", "adjustment"], system: false, hidden: false, presentable: false },
        numberField("number_inventory_quantity_delta", "quantity_delta", { required: true }),
        numberField("number_inventory_unit_cost", "unit_cost", { onlyInt: true, min: 0 }),
        textField("text_inventory_reference_type", "reference_type", 40),
        textField("text_inventory_reference_id", "reference_id", 40),
        textField("text_inventory_source_key", "source_key", 180),
        textField("text_inventory_note", "note", 500),
        relationField("relation_inventory_actor", "actor", users.id, false),
        dateField("date_inventory_occurred", "occurred_at", true),
        ...dates("inventory")
      ],
      indexes: [
        "CREATE INDEX idx_inventory_store_product_time ON inventory_movements (store, product, occurred_at)",
        "CREATE INDEX idx_inventory_store_time ON inventory_movements (store, occurred_at)",
        "CREATE UNIQUE INDEX idx_inventory_source_key ON inventory_movements (source_key) WHERE source_key != ''"
      ],
      ...locked
    })
    app.save(inventory)
  }

  let expenses
  try { expenses = app.findCollectionByNameOrId("expenses") } catch (e) {
    expenses = new Collection({
      type: "base",
      name: "expenses",
      fields: [
        relationField("relation_expense_store", "store", stores.id),
        numberField("number_expense_amount", "amount", { required: true, onlyInt: true, min: 0 }),
        textField("text_expense_category", "category", 80, true),
        textField("text_expense_note", "note", 500),
        dateField("date_expense_spent", "spent_at", true),
        relationField("relation_expense_creator", "created_by", users.id, false),
        ...dates("expense")
      ],
      indexes: [
        "CREATE INDEX idx_expenses_store_spent_at ON expenses (store, spent_at)"
      ],
      ...locked
    })
    app.save(expenses)
  }

  const existingItems = app.findRecordsByFilter("table_bill_items", "purchase_price = 0", "created", -1, 0)
  for (const item of existingItems) {
    const productId = String(item.get("product") || "")
    if (!productId) continue
    try {
      const product = app.findRecordById("products", productId)
      item.set("purchase_price", Math.max(0, Math.round(Number(product.get("purchase_price")) || 0)))
      app.save(item)
    } catch (e) {}
  }
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("expenses")) } catch (e) {}
  try { app.delete(app.findCollectionByNameOrId("inventory_movements")) } catch (e) {}
  try {
    const billItems = app.findCollectionByNameOrId("table_bill_items")
    if (billItems.fields.getByName("purchase_price")) billItems.fields.removeByName("purchase_price")
    app.save(billItems)
  } catch (e) {}
})
