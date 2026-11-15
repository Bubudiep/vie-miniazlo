const defaultSettings = () => ({ tiers: [], maxPromoBalance: 0, expiryMode: "days", expiryDate: "" })

module.exports.getSettings = (app, store) => {
  try {
    const record = app.findFirstRecordByFilter("wallet_promo_settings", "store = {:store}", { store })
    return Object.assign(defaultSettings(), JSON.parse(record.get("settings") || "{}"))
  } catch (e) {
    return defaultSettings()
  }
}

module.exports.awardTopupBonus = (app, RecordType, wallet, topup, store, actorId = "") => {
  const settings = module.exports.getSettings(app, store)
  const amount = Number(topup.get("amount")) || 0
  const tier = (settings.tiers || [])
    .filter((item) => Number(item.minTopup) <= amount)
    .sort((a, b) => Number(b.minTopup) - Number(a.minTopup))[0]
  if (!tier) return 0

  let bonus = tier.type === "percent"
    ? Math.floor(amount * Number(tier.value) / 100)
    : Number(tier.value)
  if (!Number.isSafeInteger(bonus) || bonus <= 0) return 0

  const now = new Date()
  const nowIso = now.toISOString()
  const lots = app.findRecordsByFilter(
    "wallet_promo_lots",
    "wallet = {:wallet} && status = 'active' && remaining_amount > 0 && expires_at > {:now}",
    "expires_at,created",
    -1,
    0,
    { wallet: wallet.id, now: nowIso },
  )
  const balance = lots.reduce((sum, lot) => sum + (Number(lot.get("remaining_amount")) || 0), 0)
  const cap = Number(settings.maxPromoBalance) || 0
  if (cap > 0) bonus = Math.min(bonus, Math.max(0, cap - balance))
  if (bonus <= 0) return 0

  const expiresAt = settings.expiryMode === "date"
    ? new Date(String(settings.expiryDate || "") + "T23:59:59.999+07:00")
    : new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= now.getTime()) return 0

  const userId = String(topup.get("user") || "")
  const lot = new RecordType(app.findCollectionByNameOrId("wallet_promo_lots"))
  lot.set("wallet", wallet.id)
  lot.set("user", userId)
  lot.set("store", store)
  lot.set("original_amount", bonus)
  lot.set("remaining_amount", bonus)
  lot.set("expires_at", expiresAt.toISOString())
  lot.set("status", "active")
  if (actorId) lot.set("created_by", actorId)
  app.save(lot)

  const transaction = new RecordType(app.findCollectionByNameOrId("wallet_transactions"))
  transaction.set("wallet", wallet.id)
  transaction.set("user", userId)
  transaction.set("store", store)
  transaction.set("wallet_type", "promo")
  transaction.set("direction", "credit")
  transaction.set("amount", bonus)
  transaction.set("reason", "Thưởng nạp tiền " + (topup.get("transfer_code") || ""))
  if (actorId) transaction.set("actor", actorId)
  transaction.set("promo_lot", lot.id)
  transaction.set("reference_type", "topup")
  transaction.set("reference_id", topup.id)
  transaction.set("idempotency_key", "topup-promo-" + topup.id)
  transaction.set("balance_before", balance)
  transaction.set("balance_after", balance + bonus)
  app.save(transaction)
  lot.set("source_transaction", transaction.id)
  app.save(lot)
  return bonus
}
