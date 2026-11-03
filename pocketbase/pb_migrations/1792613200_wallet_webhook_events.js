/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const stores = app.findCollectionByNameOrId("stores")
  const topups = app.findCollectionByNameOrId("wallet_topup_requests")
  const collection = new Collection({
    type: "base",
    name: "wallet_webhook_events",
    system: false,
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { id: "text_wallet_webhook_event_id", name: "id", type: "text", required: true, system: true, primaryKey: true, autogeneratePattern: "[a-z0-9]{15}", pattern: "^[a-z0-9]+$", min: 15, max: 15 },
      { id: "text_wallet_webhook_provider", name: "provider", type: "text", required: true, max: 30, min: 1, pattern: "" },
      { id: "text_wallet_webhook_event_key", name: "event_key", type: "text", required: true, max: 120, min: 1, pattern: "" },
      { id: "relation_wallet_webhook_store", name: "store", type: "relation", collectionId: stores.id, required: false, cascadeDelete: false, maxSelect: 1, minSelect: 0 },
      { id: "relation_wallet_webhook_topup", name: "topup", type: "relation", collectionId: topups.id, required: false, cascadeDelete: false, maxSelect: 1, minSelect: 0 },
      { id: "text_wallet_webhook_gateway_transaction", name: "gateway_transaction_id", type: "text", required: false, max: 120, min: 0, pattern: "" },
      { id: "text_wallet_webhook_account", name: "account_number", type: "text", required: false, max: 120, min: 0, pattern: "" },
      { id: "number_wallet_webhook_amount", name: "amount", type: "number", required: false, onlyInt: true, min: 0 },
      { id: "text_wallet_webhook_content", name: "transfer_content", type: "text", required: false, max: 500, min: 0, pattern: "" },
      { id: "select_wallet_webhook_status", name: "status", type: "select", required: true, maxSelect: 1, minSelect: 0, values: ["received", "processed", "ignored", "failed"] },
      { id: "text_wallet_webhook_failure", name: "failure_reason", type: "text", required: false, max: 500, min: 0, pattern: "" },
      { id: "text_wallet_webhook_hash", name: "payload_hash", type: "text", required: false, max: 64, min: 0, pattern: "" },
      { id: "date_wallet_webhook_received", name: "received_at", type: "date", required: true },
      { id: "autodate_wallet_webhook_created", name: "created", type: "autodate", onCreate: true, onUpdate: false, system: false, hidden: false, presentable: false },
      { id: "autodate_wallet_webhook_updated", name: "updated", type: "autodate", onCreate: true, onUpdate: true, system: false, hidden: false, presentable: false }
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_wallet_webhook_provider_event ON wallet_webhook_events (provider, event_key)",
      "CREATE UNIQUE INDEX idx_wallet_webhook_gateway_transaction ON wallet_webhook_events (provider, gateway_transaction_id) WHERE gateway_transaction_id != ''"
    ]
  })
  return app.save(collection)
}, (app) => {
  try { return app.delete(app.findCollectionByNameOrId("wallet_webhook_events")) } catch (e) {}
})
