/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const users = app.findCollectionByNameOrId("users")
  const stores = app.findCollectionByNameOrId("stores")

  const collection = new Collection({
    type: "base",
    name: "wallet_topup_requests",
    system: false,
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { id: "text_wallet_topup_id", name: "id", type: "text", required: true, system: true, primaryKey: true, autogeneratePattern: "[a-z0-9]{15}", pattern: "^[a-z0-9]+$", min: 15, max: 15 },
      { id: "relation_wallet_topup_store", name: "store", type: "relation", collectionId: stores.id, required: true, cascadeDelete: true, maxSelect: 1, minSelect: 0 },
      { id: "relation_wallet_topup_user", name: "user", type: "relation", collectionId: users.id, required: true, cascadeDelete: true, maxSelect: 1, minSelect: 0 },
      { id: "number_wallet_topup_amount", name: "amount", type: "number", required: true, onlyInt: true, min: 1 },
      { id: "select_wallet_topup_status", name: "status", type: "select", required: true, maxSelect: 1, minSelect: 0, values: ["pending", "paid", "rejected", "expired"] },
      { id: "text_wallet_topup_transfer_code", name: "transfer_code", type: "text", required: true, max: 40, min: 1, pattern: "^[A-Z0-9-]+$" },
      { id: "text_wallet_topup_proof", name: "proof", type: "text", required: false, max: 500, min: 0, pattern: "" },
      { id: "text_wallet_topup_note", name: "note", type: "text", required: false, max: 500, min: 0, pattern: "" },
      { id: "relation_wallet_topup_reviewer", name: "reviewed_by", type: "relation", collectionId: users.id, required: false, cascadeDelete: false, maxSelect: 1, minSelect: 0 },
      { id: "date_wallet_topup_reviewed_at", name: "reviewed_at", type: "date", required: false },
      { id: "text_wallet_topup_rejection_reason", name: "rejection_reason", type: "text", required: false, max: 500, min: 0, pattern: "" },
      { id: "text_wallet_topup_gateway_transaction", name: "gateway_transaction_id", type: "text", required: false, max: 120, min: 0, pattern: "" },
      { id: "text_wallet_topup_idempotency", name: "idempotency_key", type: "text", required: true, max: 120, min: 1, pattern: "" },
      { id: "autodate_wallet_topup_created", name: "created", type: "autodate", onCreate: true, onUpdate: false, system: false, hidden: false, presentable: false },
      { id: "autodate_wallet_topup_updated", name: "updated", type: "autodate", onCreate: true, onUpdate: true, system: false, hidden: false, presentable: false }
    ],
    indexes: [
      "CREATE INDEX idx_wallet_topups_store_status_created ON wallet_topup_requests (store, status, created)",
      "CREATE UNIQUE INDEX idx_wallet_topups_transfer_code ON wallet_topup_requests (transfer_code)",
      "CREATE UNIQUE INDEX idx_wallet_topups_idempotency ON wallet_topup_requests (idempotency_key) WHERE idempotency_key != ''"
    ]
  })
  return app.save(collection)
}, (app) => {
  try { return app.delete(app.findCollectionByNameOrId("wallet_topup_requests")) } catch (e) {}
})
