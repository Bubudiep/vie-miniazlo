migrate((app) => {
  const topups = app.findCollectionByNameOrId("wallet_topup_requests")
  if (!topups.indexes.some((index) => index.includes("idx_wallet_topups_store_user_status_created"))) {
    topups.indexes = topups.indexes.concat([
      "CREATE INDEX idx_wallet_topups_store_user_status_created ON wallet_topup_requests (store, user, status, created)"
    ])
    app.save(topups)
  }
}, (app) => {
  const topups = app.findCollectionByNameOrId("wallet_topup_requests")
  topups.indexes = topups.indexes.filter((index) => !index.includes("idx_wallet_topups_store_user_status_created"))
  app.save(topups)
})
