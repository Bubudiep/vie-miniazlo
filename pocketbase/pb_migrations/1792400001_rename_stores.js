/// <reference path="../pb_data/types.d.ts" />

const relatedCollections = [
  "users", "products", "tables", "customers", "branches", "memberships",
  "wallets", "wallet_transactions", "wallet_promo_lots", "orders", "wallet_admin_logs",
]
const rules = ["listRule", "viewRule", "createRule", "updateRule", "deleteRule"]

function rename(app, from, to) {
  const store = app.findCollectionByNameOrId(from)
  store.name = to
  app.save(store)

  for (const name of relatedCollections) {
    const collection = app.findCollectionByNameOrId(name)
    const field = collection.fields.getByName(from === "companies" ? "company" : "store")
    field.name = from === "companies" ? "store" : "company"

    const changes = { indexes: collection.indexes.map((index) => index.replace(/\b(company|store)\b/g, (value) => value === "company" ? "store" : "company")) }
    for (const rule of rules) {
      changes[rule] = collection[rule] == null ? null : collection[rule].replace(/\b(company|store)\b/g, (value) => value === "company" ? "store" : "company")
    }
    unmarshal(changes, collection)
    app.save(collection)
  }
}

migrate((app) => rename(app, "companies", "stores"), (app) => rename(app, "stores", "companies"))
