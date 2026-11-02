# Checkpoint 6 — Phase 1 Planning Summary

**Date:** 2026-01-09  
**Status:** ✅ DESIGN COMPLETED — Ready for approval  
**PocketBase:** 0.40.4 (PID 15104, port 8390)  
**Database:** Empty (0 records) — Safe to refactor

---

## Business Decisions Confirmed

All 5 decisions analyzed and incorporated:

1. ✅ **Company creation: Invite-only** → System admin authorization required
2. ✅ **Customer: View menu + create orders** → Collections `orders`/`order_items` designed
3. ✅ **Manager: Cannot create branches** → Only company-wide owners can
4. ✅ **Membership: Invitation links** → Collection `invitations` designed with expiration/limits
5. ✅ **Multiple memberships: Explicit context switch** → X-Active-Company/Branch headers

---

## Critical Vulnerabilities Fixed in Phase 1

1. 🔴 **Fatal role check:** `@request.auth.role = 'owner'` never matches → Block direct API
2. 🔴 **No company authorization:** Anyone can CRUD companies → Set rules to `null`
3. 🔴 **Self-promotion:** Users can edit `users.company`/`role` → Make fields non-updateable
4. 🔴 **Direct membership API:** Self-promotion possible → Block direct access
5. 🔴 **Cross-tenant leak:** Users see all companies → Implement proper scoping

---

## Phase 1 Deliverables

### Files to Create

1. **`pb_migrations/1791537XXX_secure_users_fields.js`** — Block company/role updates
2. **`pb_migrations/1791537XXX_secure_companies.js`** — Lock companies API Rules
3. **`pb_migrations/1791537XXX_secure_memberships.js`** — Lock memberships API Rules
4. **`pb_hooks/auth_utils.pb.js`** — Authorization utilities & middleware
5. **`pb_hooks/custom_endpoints.pb.js`** — Custom endpoints (my-memberships, my-companies)

### Test Fixtures (Prefix: M06_TEST_)

- Companies: Alpha Corp, Beta Inc
- Branches: HQ, Store 1, Main Office
- Users: owner, manager, cashier, staff, no_membership (via Zalo auth)
- Memberships: company-wide and branch-specific roles

---

## Phase 1 Test Matrix

**Category 1: Self-Promotion Prevention**
- User updates own users.company → 403
- User updates own users.role → 403
- User creates membership for self → 403

**Category 2: Direct API Blocking**
- POST /api/collections/companies/records → 403
- POST /api/collections/memberships/records → 403

**Category 3: Custom Endpoint Authorization**
- GET /api/custom/memberships/my-memberships → 200 OK (with JWT)
- GET /api/custom/memberships/my-memberships → 401 (no JWT)

---

## Out of Scope (Future Phases)

- **Phase 2:** Invitation system implementation
- **Phase 3:** Customer ordering + frontend migration
- **Phase 4:** Resource branch assignment

---

## Decision Required

**🔴 Company creation authorization:**

- **Option A (Recommended):** System admin field
- **Option B:** Special invitations (Phase 2)
- **Option C:** Existing owners can create

---

## Backup & Rollback

✅ Backup verified: `backups/milestone-02/checkpoint-5-after/`

**Before implementation:**
```bash
mkdir -p backups/milestone-02/checkpoint-6-before
cp -r pb_data backups/milestone-02/checkpoint-6-before/pb_data_$(date +%Y%m%d_%H%M%S)
```

**Rollback:**
```bash
rm -rf pb_data
cp -r backups/milestone-02/checkpoint-6-before/pb_data_TIMESTAMP pb_data
```

---

## Files Modified in Planning Phase

**Created:**
- [`CHECKPOINT_6_PHASE1_PLAN.md`](CHECKPOINT_6_PHASE1_PLAN.md) — Detailed plan
- [`CHECKPOINT_6_PHASE1_SUMMARY.md`](CHECKPOINT_6_PHASE1_SUMMARY.md) — This file

**Not Modified:**
- No schema, API Rules, hooks, or data changes
- No process restarts or git commits

---

**Status:** ✅ READY FOR APPROVAL  
**Risk:** LOW (empty DB, full backups, reversible)  
**Time:** ~3-4 hours implementation

---

**End of Planning Phase**
