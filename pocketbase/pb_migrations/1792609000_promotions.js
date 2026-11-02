/// <reference path="../pb_data/types.d.ts" />

const textField = (id, name, required = false, max = 255) => ({
  id, name, type: "text", required, max, min: 0, pattern: "", system: false, hidden: false, presentable: false, help: ""
})
const numberField = (id, name, required = false) => ({
  id, name, type: "number", required, min: 0, max: null, onlyInt: true, default: 0, system: false, hidden: false, presentable: false, help: ""
})
const boolField = (id, name, defaultValue = false) => ({
  id, name, type: "bool", required: false, default: defaultValue, system: false, hidden: false, presentable: false, help: ""
})
const jsonField = (id, name) => ({ id, name, type: "text", required: false, max: 65536, min: 0, pattern: "", system: false, hidden: false, presentable: false, help: "" })
const selectField = (id, name, values, required = true) => ({
  id, name, type: "select", required, maxSelect: 1, minSelect: 0, values, system: false, hidden: false, presentable: false, help: ""
})
const relationField = (id, name, collectionId, required = true) => ({
  id, name, type: "relation", collectionId, required, maxSelect: 1, minSelect: 0, cascadeDelete: false, system: false, hidden: false, presentable: false, help: ""
})
const dates = [
  { id: "autodate_promotion_created", name: "created", type: "autodate", onCreate: true, onUpdate: false, system: false, hidden: false, presentable: false },
  { id: "autodate_promotion_updated", name: "updated", type: "autodate", onCreate: true, onUpdate: true, system: false, hidden: false, presentable: false }
]
const locked = { list: null, view: null, create: null, update: null, delete: null }

migrate((app) => {
  const stores = app.findCollectionByNameOrId("stores")
  const users = app.findCollectionByNameOrId("users")
  const bills = app.findCollectionByNameOrId("table_bills")
  try {
    const events = app.findCollectionByNameOrId("table_bill_events")
    const eventType = events.fields.getByName("event_type")
    if (eventType && !eventType.values.includes("promotion_applied")) { eventType.values = eventType.values.concat(["promotion_applied"]); app.save(events) }
  } catch (e) {}

  const createCollection = (name, fields, indexes, rules) => {
    try { return app.findCollectionByNameOrId(name) } catch (e) {
      const collection = new Collection({ type: "base", name, fields, indexes, listRule: rules.list, viewRule: rules.view, createRule: rules.create, updateRule: rules.update, deleteRule: rules.delete })
      app.save(collection)
      return collection
    }
  }

  const groups = createCollection("customer_groups", [
    relationField("relation_customer_group_store", "store", stores.id),
    textField("text_customer_group_name", "name", true, 100),
    boolField("bool_customer_group_active", "active", true),
    ...dates
  ], [], locked)

  const cards = createCollection("member_card_types", [
    relationField("relation_member_card_store", "store", stores.id),
    textField("text_member_card_code", "code", true, 40),
    textField("text_member_card_name", "name", true, 100),
    boolField("bool_member_card_active", "active", true),
    ...dates
  ], [], locked)

  const groupMembers = createCollection("customer_group_members", [
    relationField("relation_customer_group_member_store", "store", stores.id),
    relationField("relation_customer_group_member_group", "group", groups.id),
    relationField("relation_customer_group_member_user", "user", users.id),
    ...dates
  ], [], locked)

  const cardMembers = createCollection("customer_member_cards", [
    relationField("relation_customer_member_card_store", "store", stores.id),
    relationField("relation_customer_member_card_card", "card", cards.id),
    relationField("relation_customer_member_card_user", "user", users.id),
    textField("text_customer_member_card_number", "card_number", false, 60),
    ...dates
  ], [], locked)

  const promotions = createCollection("promotions", [
    relationField("relation_promotion_store", "store", stores.id),
    textField("text_promotion_name", "name", true, 160),
    boolField("bool_promotion_active", "active", true),
    selectField("select_promotion_type", "promotion_type", ["percent", "amount", "fixed_price"]),
    numberField("number_promotion_value", "value", true),
    numberField("number_promotion_min_invoice", "min_invoice_amount"),
    numberField("number_promotion_max_discount", "max_discount"),
    boolField("bool_promotion_auto_apply", "auto_apply", true),
    { id: "date_promotion_start_at", name: "start_at", type: "date", required: true, min: "", max: "", system: false, hidden: false, presentable: false },
    { id: "date_promotion_end_at", name: "end_at", type: "date", required: true, min: "", max: "", system: false, hidden: false, presentable: false },
    jsonField("json_promotion_weekdays", "weekdays"),
    textField("text_promotion_time_start", "time_start", false, 5),
    textField("text_promotion_time_end", "time_end", false, 5),
    selectField("select_promotion_scope", "scope", ["invoice", "category", "product"]),
    jsonField("json_promotion_categories", "target_categories"),
    jsonField("json_promotion_products", "target_products"),
    selectField("select_promotion_audience", "audience", ["all", "group", "card"]),
    jsonField("json_promotion_groups", "target_groups"),
    jsonField("json_promotion_cards", "target_cards"),
    ...dates
  ], [], locked)

  const addBillField = (field) => {
    if (bills.fields.getByName(field.name)) return
    if (field.type === "relation") bills.fields.add(new RelationField(field))
    else if (field.type === "number") bills.fields.add(new NumberField(field))
    else if (field.type === "json") bills.fields.add(new JSONField(field))
    else bills.fields.add(new Field(field))
  }
  addBillField(relationField("relation_bill_promotion", "promotion", promotions.id, false))
  addBillField({ id: "json_bill_promotion_snapshot", name: "promotion_snapshot", type: "json", required: false, maxSize: 65536 })
  addBillField(numberField("number_bill_gross_amount", "gross_amount"))
  addBillField(numberField("number_bill_discount_amount", "discount_amount"))
  addBillField(boolField("bool_bill_promotion_manual", "promotion_manual", false))
  app.save(bills)

  const existingBills = app.findRecordsByFilter("table_bills", "store != ''", "created", -1, 0)
  for (const bill of existingBills) {
    if (Number(bill.get("gross_amount")) > 0 || Number(bill.get("total_amount")) === 0) continue
    bill.set("gross_amount", Number(bill.get("total_amount")) || 0)
    bill.set("discount_amount", 0)
    app.save(bill)
  }
}, (app) => {
  const bills = app.findCollectionByNameOrId("table_bills")
  for (const name of ["promotion", "promotion_snapshot", "gross_amount", "discount_amount", "promotion_manual"]) {
    try { bills.fields.removeByName(name) } catch (e) {}
  }
  app.save(bills)
  for (const name of ["customer_member_cards", "customer_group_members", "member_card_types", "customer_groups", "promotions"]) {
    try { app.delete(app.findCollectionByNameOrId(name)) } catch (e) {}
  }
})
