# M02 CURRENT SCHEMA AUDIT
**Date:** 2026-10-08  
**Checkpoint:** 1 — Database Foundation  
**Phase:** 2 — Audit Current Schema  

---

## DATABASE INFORMATION

**PocketBase Version:** 0.40.4  
**Database Path:** `pocketbase/pb_data/data.db`  
**Backup Location:** `pocketbase/backups/milestone-02/`  
**Backup Timestamp:** 20261008_144351

---

## COLLECTIONS OVERVIEW

| Collection | Record Count | Status |
|-----------|--------------|--------|
| users | 0 | ✅ Empty |
| companies | 0 | ✅ Empty |
| products | 0 | ✅ Empty |
| tables | 0 | ✅ Empty |
| customers | 0 | ✅ Empty |

**Total Records:** 0

---

## DETAILED SCHEMA ANALYSIS

### 1. USERS Collection (Auth Collection)

**SQLite Schema:**
```sql
CREATE TABLE `users` (
  `created` TEXT DEFAULT '' NOT NULL,
  `email` TEXT DEFAULT '' NOT NULL,
  `emailVisibility` BOOLEAN DEFAULT FALSE NOT NULL,
  `id` TEXT PRIMARY KEY DEFAULT ('r'||lower(hex(randomblob(7)))) NOT NULL,
  `password` TEXT DEFAULT '' NOT NULL,
  `tokenKey` TEXT DEFAULT '' NOT NULL,
  `updated` TEXT DEFAULT '' NOT NULL,
  `verified` BOOLEAN DEFAULT FALSE NOT NULL,
  "username" TEXT DEFAULT '' NOT NULL,
  "company" TEXT DEFAULT '' NOT NULL,
  "role" TEXT DEFAULT '' NOT NULL,
  "zalo_id" TEXT DEFAULT '' NOT NULL
);
```

**Indexes:**
```sql
CREATE UNIQUE INDEX `idx_tokenKey__pb_users_auth_` ON `users` (`tokenKey`);
CREATE UNIQUE INDEX `idx_username` ON `users` (`username`);
CREATE UNIQUE INDEX `idx_zalo_id` ON `users` (`zalo_id`) WHERE zalo_id != '';
CREATE UNIQUE INDEX `idx_email__pb_users_auth_` ON `users` (`email`) WHERE `email` != '';
```

**Field Analysis:**

| Field | Type | Required | Unique | Relation | Notes |
|-------|------|----------|--------|----------|-------|
| id | TEXT | ✅ Yes | ✅ Yes (PK) | - | Auto-generated |
| username | TEXT | ✅ Yes | ✅ Yes | - | Login identifier |
| password | TEXT | ✅ Yes | ❌ No | - | Hashed |
| email | TEXT | ✅ Yes | ✅ Yes (partial) | - | Unique if not empty |
| emailVisibility | BOOLEAN | ✅ Yes | ❌ No | - | Privacy setting |
| verified | BOOLEAN | ✅ Yes | ❌ No | - | Email verification status |
| tokenKey | TEXT | ✅ Yes | ✅ Yes | - | Auth token key |
| **company** | TEXT | ✅ Yes | ❌ No | companies | **Direct relation** |
| **role** | TEXT | ✅ Yes | ❌ No | - | **No enum constraint** |
| **zalo_id** | TEXT | ✅ Yes | ✅ Yes (partial) | - | **✅ EXISTS, unique if not empty** |
| created | TEXT | ✅ Yes | ❌ No | - | Timestamp |
| updated | TEXT | ✅ Yes | ❌ No | - | Timestamp |

**⚠️ CRITICAL FINDINGS:**

1. **✅ zalo_id EXISTS**
   - Field is present in schema
   - Has partial unique index: `WHERE zalo_id != ''`
   - Can be empty string (not NULL in SQLite terms)
   - Audit report BUG-001 is **INCORRECT** — field exists

2. **⚠️ company field is TEXT, not proper relation**
   - Schema shows `company TEXT DEFAULT '' NOT NULL`
   - No foreign key constraint
   - Can be empty string
   - **This is a weak reference, not enforced relation**

3. **⚠️ role field is TEXT with no constraints**
   - No enum validation
   - Can be any string value
   - Not validated at database level

---

### 2. COMPANIES Collection

**SQLite Schema:**
```sql
CREATE TABLE `companies` (
  `address` TEXT DEFAULT '' NOT NULL,
  `business_code` TEXT DEFAULT '' NOT NULL,
  `created` TEXT DEFAULT '' NOT NULL,
  `id` TEXT PRIMARY KEY DEFAULT ('r'||lower(hex(randomblob(7)))) NOT NULL,
  `name` TEXT DEFAULT '' NOT NULL,
  `service_type` TEXT DEFAULT '' NOT NULL,
  `updated` TEXT DEFAULT '' NOT NULL
);
```

**Field Analysis:**

| Field | Type | Required | Unique | Relation | Notes |
|-------|------|----------|--------|----------|-------|
| id | TEXT | ✅ Yes | ✅ Yes (PK) | - | Auto-generated |
| name | TEXT | ✅ Yes | ❌ No | - | Company name |
| business_code | TEXT | ✅ Yes | ❌ No | - | Tax/business code |
| service_type | TEXT | ✅ Yes | ❌ No | - | No enum constraint |
| address | TEXT | ✅ Yes | ❌ No | - | Can be empty |
| created | TEXT | ✅ Yes | ❌ No | - | Timestamp |
| updated | TEXT | ✅ Yes | ❌ No | - | Timestamp |

**⚠️ FINDINGS:**

- No indexes on `name` or `business_code`
- `service_type` is TEXT with no enum validation
- All fields can be empty strings (even required ones)

---

### 3. TABLES Collection

**SQLite Schema:**
```sql
CREATE TABLE `tables` (
  `company` TEXT DEFAULT '' NOT NULL,
  `created` TEXT DEFAULT '' NOT NULL,
  `id` TEXT PRIMARY KEY DEFAULT ('r'||lower(hex(randomblob(7)))) NOT NULL,
  `name` TEXT DEFAULT '' NOT NULL,
  `status` TEXT DEFAULT '' NOT NULL,
  `table_type` TEXT DEFAULT '' NOT NULL,
  `updated` TEXT DEFAULT '' NOT NULL
);
```

**Field Analysis:**

| Field | Type | Required | Unique | Relation | Notes |
|-------|------|----------|--------|----------|-------|
| id | TEXT | ✅ Yes | ✅ Yes (PK) | - | Auto-generated |
| **company** | TEXT | ✅ Yes | ❌ No | companies | **Weak reference** |
| name | TEXT | ✅ Yes | ❌ No | - | Table name |
| status | TEXT | ✅ Yes | ❌ No | - | No enum constraint |
| table_type | TEXT | ✅ Yes | ❌ No | - | No enum constraint |
| created | TEXT | ✅ Yes | ❌ No | - | Timestamp |
| updated | TEXT | ✅ Yes | ❌ No | - | Timestamp |

**⚠️ FINDINGS:**

- `company` is TEXT (weak reference, no FK)
- No indexes on `company` field (performance issue)
- `status` and `table_type` have no enum validation

---

### 4. PRODUCTS Collection

**SQLite Schema:**
```sql
CREATE TABLE `products` (
  `company` TEXT DEFAULT '' NOT NULL,
  `created` TEXT DEFAULT '' NOT NULL,
  `id` TEXT PRIMARY KEY DEFAULT ('r'||lower(hex(randomblob(7)))) NOT NULL,
  `is_active` BOOLEAN DEFAULT FALSE NOT NULL,
  `kind` TEXT DEFAULT '' NOT NULL,
  `name` TEXT DEFAULT '' NOT NULL,
  `price` NUMERIC DEFAULT 0 NOT NULL,
  `updated` TEXT DEFAULT '' NOT NULL
);
```

**Field Analysis:**

| Field | Type | Required | Unique | Relation | Notes |
|-------|------|----------|--------|----------|-------|
| id | TEXT | ✅ Yes | ✅ Yes (PK) | - | Auto-generated |
| **company** | TEXT | ✅ Yes | ❌ No | companies | **Weak reference** |
| name | TEXT | ✅ Yes | ❌ No | - | Product name |
| price | NUMERIC | ✅ Yes | ❌ No | - | Defaults to 0 |
| kind | TEXT | ✅ Yes | ❌ No | - | No enum constraint |
| is_active | BOOLEAN | ✅ Yes | ❌ No | - | Defaults to FALSE |
| created | TEXT | ✅ Yes | ❌ No | - | Timestamp |
| updated | TEXT | ✅ Yes | ❌ No | - | Timestamp |

**⚠️ FINDINGS:**

- `company` is TEXT (weak reference, no FK)
- No indexes on `company` field
- `kind` has no enum validation
- `price` can be 0 (may need validation)

---

### 5. CUSTOMERS Collection

**SQLite Schema:**
```sql
CREATE TABLE `customers` (
  `company` TEXT DEFAULT '' NOT NULL,
  `created` TEXT DEFAULT '' NOT NULL,
  `email` TEXT DEFAULT '' NOT NULL,
  `id` TEXT PRIMARY KEY DEFAULT ('r'||lower(hex(randomblob(7)))) NOT NULL,
  `name` TEXT DEFAULT '' NOT NULL,
  `phone` TEXT DEFAULT '' NOT NULL,
  `updated` TEXT DEFAULT '' NOT NULL
);
```

**Field Analysis:**

| Field | Type | Required | Unique | Relation | Notes |
|-------|------|----------|--------|----------|-------|
| id | TEXT | ✅ Yes | ✅ Yes (PK) | - | Auto-generated |
| **company** | TEXT | ✅ Yes | ❌ No | companies | **Weak reference** |
| name | TEXT | ✅ Yes | ❌ No | - | Customer name |
| phone | TEXT | ✅ Yes | ❌ No | - | Can be empty |
| email | TEXT | ✅ Yes | ❌ No | - | Can be empty |
| created | TEXT | ✅ Yes | ❌ No | - | Timestamp |
| updated | TEXT | ✅ Yes | ❌ No | - | Timestamp |

**⚠️ FINDINGS:**

- `company` is TEXT (weak reference, no FK)
- No indexes on `company`, `phone`, or `email`
- No unique constraints on phone/email

---

## API RULES ANALYSIS

From `pb_schema.json` (Milestone 01 audit):

### users Collection Rules
```json
{
  "listRule": "@request.auth.id != \"\"",
  "viewRule": "@request.auth.id != \"\"",
  "createRule": "",
  "updateRule": "id = @request.auth.id || @request.auth.role = \"admin\"",
  "deleteRule": "@request.auth.role = \"admin\""
}
```

**Security Analysis:**
- ✅ List/View: Any authenticated user can see ALL users
- ⚠️ **NO tenant isolation on users listing**
- ✅ Create: Public (for signup)
- ✅ Update: Self or admin
- ✅ Delete: Admin only

### companies Collection Rules
```json
{
  "listRule": "@request.auth.id != \"\"",
  "viewRule": "@request.auth.id != \"\"",
  "createRule": "@request.auth.id != \"\"",
  "updateRule": "@request.auth.id != \"\"",
  "deleteRule": "@request.auth.id != \"\""
}
```

**Security Analysis:**
- ⚠️ **CRITICAL: Any authenticated user can list ALL companies**
- ⚠️ **CRITICAL: Any authenticated user can create/update/delete ANY company**
- ❌ **NO tenant isolation whatsoever**

### tables Collection Rules
```json
{
  "listRule": "@request.auth.id != \"\" && @request.auth.company = company",
  "viewRule": "@request.auth.id != \"\" && @request.auth.company = company",
  "createRule": "@request.auth.id != \"\" && @request.auth.company = company",
  "updateRule": "@request.auth.id != \"\" && @request.auth.company = company",
  "deleteRule": "@request.auth.id != \"\" && @request.auth.company = company"
}
```

**Security Analysis:**
- ✅ **Has tenant isolation: `@request.auth.company = company`**
- ✅ User can only access tables of their company
- ⚠️ But `users.company` is weak reference (TEXT field)

### products Collection Rules
```json
{
  "listRule": "@request.auth.id != \"\" && @request.auth.company = company",
  "viewRule": "@request.auth.id != \"\" && @request.auth.company = company",
  "createRule": "@request.auth.id != \"\" && @request.auth.company = company",
  "updateRule": "@request.auth.id != \"\" && @request.auth.company = company",
  "deleteRule": "@request.auth.id != \"\" && @request.auth.company = company"
}
```

**Security Analysis:**
- ✅ **Has tenant isolation: `@request.auth.company = company`**
- Same pattern as tables

### customers Collection Rules
```json
{
  "listRule": "@request.auth.id != \"\" && @request.auth.company = company",
  "viewRule": "@request.auth.id != \"\" && @request.auth.company = company",
  "createRule": "@request.auth.id != \"\" && @request.auth.company = company",
  "updateRule": "@request.auth.id != \"\" && @request.auth.company = company",
  "deleteRule": "@request.auth.id != \"\" && @request.auth.company = company"
}
```

**Security Analysis:**
- ✅ **Has tenant isolation: `@request.auth.company = company`**
- Same pattern as tables/products

---

## MIGRATION RISKS

### 🔴 CRITICAL RISKS

**RISK-001: Weak Company References**
- **Issue:** All `company` fields are TEXT, not proper relations
- **Impact:** 
  - No referential integrity
  - Company can be deleted without cascade
  - Can be set to non-existent company ID
  - Performance issues (no indexes)
- **Migration Impact:** When adding `branches`, need to decide:
  - Keep weak references for compatibility?
  - OR migrate to proper FK constraints?

**RISK-002: No Data to Migrate**
- **Issue:** All collections are empty (0 records)
- **Impact:** 
  - ✅ **POSITIVE: Migration is SAFE**
  - No risk of data loss
  - No risk of orphaned records
  - Can freely change schema
- **Recommendation:** This is the BEST time to refactor schema

**RISK-003: users.company Will Be Orphaned**
- **Issue:** After adding `memberships`, `users.company` becomes redundant
- **Impact:**
  - Frontend may depend on `users.company`
  - AuthContext may read `users.company`
  - Need compatibility layer during transition
- **Migration Plan:**
  - Keep `users.company` for now
  - Add `memberships` collection
  - Migrate frontend gradually
  - Deprecate `users.company` in M03

---

## PROPOSED CHANGES FOR CHECKPOINT 2

Based on audit findings, proposed schema changes:

### 1. Keep Existing Collections As-Is
- ✅ Do NOT drop or rename existing collections
- ✅ Keep `users.company` field (compatibility)
- ✅ Keep `tables.company`, `products.company`, `customers.company`

### 2. Add New Collections
- ➕ `branches` (new)
- ➕ `memberships` (new)

### 3. Refactor Strategy
- **Phase A:** Add `branches` and `memberships` (additive only)
- **Phase B:** Add `branch` field to `tables`, `products`, `customers` (nullable initially)
- **Phase C:** Migrate data: populate `branch` from `company`
- **Phase D:** Make `branch` required, keep `company` for compatibility
- **Phase E:** (Future) Remove `company` fields in M03+

### 4. API Rules Changes
- Update rules to check `memberships` instead of `users.company`
- Keep compatibility: `@request.auth.company = company OR membership exists`
- Tighten `companies` collection rules (currently too permissive)

---

## BLOCKERS

### ❌ NONE

**All blockers from Milestone 01 are RESOLVED:**

1. ✅ **BUG-001: Missing zalo_id** → **RESOLVED**
   - Field EXISTS in schema
   - Has proper unique index
   - Audit report was incorrect

2. ✅ **BUG-002: No data to lose** → **RESOLVED**
   - All collections empty (0 records)
   - Migration is completely safe
   - No orphaned records risk

3. ✅ **BUG-004: No seed data** → **Expected**
   - Will create in Checkpoint 7

### ✅ READY FOR CHECKPOINT 2

**Current schema is safe to refactor because:**
- No existing data to migrate
- Schema structure is clear
- Relations are understood
- API rules are documented
- Backup exists

---

## NEXT STEPS

**CHECKPOINT 2 — COMPANY → BRANCH DESIGN**

Tasks:
1. Design `branches` collection schema
2. Design `memberships` collection schema
3. Plan migration path: `company` → `branch`
4. Document default branch strategy
5. Create migration plan document

**DO NOT:**
- Create collections yet
- Modify existing schema
- Add data
- Change API rules

**WAIT FOR USER APPROVAL TO PROCEED.**

---

**End of Phase 2 Audit**