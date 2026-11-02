/// <reference path="../pb_data/types.d.ts" />

const relation = (id, name, collectionId, required = true, cascadeDelete = false) => ({
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

const numberField = (id, name, required = false) => ({
  help: "",
  hidden: false,
  id,
  max: null,
  min: 0,
  name,
  onlyInt: true,
  presentable: false,
  required,
  system: false,
  type: "number",
  default: 0
})

const textField = (id, name, required = false) => ({
  help: "",
  hidden: false,
  id,
  max: 255,
  min: 0,
  name,
  pattern: "",
  presentable: false,
  required,
  system: false,
  type: "text"
})

const dateField = (id, name, required = false) => ({
  help: "",
  hidden: false,
  id,
  max: "",
  min: "",
  name,
  presentable: false,
  required,
  system: false,
  type: "date"
})

const selectField = (id, name, values, required = true) => ({
  help: "",
  hidden: false,
  id,
  maxSelect: 1,
  name,
  presentable: false,
  required,
  system: false,
  type: "select",
  values
})

const baseCollection = (name, fields, indexes, rules) => new Collection({
  type: "base",
  name,
  fields: fields.concat([
    {
      hidden: false,
      id: "autodate_wallet_created",
      name: "created",
      onCreate: true,
      onUpdate: false,
      presentable: false,
      system: false,
      type: "autodate"
    },
    {
      hidden: false,
      id: "autodate_wallet_updated",
      name: "updated",
      onCreate: true,
      onUpdate: true,
      presentable: false,
      system: false,
      type: "autodate"
    }
  ]),
  indexes,
  listRule: rules.list,
  viewRule: rules.view,
  createRule: rules.create,
  updateRule: rules.update,
  deleteRule: rules.delete
})

migrate((app) => {
  const users = app.findCollectionByNameOrId("users")
  const companies = app.findCollectionByNameOrId("companies")
  const tables = app.findCollectionByNameOrId("tables")

  const own = '@request.auth.id != "" && user = @request.auth.id'
  const companyAdmin = '@request.auth.id != "" && @request.auth.role = "admin" && @request.auth.company = company'
  const ownOrCompanyAdmin = `(${own}) || (${companyAdmin})`

  const wallets = baseCollection(
    "wallets",
    [
      relation("relation_user_wallet", "user", users.id, true, true),
      relation("relation_company_wallet", "company", companies.id, true, true),
      numberField("number_main_balance", "main_balance")
    ],
    ["CREATE UNIQUE INDEX idx_wallets_user_company ON wallets (user, company)"],
    {
      list: ownOrCompanyAdmin,
      view: ownOrCompanyAdmin,
      create: null,
      update: null,
      delete: null
    }
  )

  const promoLots = baseCollection(
    "wallet_promo_lots",
    [
      relation("relation_wallet_lot", "wallet", wallets.id, true, true),
      relation("relation_user_lot", "user", users.id, true, true),
      relation("relation_company_lot", "company", companies.id, true, true),
      numberField("number_original_amount", "original_amount"),
      numberField("number_remaining_amount", "remaining_amount"),
      dateField("date_expires_at", "expires_at", true),
      selectField("select_lot_status", "status", ["active", "expired", "consumed"]),
      relation("relation_created_by_lot", "created_by", users.id, false)
    ],
    [
      "CREATE INDEX idx_wallet_promo_lots_wallet_status_expiry ON wallet_promo_lots (wallet, status, expires_at)"
    ],
    {
      list: ownOrCompanyAdmin,
      view: ownOrCompanyAdmin,
      create: null,
      update: null,
      delete: null
    }
  )

  const transactions = baseCollection(
    "wallet_transactions",
    [
      relation("relation_wallet_transaction", "wallet", wallets.id, true, true),
      relation("relation_user_transaction", "user", users.id, true, true),
      relation("relation_company_transaction", "company", companies.id, true, true),
      selectField("select_wallet_type", "wallet_type", ["main", "promo"]),
      selectField("select_wallet_direction", "direction", ["credit", "debit"]),
      numberField("number_transaction_amount", "amount"),
      textField("text_transaction_reason", "reason", true),
      relation("relation_actor_transaction", "actor", users.id, false),
      textField("text_reference_type", "reference_type"),
      textField("text_reference_id", "reference_id"),
      textField("text_idempotency_key", "idempotency_key"),
      numberField("number_balance_before", "balance_before"),
      numberField("number_balance_after", "balance_after")
    ],
    [
      "CREATE INDEX idx_wallet_transactions_wallet_created ON wallet_transactions (wallet, created)",
      "CREATE UNIQUE INDEX idx_wallet_transactions_idempotency ON wallet_transactions (idempotency_key) WHERE idempotency_key != ''"
    ],
    {
      list: ownOrCompanyAdmin,
      view: ownOrCompanyAdmin,
      create: null,
      update: null,
      delete: null
    }
  )

  const orders = baseCollection(
    "orders",
    [
      relation("relation_order_user", "user", users.id, true, true),
      relation("relation_order_company", "company", companies.id, true, true),
      relation("relation_order_table", "table", tables.id, false),
      numberField("number_order_total", "total_amount"),
      selectField("select_order_status", "status", ["unpaid", "paid", "cancelled"]),
      selectField("select_order_payment_method", "payment_method", ["wallet", "transfer", "cash"], false),
      dateField("date_order_paid_at", "paid_at"),
      textField("text_order_idempotency_key", "idempotency_key")
    ],
    [
      "CREATE INDEX idx_orders_user_status ON orders (user, status, created)",
      "CREATE UNIQUE INDEX idx_orders_idempotency ON orders (idempotency_key) WHERE idempotency_key != ''"
    ],
    {
      list: ownOrCompanyAdmin,
      view: ownOrCompanyAdmin,
      create: null,
      update: null,
      delete: null
    }
  )

  const adminLogs = baseCollection(
    "wallet_admin_logs",
    [
      relation("relation_admin_log_company", "company", companies.id, true, true),
      relation("relation_admin_log_actor", "actor", users.id, true),
      textField("text_admin_log_action", "action", true),
      textField("text_admin_log_details", "details"),
      numberField("number_admin_log_affected_count", "affected_count")
    ],
    ["CREATE INDEX idx_wallet_admin_logs_company_created ON wallet_admin_logs (company, created)"],
    {
      list: companyAdmin,
      view: companyAdmin,
      create: null,
      update: null,
      delete: null
    }
  )

  app.save(wallets)
  app.save(transactions)
  app.save(promoLots)

  transactions.fields.add(new RelationField({
    cascadeDelete: false,
    collectionId: promoLots.id,
    help: "",
    hidden: false,
    id: "relation_promo_lot_transaction",
    maxSelect: 1,
    minSelect: 0,
    name: "promo_lot",
    presentable: false,
    required: false,
    system: false,
    type: "relation"
  }))
  app.save(transactions)

  promoLots.fields.add(new RelationField({
    cascadeDelete: false,
    collectionId: transactions.id,
    help: "",
    hidden: false,
    id: "relation_source_transaction_lot",
    maxSelect: 1,
    minSelect: 0,
    name: "source_transaction",
    presentable: false,
    required: false,
    system: false,
    type: "relation"
  }))
  app.save(promoLots)
  app.save(orders)
  app.save(adminLogs)
}, (app) => {
  for (const name of ["wallet_admin_logs", "orders", "wallet_promo_lots", "wallet_transactions", "wallets"]) {
    try {
      app.delete(app.findCollectionByNameOrId(name))
    } catch (e) {
      // Rollback remains safe when a collection was not created.
    }
  }
})
