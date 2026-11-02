/// <reference path="../pb_data/types.d.ts" />

const actorSnapshot = (app, id) => {
  if (!id) return { id: "", name: "Hệ thống", role: "" }
  try {
    const user = app.findRecordById("users", id)
    return { id, name: user.get("fullname") || user.get("username") || "Không rõ", role: user.get("role") || "" }
  } catch (e) {
    return { id, name: "Không rõ", role: "" }
  }
}

const addEvent = (app, collection, input) => {
  const event = new Record(collection)
  event.set("store", input.store)
  event.set("bill_id", input.billId)
  event.set("table_name", input.tableName || "Bàn")
  event.set("category", input.category)
  event.set("event_type", input.eventType)
  event.set("title", input.title)
  event.set("actor_id", input.actor.id)
  event.set("actor_name", input.actor.name)
  event.set("actor_role", input.actor.role)
  if (input.paymentMethod) event.set("payment_method", input.paymentMethod)
  if (Number.isSafeInteger(input.amount) && input.amount >= 0) event.set("amount", input.amount)
  event.set("details", JSON.stringify(input.details || {}))
  event.set("happened_at", input.happenedAt || new Date().toISOString())
  app.save(event)
}

migrate((app) => {
  let collection
  try { collection = app.findCollectionByNameOrId("table_bill_events") } catch (e) {
    collection = new Collection({
    type: "base",
    name: "table_bill_events",
    system: false,
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { autogeneratePattern: "[a-z0-9]{15}", id: "text_table_bill_event_id", name: "id", pattern: "^[a-z0-9]+$", required: true, system: true, type: "text", max: 15, min: 15, primaryKey: true },
      { id: "relation_table_bill_event_store", name: "store", type: "relation", collectionId: app.findCollectionByNameOrId("stores").id, required: true, cascadeDelete: true, maxSelect: 1, minSelect: 0 },
      { id: "text_table_bill_event_bill", name: "bill_id", type: "text", required: true, max: 40, min: 0, pattern: "" },
      { id: "text_table_bill_event_table", name: "table_name", type: "text", required: true, max: 100, min: 0, pattern: "" },
      { id: "select_table_bill_event_category", name: "category", type: "select", required: true, maxSelect: 1, minSelect: 0, values: ["payment", "action"] },
      { id: "select_table_bill_event_type", name: "event_type", type: "select", required: true, maxSelect: 1, minSelect: 0, values: ["bill_opened", "item_added", "quantity_changed", "item_removed", "billing_paused", "billing_resumed", "bill_merged_into", "bill_merged_from", "bill_split_out", "bill_split_created", "payment_started", "payment_requested", "payment_failed", "payment_completed"] },
      { id: "text_table_bill_event_title", name: "title", type: "text", required: true, max: 160, min: 0, pattern: "" },
      { id: "text_table_bill_event_actor_id", name: "actor_id", type: "text", required: false, max: 40, min: 0, pattern: "" },
      { id: "text_table_bill_event_actor_name", name: "actor_name", type: "text", required: false, max: 120, min: 0, pattern: "" },
      { id: "text_table_bill_event_actor_role", name: "actor_role", type: "text", required: false, max: 30, min: 0, pattern: "" },
      { id: "select_table_bill_event_method", name: "payment_method", type: "select", required: false, maxSelect: 1, minSelect: 0, values: ["cash", "transfer", "wallet"] },
      { help: "", hidden: false, id: "number_table_bill_event_amount", max: null, min: 0, name: "amount", onlyInt: true, presentable: false, required: false, system: false, type: "number", default: 0 },
      { help: "", hidden: false, id: "text_table_bill_event_details", max: 65536, min: 0, name: "details", pattern: "", presentable: false, required: false, system: false, type: "text" },
      { id: "date_table_bill_event_happened", name: "happened_at", type: "date", required: true, min: "", max: "" },
      { id: "autodate_table_bill_event_created", name: "created", type: "autodate", onCreate: true, onUpdate: false, required: false, system: false, hidden: false, presentable: false },
      { id: "autodate_table_bill_event_updated", name: "updated", type: "autodate", onCreate: true, onUpdate: true, required: false, system: false, hidden: false, presentable: false }
    ],
    indexes: []
    })
  }
  app.save(collection)
  collection.indexes = [
    "CREATE INDEX idx_table_bill_events_store_time ON table_bill_events (store, happened_at)",
    "CREATE INDEX idx_table_bill_events_store_bill_time ON table_bill_events (store, bill_id, happened_at)",
    "CREATE INDEX idx_table_bill_events_store_category_time ON table_bill_events (store, category, happened_at)"
  ]
  app.save(collection)

  const bills = app.findRecordsByFilter("table_bills", "store != ''", "created", -1, 0)
  for (const bill of bills) {
    const store = String(bill.get("store") || "")
    const tableName = String(bill.get("table_name") || "Bàn")
    const openedBy = actorSnapshot(app, String(bill.get("opened_by") || ""))
    addEvent(app, collection, {
      store,
      billId: bill.id,
      tableName,
      category: "action",
      eventType: "bill_opened",
      title: "Mở " + tableName,
      actor: openedBy,
      details: { customerId: String(bill.get("customer") || "") },
      happenedAt: bill.get("started_at") || bill.get("created")
    })

    const requestedAt = String(bill.get("wallet_requested_at") || "")
    const method = String(bill.get("payment_method") || "")
    if (requestedAt && ["wallet", "transfer"].includes(method)) {
      const requester = actorSnapshot(app, String(bill.get("customer") || ""))
      addEvent(app, collection, {
        store,
        billId: bill.id,
        tableName,
        category: "payment",
        eventType: "payment_requested",
        title: method === "transfer" ? "Khách báo đã chuyển khoản" : "Khách yêu cầu trừ ví",
        actor: requester,
        paymentMethod: method,
        amount: Math.round(Number(bill.get("requested_amount")) || 0),
        details: {},
        happenedAt: requestedAt
      })
    }

    const paidAt = String(bill.get("paid_at") || "")
    if (bill.get("status") === "paid" && paidAt && ["cash", "transfer", "wallet"].includes(method)) {
      const payer = actorSnapshot(app, String(bill.get("paid_by") || ""))
      addEvent(app, collection, {
        store,
        billId: bill.id,
        tableName,
        category: "payment",
        eventType: "payment_completed",
        title: "Đã thanh toán hóa đơn",
        actor: payer,
        paymentMethod: method,
        amount: Math.round(Number(bill.get("total_amount")) || 0),
        details: {},
        happenedAt: paidAt
      })
    }
  }
}, (app) => {
  try { return app.delete(app.findCollectionByNameOrId("table_bill_events")) } catch (e) {}
})
