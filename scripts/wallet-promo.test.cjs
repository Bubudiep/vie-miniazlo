const assert = require("node:assert/strict")
const fs = require("node:fs")
const vm = require("node:vm")
const promoModule = { exports: {} }
vm.runInNewContext(fs.readFileSync(require.resolve("../pocketbase/pb_hooks/wallet_promo.js"), "utf8"), { module: promoModule, exports: promoModule.exports })
const { awardTopupBonus } = promoModule.exports

let nextId = 0
class FakeRecord {
  constructor(collection) { this.collection = collection; this.id = `record-${++nextId}`; this.data = {} }
  get(key) { return this.data[key] }
  set(key, value) { this.data[key] = value }
}

const run = ({ settings, existingLots = [], amount = 100000 }) => {
  const saved = []
  const app = {
    findFirstRecordByFilter: () => ({ get: () => JSON.stringify(settings) }),
    findRecordsByFilter: () => existingLots,
    findCollectionByNameOrId: (name) => name,
    save: (record) => saved.push(record),
  }
  const topup = { id: "topup-1", get: (key) => ({ amount, user: "user-1", transfer_code: "NAP1" })[key] }
  const awarded = awardTopupBonus(app, FakeRecord, { id: "wallet-1" }, topup, "store-1", "admin-1")
  return { awarded, saved }
}

const fixed = run({ settings: {
  tiers: [{ minTopup: 50000, type: "fixed", value: 10000 }, { minTopup: 100000, type: "fixed", value: 20000 }],
  maxPromoBalance: 105000,
  expiryMode: "days",
  expiryDate: "",
}, existingLots: [{ get: () => 100000 }] })
assert.equal(fixed.awarded, 5000)
assert.equal(fixed.saved.find((item) => item.collection === "wallet_promo_lots").get("remaining_amount"), 5000)
const fixedExpiry = new Date(fixed.saved.find((item) => item.collection === "wallet_promo_lots").get("expires_at"))
assert.ok(Math.abs(fixedExpiry.getTime() - Date.now() - 3 * 86400000) < 1000)

const percent = run({ settings: { tiers: [{ minTopup: 100000, type: "percent", value: 2.5 }], maxPromoBalance: 0, expiryMode: "date", expiryDate: "2099-12-31" } })
assert.equal(percent.awarded, 2500)
assert.equal(new Date(percent.saved.find((item) => item.collection === "wallet_promo_lots").get("expires_at")).toISOString(), "2099-12-31T16:59:59.999Z")

assert.equal(run({ settings: { tiers: [{ minTopup: 100001, type: "fixed", value: 1000 }], maxPromoBalance: 0, expiryMode: "days" } }).awarded, 0)
assert.equal(run({ settings: { tiers: [{ minTopup: 1, type: "fixed", value: 1000 }], maxPromoBalance: 100000, expiryMode: "days" }, existingLots: [{ get: () => 100000 }] }).awarded, 0)
console.log("wallet-promo: tier selection, cap, and expiry checks passed")
