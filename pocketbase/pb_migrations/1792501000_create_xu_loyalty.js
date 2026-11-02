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

const textField = (id, name, required = false, max = 255) => ({
  help: "",
  hidden: false,
  id,
  max,
  min: 0,
  name,
  pattern: "",
  presentable: false,
  required,
  system: false,
  type: "text"
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

const baseCollection = (name, fields, indexes, rules) => new Collection({
  type: "base",
  name,
  fields: fields.concat([
    { hidden: false, id: "autodate_xu_created", name: "created", onCreate: true, onUpdate: false, presentable: false, system: false, type: "autodate" },
    { hidden: false, id: "autodate_xu_updated", name: "updated", onCreate: true, onUpdate: true, presentable: false, system: false, type: "autodate" }
  ]),
  indexes,
  listRule: rules.list,
  viewRule: rules.view,
  createRule: rules.create,
  updateRule: rules.update,
  deleteRule: rules.delete
})

migrate((app) => {
  const xuCollectionNames = ["xu_accounts", "xu_transactions", "xu_settings", "xu_checkins", "xu_referrals", "xu_milestones", "xu_rewards", "xu_redemptions"]
  let existingXuCollections = 0
  for (const name of xuCollectionNames) {
    try { app.findCollectionByNameOrId(name); existingXuCollections++ } catch (e) {}
  }
  if (existingXuCollections > 0) {
    const importedUsers = app.findCollectionByNameOrId("users")
    const hasReferralFields = ["xu_referral_code", "pending_xu_referral_code"].every((name) => {
      try { return !!importedUsers.fields.getByName(name) } catch (e) { return false }
    })
    const hasReferralIndex = importedUsers.indexes.some((index) => index.includes("idx_users_xu_referral_code"))
    if (existingXuCollections === xuCollectionNames.length && hasReferralFields && hasReferralIndex) return
    throw new Error(`Partial Xu schema detected (collections: ${existingXuCollections}/8, referral fields: ${hasReferralFields}, referral index: ${hasReferralIndex}); complete the import or remove partial Xu collections before running migrations.`)
  }

  const users = app.findCollectionByNameOrId("users")
  const stores = app.findCollectionByNameOrId("stores")
  const userOwn = '@request.auth.id != "" && user = @request.auth.id'
  const storeAdmin = '@request.auth.id != "" && @request.auth.role = "admin" && @request.auth.store = store'
  const ownOrAdmin = `(${userOwn}) || (${storeAdmin})`
  const adminOnly = storeAdmin

  users.fields.add(new TextField({
    hidden: true,
    id: "text_xu_referral_code",
    max: 16,
    min: 0,
    name: "xu_referral_code",
    pattern: "^[A-Z0-9]+$",
    presentable: false,
    required: false,
    system: false,
    type: "text"
  }))
  users.fields.add(new TextField({
    hidden: true,
    id: "text_xu_pending_code",
    max: 16,
    min: 0,
    name: "pending_xu_referral_code",
    pattern: "^[A-Z0-9]*$",
    presentable: false,
    required: false,
    system: false,
    type: "text"
  }))
  const referralIndex = "CREATE UNIQUE INDEX idx_users_xu_referral_code ON users (xu_referral_code) WHERE xu_referral_code != ''"
  if (!users.indexes.includes(referralIndex)) users.indexes = users.indexes.concat([referralIndex])
  app.save(users)

  const accounts = baseCollection("xu_accounts", [
    relation("relation_xu_account_user", "user", users.id),
    relation("relation_xu_account_store", "store", stores.id),
    numberField("number_xu_balance", "balance")
  ], [
    "CREATE UNIQUE INDEX idx_xu_accounts_user_store ON xu_accounts (user, store)"
  ], { list: ownOrAdmin, view: ownOrAdmin, create: null, update: null, delete: null })

  const transactions = baseCollection("xu_transactions", [
    relation("relation_xu_tx_account", "account", accounts.id),
    relation("relation_xu_tx_user", "user", users.id),
    relation("relation_xu_tx_store", "store", stores.id),
    selectField("select_xu_tx_direction", "direction", ["credit", "debit"]),
    numberField("number_xu_tx_amount", "amount", true),
    textField("text_xu_tx_reason", "reason", true, 500),
    relation("relation_xu_tx_actor", "actor", users.id, false),
    textField("text_xu_tx_ref_type", "reference_type"),
    textField("text_xu_tx_ref_id", "reference_id"),
    textField("text_xu_tx_idempotency", "idempotency_key", true, 180),
    numberField("number_xu_tx_before", "balance_before"),
    numberField("number_xu_tx_after", "balance_after")
  ], [
    "CREATE INDEX idx_xu_transactions_user_created ON xu_transactions (user, created)",
    "CREATE INDEX idx_xu_transactions_store_created ON xu_transactions (store, created)",
    "CREATE UNIQUE INDEX idx_xu_transactions_idempotency ON xu_transactions (idempotency_key)"
  ], { list: ownOrAdmin, view: ownOrAdmin, create: null, update: null, delete: null })

  const settings = baseCollection("xu_settings", [
    relation("relation_xu_settings_store", "store", stores.id),
    numberField("number_xu_daily_reward", "daily_checkin_reward"),
    numberField("number_xu_weekly_reward", "weekly_checkin_reward"),
    numberField("number_xu_referral_reward", "referral_reward"),
    numberField("number_xu_referral_5_reward", "referral_5_reward"),
    numberField("number_xu_referral_10_reward", "referral_10_reward"),
    relation("relation_xu_settings_actor", "updated_by", users.id, false)
  ], [
    "CREATE UNIQUE INDEX idx_xu_settings_store ON xu_settings (store)"
  ], { list: adminOnly, view: adminOnly, create: null, update: null, delete: null })

  const checkins = baseCollection("xu_checkins", [
    relation("relation_xu_checkin_user", "user", users.id),
    relation("relation_xu_checkin_store", "store", stores.id),
    textField("text_xu_checkin_date", "local_date", true, 10),
    textField("text_xu_checkin_week", "week_key", true, 10),
    numberField("number_xu_checkin_day_reward", "daily_reward"),
    numberField("number_xu_checkin_week_reward", "weekly_reward"),
    textField("text_xu_checkin_tx_ids", "transaction_ids", false, 500)
  ], [
    "CREATE UNIQUE INDEX idx_xu_checkins_user_store_date ON xu_checkins (user, store, local_date)",
    "CREATE INDEX idx_xu_checkins_user_week ON xu_checkins (user, store, week_key)"
  ], { list: ownOrAdmin, view: ownOrAdmin, create: null, update: null, delete: null })

  const referrals = baseCollection("xu_referrals", [
    relation("relation_xu_referral_referrer", "referrer", users.id),
    relation("relation_xu_referral_referred", "referred", users.id),
    relation("relation_xu_referral_store", "store", stores.id),
    textField("text_xu_referral_used_code", "used_code", true, 16),
    selectField("select_xu_referral_status", "status", ["pending", "approved"]),
    dateField("date_xu_referral_approved", "approved_at"),
    numberField("number_xu_referral_reward", "reward_amount")
  ], [
    "CREATE UNIQUE INDEX idx_xu_referrals_referred_store ON xu_referrals (referred, store)",
    "CREATE INDEX idx_xu_referrals_referrer_status ON xu_referrals (referrer, status)"
  ], { list: adminOnly, view: adminOnly, create: null, update: null, delete: null })

  const milestones = baseCollection("xu_milestones", [
    relation("relation_xu_milestone_user", "user", users.id),
    relation("relation_xu_milestone_store", "store", stores.id),
    numberField("number_xu_milestone_count", "referral_count", true),
    numberField("number_xu_milestone_reward", "reward_amount"),
    textField("text_xu_milestone_tx_id", "transaction_id", false, 20)
  ], [
    "CREATE UNIQUE INDEX idx_xu_milestones_user_store_count ON xu_milestones (user, store, referral_count)"
  ], { list: adminOnly, view: adminOnly, create: null, update: null, delete: null })

  const rewards = baseCollection("xu_rewards", [
    relation("relation_xu_reward_store", "store", stores.id),
    textField("text_xu_reward_name", "name", true, 120),
    textField("text_xu_reward_description", "description", false, 500),
    numberField("number_xu_reward_cost", "cost", true),
    numberField("number_xu_reward_stock", "stock"),
    { help: "", hidden: false, id: "bool_xu_reward_active", name: "active", presentable: false, required: false, system: false, type: "bool" }
  ], [
    "CREATE INDEX idx_xu_rewards_store_active ON xu_rewards (store, active, created)"
  ], { list: '@request.auth.id != "" && @request.auth.store = store', view: '@request.auth.id != "" && @request.auth.store = store', create: null, update: null, delete: null })

  const redemptions = baseCollection("xu_redemptions", [
    relation("relation_xu_redemption_user", "user", users.id),
    relation("relation_xu_redemption_store", "store", stores.id),
    relation("relation_xu_redemption_reward", "reward", rewards.id, false),
    textField("text_xu_redemption_reward_name", "reward_name", true, 120),
    numberField("number_xu_redemption_cost", "cost", true),
    selectField("select_xu_redemption_status", "status", ["pending", "approved", "rejected", "fulfilled"]),
    textField("text_xu_redemption_idempotency", "idempotency_key", true, 180),
    textField("text_xu_redemption_note", "note", false, 500),
    relation("relation_xu_redemption_handler", "handled_by", users.id, false)
  ], [
    "CREATE UNIQUE INDEX idx_xu_redemptions_idempotency ON xu_redemptions (idempotency_key)",
    "CREATE INDEX idx_xu_redemptions_store_status ON xu_redemptions (store, status, created)",
    "CREATE INDEX idx_xu_redemptions_user_created ON xu_redemptions (user, created)"
  ], { list: ownOrAdmin, view: ownOrAdmin, create: null, update: null, delete: null })

  for (const collection of [accounts, transactions, settings, checkins, referrals, milestones, rewards, redemptions]) {
    app.save(collection)
  }
}, (app) => {
  for (const name of ["xu_redemptions", "xu_rewards", "xu_milestones", "xu_referrals", "xu_checkins", "xu_settings", "xu_transactions", "xu_accounts"]) {
    try { app.delete(app.findCollectionByNameOrId(name)) } catch (e) {}
  }
  const users = app.findCollectionByNameOrId("users")
  users.fields.removeByName("pending_xu_referral_code")
  users.fields.removeByName("xu_referral_code")
  users.indexes = users.indexes.filter((index) => !index.includes("idx_users_xu_referral_code"))
  app.save(users)
})
