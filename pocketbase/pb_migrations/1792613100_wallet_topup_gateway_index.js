/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = app.findCollectionByNameOrId("wallet_topup_requests")
  collection.indexes = collection.indexes.concat(["CREATE UNIQUE INDEX idx_wallet_topups_gateway_transaction ON wallet_topup_requests (gateway_transaction_id) WHERE gateway_transaction_id != ''"])
  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("wallet_topup_requests")
  collection.indexes = collection.indexes.filter((index) => !index.includes("idx_wallet_topups_gateway_transaction"))
  return app.save(collection)
})
