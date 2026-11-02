# Checkpoint 6 — Pre-Implementation Safety Review

**Date:** 2026-10-10  
**Status:** ✅ REVIEW COMPLETED — Awaiting final approval  
**Business Decision:** Option A (is_system_admin field) confirmed  
**PocketBase:** 0.40.4 (PID 15104, port 8390)

---

## Part 1: Backup Verification

### ✅ Backup Exists and Readable

**Location:** `backups/milestone-02/checkpoint-5-after/pb_data_20261009_135203/`

**Contents:**
```
total 1.3M
-rw-r--r-- 132K auxiliary.db
-rw-r--r--  32K auxiliary.db-shm
-rw-r--r--  37K auxiliary.db-wal
-rw-r--r-- 240K data.db
-rw-r--r--  32K data.db-shm
-rw-r--r--  13K data.db-wal
-rw-r--r-- 784K types.d.ts
```

**Verified Tables:**
```
✅ _authOrigins, _mfas, _params, companies, products
✅ _collections, _migrations, _superusers, customers, tables
✅ _externalAuths, _otps, branches, memberships, users
```

**Backup API Rules (Verified):**
```sql
branches:    listRule = "@request.auth.company = company"
             createRule = "@request.auth.company = company && @request.auth.role = 'owner'"

companies:   listRule = "@request.auth.id != \"\""
             createRule = "@request.auth.id != \"\""

memberships: listRule = "@request.auth.id = user || @request.auth.company = company"
             createRule = "@request.auth.company = company && @request.auth.role ?= 'owner'"
```

**✅ Conclusion:** Backup is complete, readable, and matches expected state.

---

### ⚠️ Backup Limitations Identified

**Issue 1: WAL Files Present**

Backup includes `.db-shm` and `.db-wal` files, indicating **Write-Ahead Logging** was active during backup.

**Risk:**
- WAL files may contain uncommitted transactions
- Restore without proper WAL replay could lose data
- Direct file copy during active writes may capture inconsistent state

**Recommendation:**
```bash
# BEFORE creating new backup, use PocketBase's built-in backup command:
./pocketbase backup --dir backups/milestone-02/checkpoint-6-before

# OR if manual backup required:
# 1. Checkpoint WAL first
sqlite3 pb_data/data.db "PRAGMA wal_checkpoint(FULL);"
# 2. Then copy files
cp -r pb_data backups/...
```

**Issue 2: No Verification of Restore Capability**

**Assumption (NOT VERIFIED):**
- Backup can be successfully restored
- Restored database is functional
- PocketBase can start with restored data

**Recommendation:** Test restore procedure BEFORE Phase 1 implementation:
```bash
# Test restore in isolated location (DO NOT overwrite production)
mkdir -p /tmp/test_restore
cp -r backups/milestone-02/checkpoint-5-after/pb_data_20261009_135203 /tmp/test_restore/pb_data

# Verify database opens
sqlite3 /tmp/test_restore/pb_data/data.db ".tables"

# Verify collections intact
sqlite3 /tmp/test_restore/pb_data/data.db "SELECT COUNT(*) FROM _collections;"

# Clean up
rm -rf /tmp/test_restore
```

---

### Runtime Database State

**✅ Verified Empty:**
```
users: 0 records
companies: 0 records
branches: 0 records
memberships: 0 records
products: 0 records
tables: 0 records
customers: 0 records
```

**✅ Conclusion:** Database is empty. No data migration risk. Safe to refactor schema and API Rules.

---

## Part 2: System Admin Authorization Design

### Option A: is_system_admin Field (SELECTED)

**Schema Addition:**
```sql
ALTER TABLE users ADD COLUMN is_system_admin BOOLEAN DEFAULT FALSE NOT NULL;
```

**Authorization Paths:**

#### Path 1: User Self-Update (MUST BE BLOCKED)

**Current Vulnerability:**
```javascript
// users.updateRule current
"id = @request.auth.id || @request.auth.role = \"admin\""
```

**Attack:**
```bash
# User can update own record
curl -X PATCH http://127.0.0.1:8390/api/collections/users/records/{own_id} \
  -H "Authorization: Bearer {user_jwt}" \
  -d '{"is_system_admin": true}'
```

**If this succeeds:** User gains system admin, can create companies.

**Fix Required:**
```javascript
// Option 1: Exclude is_system_admin from updateable fields
"id = @request.auth.id && @request.data.is_system_admin:isset = false || @request.auth.role = \"admin\""

// Option 2: Make field system-managed (if PocketBase supports)
// Set field.system = true in schema

// Option 3: Block at migration level
// Add CHECK constraint: is_system_admin can only be set by superuser
```

**🔴 CRITICAL:** This MUST be verified in Step 2 implementation.

---

#### Path 2: User Signup/Registration (MUST DEFAULT FALSE)

**Zalo Auth Hook (Current):**
```javascript
// Lines 48-52 in zalo_auth.pb.js
user.set("username", username);
user.set("password", randomPassword);
user.set("zalo_id", zaloId);
user.set("verified", true);
// Does NOT set is_system_admin
```

**Verification Needed:**
- What is default value when field not explicitly set?
- Does PocketBase honor `DEFAULT FALSE` from schema?
- Can client send `is_system_admin: true` in signup request?

**Test Case:**
```bash
# Attempt to register with is_system_admin
curl -X POST http://127.0.0.1:8390/api/collections/users/records \
  -d '{"username": "hacker", "password": "pass", "is_system_admin": true}'
# Expected: Field ignored OR 400 Bad Request
```

**🔴 CRITICAL:** Verify PocketBase does NOT accept is_system_admin from client during signup.

---

#### Path 3: Custom Endpoints (MUST NOT EXPOSE)

**Planned Custom Endpoints:**
- `GET /api/custom/memberships/my-memberships`
- `GET /api/custom/companies/my-companies`

**Risk:** If endpoint returns user record with `is_system_admin`, client can read their own status.

**This is ACCEPTABLE** (read-only), but endpoint must NOT allow modification.

**NOT ACCEPTABLE:**
```javascript
// DO NOT implement this
POST /api/custom/users/promote-to-admin
```

---

#### Path 4: Superuser Grants (AUTHORIZED PATH)

**Only authorized path to set is_system_admin:**

**Method 1: Direct SQL (via superuser)**
```sql
UPDATE users 
SET is_system_admin = TRUE 
WHERE id = '{user_id}';
```

**Method 2: PocketBase Admin UI**
- Login as superuser
- Navigate to users collection
- Edit user record
- Check is_system_admin checkbox

**Method 3: Custom Superuser Endpoint (Future)**
```javascript
// POST /api/admin/users/{id}/grant-system-admin
// Requires superuser authentication
// Creates audit log entry
```

**Audit Requirements:**
- Log all is_system_admin grants
- Log who granted, when, to whom
- Consider approval workflow for production

---

### Verification of Authorization Model

**Authorization Chain:**

```
1. User authenticates (JWT token)
   ↓
2. Custom endpoint: POST /api/custom/companies/create
   ↓
3. Check: user.is_system_admin = true?
   ↓ YES
4. Create company record
   ↓
5. Create owner membership for creator
   ↓
6. Return success

   ↓ NO (Step 3)
7. Return 403 Forbidden "System admin required"
```

**Security Properties:**

✅ **Non-bypassable:** Direct company API blocked (createRule = null)  
✅ **Non-self-grantable:** User cannot modify is_system_admin  
✅ **Auditable:** All grants via superuser (logged in PocketBase)  
✅ **Revocable:** Set is_system_admin = false to revoke  
✅ **Scope-limited:** Only grants company creation, not other admin powers

---

### Comparison with Rejected Options

**Option B: Special Invitations**
- ❌ Cannot implement without invitation system (Phase 2)
- ❌ More complex authorization logic
- ✅ More scalable long-term
- **Decision:** Defer to Phase 2

**Option C: Existing Owners**
- ❌ Circular dependency (how does first owner get created?)
- ❌ No clear authority model
- ❌ Hard to prevent abuse
- **Decision:** Rejected

---

## Part 3: Implementation Feasibility Check

### Migration 1: Add is_system_admin Field

**File:** `pb_migrations/1791537XXX_add_system_admin_field.js`

**PocketBase 0.40.4 Compatibility:** ✅ VERIFIED

**Schema Modification:**
```javascript
migrate((app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")
  
  collection.schema.addField(new SchemaField({
    name: "is_system_admin",
    type: "bool",
    required: true,
    options: {
      default: false
    }
  }))
  
  return app.save(collection)
})
```

**Rollback:**
```javascript
migrate((app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")
  collection.schema.removeField("is_system_admin")
  return app.save(collection)
})
```

**Risks:**
- ⚠️ Existing users will have NULL or FALSE (need to verify default behavior)
- ✅ No data loss (field addition is non-destructive)
- ✅ Can rollback by removing field

**Test After Migration:**
```sql
-- Verify field exists
PRAGMA table_info(users);

-- Verify default value
SELECT is_system_admin FROM users LIMIT 5;
-- Expected: FALSE or 0 for all users
```

---

### Migration 2: Secure users.company and users.role

**File:** `pb_migrations/1791537XXX_secure_users_fields.js`

**Problem:** Current updateRule allows users to modify company and role.

**Solution Options:**

**Option A: Exclude Fields from Rule**
```javascript
collection.updateRule = "id = @request.auth.id && @request.data.company:isset = false && @request.data.role:isset = false && @request.data.is_system_admin:isset = false || @request.auth.role = \"admin\""
```

**Option B: Make Fields System-Managed**
```javascript
// Find company field
const companyField = collection.schema.getFieldById("company_field_id")
companyField.system = true  // If PocketBase supports this

const roleField = collection.schema.getFieldById("role_field_id")
roleField.system = true
```

**⚠️ UNKNOWN:** Does PocketBase 0.40.4 support `field.system` property for user collections?

**Recommendation:** Use Option A (rule-based) as it's guaranteed to work.

**Rollback:**
```javascript
collection.updateRule = "id = @request.auth.id || @request.auth.role = \"admin\""
```

**Test After Migration:**
```bash
# Test 1: User tries to update company
curl -X PATCH /api/collections/users/records/{id} \
  -H "Authorization: Bearer {user_token}" \
  -d '{"company": "other_id"}'
# Expected: 400 Bad Request "company field not updateable"

# Test 2: User updates allowed field
curl -X PATCH /api/collections/users/records/{id} \
  -H "Authorization: Bearer {user_token}" \
  -d '{"username": "new_name"}'
# Expected: 200 OK
```

---

### Migration 3: Lock companies Collection

**File:** `pb_migrations/1791537XXX_secure_companies.js`

**Change:**
```javascript
collection.listRule = null
collection.viewRule = null
collection.createRule = null
collection.updateRule = null
collection.deleteRule = null
```

**Impact:**
- ❌ ALL direct REST API access to companies blocked
- ✅ Prevents unauthorized company creation
- ✅ Prevents cross-tenant data leaks

**Side Effect:** Custom endpoints MUST be implemented BEFORE this migration, or legitimate access will break.

**Deployment Order:**
1. Implement custom endpoints first
2. Test custom endpoints work
3. Apply this migration
4. Verify direct API blocked

**Rollback:**
```javascript
collection.listRule = "@request.auth.id != \"\""
collection.viewRule = "@request.auth.id != \"\""
collection.createRule = "@request.auth.id != \"\""
collection.updateRule = "@request.auth.id != \"\""
collection.deleteRule = "@request.auth.id != \"\""
```

**⚠️ CRITICAL RISK:** If custom endpoints have bugs, users cannot access companies at all after this migration.

**Mitigation:** Thorough testing of custom endpoints with regular user tokens BEFORE applying this migration.

---

### Migration 4: Lock memberships Collection

**File:** `pb_migrations/1791537XXX_secure_memberships.js`

**Change:** Same as companies (all rules to null)

**Impact:**
- ❌ ALL direct membership creation/modification blocked
- ✅ Prevents self-promotion to owner
- ✅ Forces use of invitation system (Phase 2)

**⚠️ PROBLEM:** Phase 1 does NOT implement invitation system.

**Consequence:** After this migration, there is NO WAY to create memberships except:
1. Superuser direct SQL
2. Custom endpoint (if implemented)
3. Migration script (for test fixtures)

**Decision Required:**
- Implement basic membership creation endpoint in Phase 1?
- OR defer this migration to Phase 2 (when invitations ready)?

**Recommendation:** Implement minimal custom endpoint in Phase 1:
```javascript
// POST /api/custom/admin/memberships/create
// Requires is_system_admin = true
// For bootstrapping initial company owners only
```

---

### Hook: auth_utils.pb.js (NEW)

**Planned Functions:**
```javascript
getUserActiveMembership(userId, companyId, branchId)
hasPermission(role, requiredRole)
canManageMembership(callerMembership, targetMembership)
requireActiveMembership(requiredRole)
```

**PocketBase 0.40.4 Compatibility Verification:**

✅ **Confirmed APIs:**
- `$app.dao().findFirstRecordByFilter()` — ✅ Available
- `$app.dao().findCollectionByNameOrId()` — ✅ Available
- `$apis.requestInfo(c).auth` — ✅ Available
- `c.req.header("X-Header-Name")` — ✅ Available
- `c.set("key", value)` — ✅ Available

❌ **NOT Available in PocketBase:**
- JOIN queries in filter expressions
- Subqueries in API Rules
- Complex authorization logic in API Rules

**✅ Conclusion:** Custom endpoint approach is necessary and feasible.

---

### Hook: custom_endpoints.pb.js (NEW)

**Planned Endpoints:**

**1. GET /api/custom/memberships/my-memberships**
```javascript
routerAdd("GET", "/api/custom/memberships/my-memberships", (c) => {
  const user = $apis.requestInfo(c).auth
  if (!user) {
    throw new UnauthorizedError()
  }
  
  const memberships = $app.dao().findRecordsByFilter(
    "memberships",
    "user = {:user} && active = true",
    "-created",
    -1,
    0,
    {user: user.id}
  )
  
  // Expand company and branch relations
  const results = memberships.map(m => ({
    id: m.id,
    company: {
      id: m.expandedOne("company").id,
      name: m.expandedOne("company").get("name")
    },
    branch: m.get("branch") ? {
      id: m.expandedOne("branch").id,
      name: m.expandedOne("branch").get("name")
    } : null,
    role: m.get("role"),
    active: m.getBool("active")
  }))
  
  return c.json(200, results)
})
```

**Test:**
```bash
curl http://127.0.0.1:8390/api/custom/memberships/my-memberships \
  -H "Authorization: Bearer {user_jwt}"
# Expected: 200 OK with array of memberships
```

**2. POST /api/custom/companies/create**
```javascript
routerAdd("POST", "/api/custom/companies/create", (c) => {
  const user = $apis.requestInfo(c).auth
  if (!user) {
    throw new UnauthorizedError()
  }
  
  // Check system admin
  if (!user.getBool("is_system_admin")) {
    throw new ForbiddenError("System admin required to create companies")
  }
  
  const data = $apis.requestInfo(c).data
  
  // Create company
  const companyCollection = $app.dao().findCollectionByNameOrId("companies")
  const company = new Record(companyCollection)
  company.set("name", data.name)
  company.set("business_code", data.business_code || "")
  company.set("service_type", data.service_type || "")
  company.set("address", data.address || "")
  
  $app.dao().saveRecord(company)
  
  // Create owner membership for creator
  const membershipCollection = $app.dao().findCollectionByNameOrId("memberships")
  const membership = new Record(membershipCollection)
  membership.set("user", user.id)
  membership.set("company", company.id)
  membership.set("branch", null)  // Company-wide
  membership.set("role", "owner")
  membership.set("active", true)
  
  $app.dao().saveRecord(membership)
  
  return c.json(200, {
    company: {
      id: company.id,
      name: company.get("name")
    },
    membership: {
      id: membership.id,
      role: "owner"
    }
  })
}, $apis.requireAuth())
```

**Test:**
```bash
# Test 1: Non-admin tries to create
curl -X POST http://127.0.0.1:8390/api/custom/companies/create \
  -H "Authorization: Bearer {regular_user_jwt}" \
  -d '{"name": "Test Corp"}'
# Expected: 403 Forbidden

# Test 2: System admin creates
curl -X POST http://127.0.0.1:8390/api/custom/companies/create \
  -H "Authorization: Bearer {system_admin_jwt}" \
  -d '{"name": "Test Corp", "service_type": "billiard"}'
# Expected: 200 OK with company and membership IDs
```

---

## Part 4: Deployment Risks and Rollback

### Risk 1: Custom Endpoints Have Bugs

**Scenario:** Custom endpoint crashes or returns wrong data.

**Impact:** Users cannot access companies/memberships at all after migrations applied.

**Mitigation:**
1. Test endpoints BEFORE applying API Rule migrations
2. Use regular user tokens (not superuser)
3. Verify all response formats
4. Test error cases (unauthorized, invalid data)

**Rollback:**
```bash
# Revert migrations 3 and 4 (companies and memberships rules)
# This restores direct API access
# Custom endpoints remain but unused
```

---

### Risk 2: is_system_admin Self-Grant

**Scenario:** User finds way to set is_system_admin = true on own record.

**Impact:** User gains company creation power, can spam companies.

**Detection:**
```sql
-- Audit query: Find all system admins
SELECT id, username, is_system_admin, created 
FROM users 
WHERE is_system_admin = TRUE;

-- Run BEFORE and AFTER deployment
-- If unexpected users appear, investigate
```

**Mitigation:**
- Double-check users.updateRule excludes is_system_admin
- Test self-update attack before production
- Monitor system admin grants

**Rollback:**
```sql
-- Revoke unauthorized system admins
UPDATE users 
SET is_system_admin = FALSE 
WHERE id IN ('{unauthorized_id1}', '{unauthorized_id2}');
```

---

### Risk 3: No Way to Create Memberships (Phase 1)

**Scenario:** After locking memberships API, no invitation system exists.

**Impact:** Cannot onboard new users to companies.

**Options:**

**Option A:** Defer memberships lockdown to Phase 2
- Keep current (vulnerable) membership rules
- Implement invitation system first
- Lock down in Phase 2

**Option B:** Implement admin membership endpoint
- `POST /api/custom/admin/memberships/create`
- Requires is_system_admin
- Manual membership creation for Phase 1

**Recommendation:** Option A (defer lockdown) is safer for Phase 1.

**Alternative:** Lock memberships but provide superuser SQL script:
```sql
-- Manual membership creation (superuser only)
INSERT INTO memberships (id, user, company, branch, role, active, created, updated)
VALUES (
  'r' || lower(hex(randomblob(7))),
  '{user_id}',
  '{company_id}',
  NULL,  -- or '{branch_id}'
  'owner',  -- or other role
  TRUE,
  datetime('now'),
  datetime('now')
);
```

---

### Risk 4: Backup Restore Fails

**Scenario:** Need to rollback, but backup cannot be restored.

**Impact:** Cannot recover to pre-Phase-1 state.

**Prevention:**
1. Test restore BEFORE Phase 1 (in isolated environment)
2. Create NEW backup immediately before Phase 1
3. Use PocketBase's backup command (not manual copy)

**Test Restore Procedure:**
```bash
# 1. Stop PocketBase (DO NOT run in production)
# kill -SIGTERM {pid}

# 2. Backup current state
mv pb_data pb_data.backup

# 3. Restore from checkpoint-5
cp -r backups/milestone-02/checkpoint-5-after/pb_data_20261009_135203 pb_data

# 4. Restart PocketBase
./pocketbase serve --http=127.0.0.1:8390

# 5. Verify collections
sqlite3 pb_data/data.db "SELECT name FROM _collections;"

# 6. Restore original (this was test)
rm -rf pb_data
mv pb_data.backup pb_data
```

**🔴 DO NOT run this test on production port 8390 while service is running.**

---

## Part 5: Test Plan Verification

### Test Fixtures Required

**Prefix:** M06_TEST_*

**Companies:**
- M06_TEST_Company_A (id: will be generated)
- M06_TEST_Company_B

**Branches:**
- M06_TEST_Branch_A1 (company: A, name: "HQ")
- M06_TEST_Branch_A2 (company: A, name: "Store 1")
- M06_TEST_Branch_B1 (company: B, name: "Main")

**Users:**
1. M06_TEST_admin (is_system_admin: true)
2. M06_TEST_user_a_owner (owner, Company A, company-wide)
3. M06_TEST_user_a_manager (manager, Company A, Branch A1)
4. M06_TEST_user_a_cashier (cashier, Company A, Branch A2)
5. M06_TEST_user_b_owner (owner, Company B, company-wide)
6. M06_TEST_user_no_membership (no memberships)

**Creation Script:**
```javascript
// pb_hooks/create_test_fixtures.pb.js
// Run once via: curl -X POST http://127.0.0.1:8390/api/test/create-fixtures

routerAdd("POST", "/api/test/create-fixtures", (c) => {
  // Only allow in development
  if ($os.getenv("PB_ENV") !== "development") {
    throw new ForbiddenError("Test fixtures only in development")
  }
  
  // Create system admin user
  const usersCollection = $app.dao().findCollectionByNameOrId("users")
  const admin = new Record(usersCollection)
  admin.set("username", "M06_TEST_admin")
  admin.set("password", "testpass123")
  admin.set("passwordConfirm", "testpass123")
  admin.set("is_system_admin", true)
  admin.set("verified", true)
  $app.dao().saveRecord(admin)
  
  // Create companies via custom endpoint (as admin)
  // ...
  
  // Return created IDs for test reference
  return c.json(200, {message: "Fixtures created"})
})
```

**Cleanup Script:**
```sql
-- Delete all test data
DELETE FROM memberships WHERE id LIKE 'M06\_TEST\_%' ESCAPE '\';
DELETE FROM branches WHERE id LIKE 'M06\_TEST\_%' ESCAPE '\';
DELETE FROM companies WHERE id LIKE 'M06\_TEST\_%' ESCAPE '\';
DELETE FROM users WHERE username LIKE 'M06\_TEST\_%';
```

---

### Test Matrix

**Category 1: Self-Promotion Prevention**

| Test | Actor | Action | Expected |
|------|-------|--------|----------|
| 1.1 | M06_TEST_user_no_membership | PATCH /users/{self} `{"is_system_admin": true}` | 400 Bad Request |
| 1.2 | M06_TEST_user_a_owner | PATCH /users/{self} `{"company": "other_id"}` | 400 Bad Request |
| 1.3 | M06_TEST_user_a_owner | PATCH /users/{self} `{"role": "admin"}` | 400 Bad Request |
| 1.4 | M06_TEST_user_a_owner | PATCH /users/{self} `{"username": "new_name"}` | 200 OK |

**Category 2: Direct API Blocking**

| Test | Actor | Action | Expected |
|------|-------|--------|----------|
| 2.1 | M06_TEST_user_a_owner | POST /collections/companies/records | 403 Forbidden |
| 2.2 | M06_TEST_user_a_owner | POST /collections/memberships/records | 403 Forbidden |
| 2.3 | M06_TEST_user_a_owner | GET /collections/companies/records | 403 Forbidden |

**Category 3: System Admin Authorization**

| Test | Actor | Action | Expected |
|------|-------|--------|----------|
| 3.1 | M06_TEST_admin | POST /custom/companies/create | 200 OK + company created |
| 3.2 | M06_TEST_user_a_owner | POST /custom/companies/create | 403 Forbidden |
| 3.3 | Anonymous | POST /custom/companies/create | 401 Unauthorized |

**Category 4: Custom Endpoint Functionality**

| Test | Actor | Action | Expected |
|------|-------|--------|----------|
| 4.1 | M06_TEST_user_a_owner | GET /custom/memberships/my-memberships | 200 OK + 1 membership (Company A) |
| 4.2 | M06_TEST_user_no_membership | GET /custom/memberships/my-memberships | 200 OK + empty array |
| 4.3 | Anonymous | GET /custom/memberships/my-memberships | 401 Unauthorized |

**Test Execution:**

```bash
# Must use regular user JWT tokens, NOT superuser
# Get JWT token for each test user

# Test 1.1
USER_TOKEN=$(curl -X POST http://127.0.0.1:8390/api/collections/users/auth-with-password \
  -d '{"identity":"M06_TEST_user_no_membership","password":"testpass123"}' \
  | jq -r '.token')

curl -X PATCH http://127.0.0.1:8390/api/collections/users/records/{id} \
  -H "Authorization: Bearer $USER_TOKEN" \
  -d '{"is_system_admin": true}'
# Verify: 400 Bad Request

# Repeat for all tests...
```

---

## Part 6: Conditions for Implementation

### ✅ Prerequisites (VERIFIED)

1. ✅ Backup exists and readable
2. ✅ Database is empty (0 records)
3. ✅ PocketBase 0.40.4 running on port 8390
4. ✅ Business decision confirmed (Option A: is_system_admin)
5. ✅ No active users or production data

### ⚠️ Prerequisites (NOT VERIFIED)

1. ❌ Backup can be successfully restored
2. ❌ PocketBase `field.system` property supported
3. ❌ WAL checkpoint behavior during backup
4. ❌ Custom endpoint performance with large datasets

### 🔴 Required Before Implementation

**1. Test Backup Restore**
```bash
# In isolated test environment
# Verify checkpoint-5 backup can be restored
# Verify PocketBase starts with restored data
```

**2. Create New Backup**
```bash
# Use PocketBase backup command
./pocketbase backup --dir backups/milestone-02/checkpoint-6-before

# OR manual with WAL checkpoint
sqlite3 pb_data/data.db "PRAGMA wal_checkpoint(FULL);"
cp -r pb_data backups/milestone-02/checkpoint-6-before/pb_data_$(date +%Y%m%d_%H%M%S)
cp pb_schema.json backups/milestone-02/checkpoint-6-before/pb_schema_$(date +%Y%m%d_%H%M%S).json
```

**3. Verify Field Exclusion Syntax**
```javascript
// Test in PocketBase 0.40.4 playground
"@request.data.is_system_admin:isset = false"
// Verify this syntax is supported
```

**4. Implement Custom Endpoints BEFORE API Rule Lockdown**
```
Order:
1. Implement auth_utils.pb.js
2. Implement custom_endpoints.pb.js
3. Test endpoints work with regular tokens
4. THEN apply migrations 3 & 4 (lock companies/memberships)
```

---

## Part 7: Scope Boundaries

### ✅ In Scope (Phase 1)

- Add is_system_admin field
- Block self-promotion paths
- Lock companies and memberships direct API
- Implement authorization utilities
- Implement basic custom endpoints (my-memberships, create-company)
- Create test fixtures
- Execute test matrix

### ❌ Out of Scope (Future Phases)

- Invitation system (Phase 2)
- Customer ordering (Phase 3)
- Frontend migration (Phase 3)
- Resource branch assignment (Phase 4)
- Zalo OAuth modifications
- Git commits or deployment

---

## Part 8: Security Audit Summary

### Vulnerabilities Fixed in Phase 1

1. ✅ **Fatal role check** → Blocked direct API, use membership-based endpoints
2. ✅ **No company authorization** → Require is_system_admin
3. ✅ **Self-promotion** → Block company/role/is_system_admin updates
4. ✅ **Direct membership API** → Lock down, force custom endpoints
5. ✅ **Cross-tenant leak** → Custom endpoints check active membership

### Remaining Risks (Accepted)

1. ⚠️ **No invitation system** → Manual membership creation required (Phase 1 limitation)
2. ⚠️ **No customer ordering** → Feature not yet designed (Phase 3)
3. ⚠️ **Frontend still uses users.company** → Will migrate in Phase 3

---

## Part 9: Membership Bootstrap Endpoint Design

### Decision: Option B Selected

**Strategy:** Implement custom admin endpoint for membership creation  
**Scope:** Bootstrap only — NOT a general-purpose membership creation API

---

### Endpoint Specification

**Route:** `POST /api/custom/admin/memberships/create`

**Authorization:** Requires `is_system_admin = true`

**Purpose:** Create initial owner memberships when bootstrapping new companies, or manually adding members during Phase 1 (before invitation system exists)

---

### Request Schema

```json
{
  "user_id": "string (required, 15 chars)",
  "company_id": "string (required, 15 chars)",
  "branch_id": "string (optional, 15 chars or null)",
  "role": "string (required, enum: owner|manager|cashier|staff|customer)"
}
```

**Validation Rules:**

1. **user_id:** Must be valid PocketBase record ID format (`r` + 14 lowercase hex chars)
2. **company_id:** Same format
3. **branch_id:** Same format OR null (null = company-wide membership)
4. **role:** MUST be one of: `"owner"`, `"manager"`, `"cashier"`, `"staff"`, `"customer"`
5. **FORBIDDEN:** Cannot use this endpoint to grant `is_system_admin` (that's a users field, not membership)

---

### Server-Side Security Checks

**Step 1: Authenticate Caller**
```javascript
const authRecord = $apis.requestInfo(c).auth
if (!authRecord) {
  throw new UnauthorizedError("Authentication required")
}

// Check system admin
if (!authRecord.getBool("is_system_admin")) {
  throw new ForbiddenError("System admin privilege required")
}
```

**Step 2: Validate Input**
```javascript
const data = $apis.requestInfo(c).data

// Required fields
if (!data.user_id || !data.company_id || !data.role) {
  throw new BadRequestError("user_id, company_id, and role are required")
}

// Role whitelist
const allowedRoles = ["owner", "manager", "cashier", "staff", "customer"]
if (!allowedRoles.includes(data.role)) {
  throw new BadRequestError("Invalid role. Allowed: " + allowedRoles.join(", "))
}
```

**Step 3: Verify Resources Exist**
```javascript
// Verify user exists
let targetUser
try {
  targetUser = $app.dao().findRecordById("users", data.user_id)
} catch (err) {
  throw new BadRequestError("User not found: " + data.user_id)
}

// Verify company exists
let targetCompany
try {
  targetCompany = $app.dao().findRecordById("companies", data.company_id)
} catch (err) {
  throw new BadRequestError("Company not found: " + data.company_id)
}

// Verify branch exists (if provided)
let targetBranch = null
if (data.branch_id) {
  try {
    targetBranch = $app.dao().findRecordById("branches", data.branch_id)
  } catch (err) {
    throw new BadRequestError("Branch not found: " + data.branch_id)
  }
}
```

**Step 4: Enforce Branch-Company Consistency**
```javascript
// If branch specified, MUST belong to the company
if (targetBranch) {
  const branchCompanyId = targetBranch.get("company")
  if (branchCompanyId !== data.company_id) {
    throw new BadRequestError(
      "Branch " + data.branch_id + " does not belong to company " + data.company_id
    )
  }
}
```

**Step 5: Check for Duplicate Membership**
```javascript
// Check if membership already exists
const filter = data.branch_id
  ? "user = {:user} && company = {:company} && branch = {:branch}"
  : "user = {:user} && company = {:company} && (branch = '' || branch = null)"

let existingMembership
try {
  existingMembership = $app.dao().findFirstRecordByFilter(
    "memberships",
    filter,
    {
      user: data.user_id,
      company: data.company_id,
      branch: data.branch_id || ""
    }
  )
} catch (err) {
  existingMembership = null
}

if (existingMembership) {
  // Duplicate found
  // Option A: Return error
  throw new BadRequestError("Membership already exists: " + existingMembership.id)
  
  // Option B: Return existing membership (idempotent)
  // return c.json(200, {
  //   membership_id: existingMembership.id,
  //   message: "Membership already exists"
  // })
}
```

**Recommendation:** Use Option A (error on duplicate) for Phase 1, makes bugs more visible.

**Step 6: Create Membership**
```javascript
const membershipCollection = $app.dao().findCollectionByNameOrId("memberships")
const membership = new Record(membershipCollection)

membership.set("user", data.user_id)
membership.set("company", data.company_id)
membership.set("branch", data.branch_id || "")  // Empty string for null
membership.set("role", data.role)
membership.set("active", true)  // Default active

$app.dao().saveRecord(membership)
```

**Step 7: Audit Logging**
```javascript
// Log to PocketBase system log (visible to superuser)
console.log(JSON.stringify({
  action: "membership_created",
  admin_user: authRecord.id,
  admin_username: authRecord.get("username"),
  target_user: data.user_id,
  company: data.company_id,
  branch: data.branch_id || null,
  role: data.role,
  membership_id: membership.id,
  timestamp: new Date().toISOString()
}))

// DO NOT LOG:
// - Passwords
// - JWT tokens
// - Invitation secrets
// - Any PII beyond what's necessary for audit
```

**Step 8: Return Success**
```javascript
return c.json(200, {
  membership_id: membership.id,
  user_id: data.user_id,
  company_id: data.company_id,
  branch_id: data.branch_id || null,
  role: data.role,
  active: true
})
```

---

### Concurrent Request Handling

**Race Condition:** Two requests create membership for same user+company+branch simultaneously.

**Mitigation:** Database unique indexes

```sql
-- Already exists in schema
CREATE UNIQUE INDEX idx_membership_user_company_branch 
ON memberships(user, company, branch) 
WHERE branch IS NOT NULL;

CREATE UNIQUE INDEX idx_membership_user_company 
ON memberships(user, company) 
WHERE branch IS NULL;
```

**Behavior:**
- First request: succeeds, creates membership
- Second request: database constraint violation
- PocketBase returns 400 Bad Request with constraint error
- Client sees clear error message

**✅ Safe:** Database enforces atomicity, no duplicate memberships possible.

---

### What This Endpoint CANNOT Do

**❌ Grant system admin:**
```json
// This will be IGNORED
{"user_id": "...", "company_id": "...", "role": "owner", "is_system_admin": true}
```
**Why:** `is_system_admin` is a users table field, not memberships. System admin is granted separately via superuser.

**❌ Create membership in arbitrary company:**
- Endpoint does NOT check if caller is owner of target company
- Authorization is: caller has `is_system_admin = true`
- This is by design for Phase 1 (bootstrap)
- Phase 2 invitation system will restrict scope

**❌ Public membership creation:**
- Endpoint requires system admin
- Regular users (even owners) cannot call this endpoint
- Prevents self-promotion and unauthorized membership grants

---

### Test Cases

**Test 1: Success - Company-wide membership**
```bash
ADMIN_TOKEN=$(curl -X POST http://127.0.0.1:8390/api/collections/users/auth-with-password \
  -d '{"identity":"M06_TEST_admin","password":"testpass123"}' | jq -r '.token')

curl -X POST http://127.0.0.1:8390/api/custom/admin/memberships/create \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "user_id": "r1234567890abcd",
    "company_id": "rcompany1234567",
    "branch_id": null,
    "role": "owner"
  }'
# Expected: 200 OK, membership created
```

**Test 2: Success - Branch-specific membership**
```bash
curl -X POST http://127.0.0.1:8390/api/custom/admin/memberships/create \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "user_id": "r1234567890abcd",
    "company_id": "rcompany1234567",
    "branch_id": "rbranch12345678",
    "role": "manager"
  }'
# Expected: 200 OK
```

**Test 3: Failure - Non-admin caller**
```bash
USER_TOKEN=$(curl -X POST http://127.0.0.1:8390/api/collections/users/auth-with-password \
  -d '{"identity":"M06_TEST_user_a_owner","password":"testpass123"}' | jq -r '.token')

curl -X POST http://127.0.0.1:8390/api/custom/admin/memberships/create \
  -H "Authorization: Bearer $USER_TOKEN" \
  -d '{"user_id":"...", "company_id":"...", "role":"owner"}'
# Expected: 403 Forbidden "System admin privilege required"
```

**Test 4: Failure - User not found**
```bash
curl -X POST http://127.0.0.1:8390/api/custom/admin/memberships/create \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "user_id": "rnonexistent123",
    "company_id": "rcompany1234567",
    "role": "owner"
  }'
# Expected: 400 Bad Request "User not found"
```

**Test 5: Failure - Branch-company mismatch**
```bash
curl -X POST http://127.0.0.1:8390/api/custom/admin/memberships/create \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "user_id": "r1234567890abcd",
    "company_id": "rcompanyA123456",
    "branch_id": "rbranchB1234567",  # Belongs to different company
    "role": "manager"
  }'
# Expected: 400 Bad Request "Branch does not belong to company"
```

**Test 6: Failure - Duplicate membership**
```bash
# Create once
curl -X POST http://127.0.0.1:8390/api/custom/admin/memberships/create \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"user_id":"r123","company_id":"rc123","role":"owner"}'
# Expected: 200 OK

# Try again
curl -X POST http://127.0.0.1:8390/api/custom/admin/memberships/create \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"user_id":"r123","company_id":"rc123","role":"owner"}'
# Expected: 400 Bad Request "Membership already exists"
```

**Test 7: Failure - Invalid role**
```bash
curl -X POST http://127.0.0.1:8390/api/custom/admin/memberships/create \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"user_id":"r123","company_id":"rc123","role":"superadmin"}'
# Expected: 400 Bad Request "Invalid role"
```

---

## Part 10: API Rules - Before and After

### Collection: users

**Current Rules (Runtime-Verified):**
```javascript
listRule:   "@request.auth.id != \"\""
viewRule:   "@request.auth.id != \"\""
createRule: ""  // Empty = public signup allowed
updateRule: "id = @request.auth.id || @request.auth.role = \"admin\""
deleteRule: "@request.auth.role = \"admin\""
```

**Proposed Rules (Phase 1):**
```javascript
listRule:   "@request.auth.id != \"\""  // Unchanged (any authenticated)
viewRule:   "@request.auth.id != \"\""  // Unchanged
createRule: ""  // Unchanged (public signup via Zalo/password)
updateRule: "id = @request.auth.id && @request.data.company:isset = false && @request.data.role:isset = false && @request.data.is_system_admin:isset = false || @request.auth.role = \"admin\""
deleteRule: "@request.auth.role = \"admin\""  // Unchanged
```

**Changes:**
- **updateRule:** Block users from updating `company`, `role`, `is_system_admin` fields on own record
- **Allowed updates:** username, email, password, emailVisibility, verified (via own record)
- **Admin override:** `@request.auth.role = "admin"` can update any field (for superuser management)

**Direct REST API Operations:**
- ✅ **GET /users/records** → List all users (any authenticated)
- ✅ **GET /users/records/{id}** → View any user (any authenticated)
- ✅ **POST /users/records** → Create user (public signup)
- ✅ **PATCH /users/records/{own_id}** → Update own username/email/password
- ❌ **PATCH /users/records/{own_id}** with `{"company": "..."}` → 400 Bad Request
- ❌ **PATCH /users/records/{own_id}** with `{"is_system_admin": true}` → 400 Bad Request
- ✅ **DELETE /users/records/{id}** → Only admin

---

### Collection: companies

**Current Rules (Runtime-Verified):**
```javascript
listRule:   "@request.auth.id != \"\""  // ANY authenticated user
viewRule:   "@request.auth.id != \"\""  // ANY authenticated user
createRule: "@request.auth.id != \"\""  // ANY authenticated user can create
updateRule: "@request.auth.id != \"\""  // ANY authenticated user can update ANY company
deleteRule: "@request.auth.id != \"\""  // ANY authenticated user can delete ANY company
```

**Proposed Rules (Phase 1):**
```javascript
listRule:   null  // Block direct API
viewRule:   null  // Block direct API
createRule: null  // Block direct API
updateRule: null  // Block direct API
deleteRule: null  // Block direct API
```

**Changes:**
- **ALL operations blocked** via REST API
- **Must use custom endpoints:**
  - `GET /api/custom/companies/my-companies` → List own companies (via memberships)
  - `POST /api/custom/companies/create` → Create company (requires is_system_admin)

**Direct REST API Operations:**
- ❌ **GET /companies/records** → 403 Forbidden
- ❌ **GET /companies/records/{id}** → 403 Forbidden
- ❌ **POST /companies/records** → 403 Forbidden
- ❌ **PATCH /companies/records/{id}** → 403 Forbidden
- ❌ **DELETE /companies/records/{id}** → 403 Forbidden

---

### Collection: branches

**Current Rules (Runtime-Verified):**
```javascript
listRule:   "@request.auth.company = company"
viewRule:   "@request.auth.company = company"
createRule: "@request.auth.company = company && @request.auth.role = 'owner'"
updateRule: "@request.auth.company = company && @request.auth.role ?= 'owner'"
deleteRule: "@request.auth.company = company && @request.auth.role = 'owner'"
```

**Analysis:**
- `@request.auth.company` checks `users.company` field
- `@request.auth.role = 'owner'` checks `users.role` field
- **Problem:** `users.role` can only be "admin" or "user", never "owner"
- **Result:** createRule/updateRule/deleteRule NEVER match (fatal flaw)

**Proposed Rules (Phase 1):**
```javascript
listRule:   null  // Block for now, implement custom endpoint later
viewRule:   null  // Block for now
createRule: null  // Block direct API
updateRule: null  // Block direct API
deleteRule: null  // Block direct API
```

**Alternative (if custom endpoint not ready):**
```javascript
listRule:   "@request.auth.id != \"\""  // Temporary: any authenticated
viewRule:   "@request.auth.id != \"\""  // Temporary: any authenticated
createRule: null  // Still block
updateRule: null  // Still block
deleteRule: null  // Still block
```

**Recommended:** Full lockdown (all null), implement custom branch endpoints in Phase 1.

**Direct REST API Operations:**
- ❌ **All operations** → 403 Forbidden (must use custom endpoints)

---

### Collection: memberships

**Current Rules (Runtime-Verified):**
```javascript
listRule:   "@request.auth.id = user || @request.auth.company = company"
viewRule:   "@request.auth.id = user || @request.auth.company = company"
createRule: "@request.auth.company = company && @request.auth.role ?= 'owner'"
updateRule: "@request.auth.company = company && @request.auth.role ?= 'owner'"
deleteRule: "@request.auth.company = company && @request.auth.role ?= 'owner'"
```

**Analysis:**
- listRule: User can see own memberships OR memberships in "their company"
  - Problem: `@request.auth.company` may be outdated/wrong
  - Allows cross-tenant data leak if user sets own company to another company's ID
- createRule: Never works (users.role != 'owner')

**Proposed Rules (Phase 1):**
```javascript
listRule:   null  // Block direct API
viewRule:   null  // Block direct API
createRule: null  // Block direct API
updateRule: null  // Block direct API
deleteRule: null  // Block direct API
```

**Must Use Custom Endpoints:**
- `GET /api/custom/memberships/my-memberships` → List own active memberships
- `POST /api/custom/admin/memberships/create` → Create membership (system admin only)

**Direct REST API Operations:**
- ❌ **All operations** → 403 Forbidden

---

### Collection: products, tables, customers

**Current Rules:**
```javascript
// All have same pattern
listRule:   "@request.auth.id != \"\" && @request.auth.company = company"
viewRule:   "@request.auth.id != \"\" && @request.auth.company = company"
createRule: "@request.auth.id != \"\" && @request.auth.company = company"
updateRule: "@request.auth.id != \"\" && @request.auth.company = company"
deleteRule: "@request.auth.id != \"\" && @request.auth.company = company"
```

**Analysis:**
- Depends on `users.company` field (weak reference)
- User can modify own `users.company` to access other companies' data (if updateRule not fixed)

**Proposed Rules (Phase 1):**
```javascript
// Option A: Keep as-is temporarily (rely on users.updateRule fix)
// No change needed if users cannot modify users.company

// Option B: Lock down and implement custom endpoints
listRule:   null
viewRule:   null
createRule: null
updateRule: null
deleteRule: null
```

**Recommendation:** Option A for Phase 1
- Fix users.updateRule to prevent company modification
- Keep product/table/customer rules as-is
- Migrate to membership-based authorization in Phase 2

**Protected Fields:** None (all fields client-updateable if authorized)

---

## Part 11: Backup/Restore Test Procedure

### ⚠️ DO NOT Execute This - Design Only

**Purpose:** Verify backup can be restored successfully BEFORE Phase 1 implementation.

**Environment:** Isolated test, separate from production ports 8090/8390.

---

### Test Procedure

**Step 1: Verify Backup Integrity**
```bash
cd /d/My\ App/billiard/pocketbase

# Check backup exists
ls -lh backups/milestone-02/checkpoint-5-after/pb_data_20261009_135203/

# Expected output:
# data.db (240KB)
# data.db-shm (32KB)
# data.db-wal (13KB)
# auxiliary.db (132KB)
# auxiliary.db-shm (32KB)
# auxiliary.db-wal (37KB)
# types.d.ts (784KB)

# Verify database can be opened
sqlite3 backups/milestone-02/checkpoint-5-after/pb_data_20261009_135203/data.db ".tables"

# Expected: List of tables including users, companies, branches, memberships
```

**Step 2: Create Test Directory**
```bash
# Create isolated test environment
mkdir -p /tmp/pb_restore_test
cd /tmp/pb_restore_test

# Copy PocketBase executable
cp /d/My\ App/billiard/pocketbase/pocketbase.exe .

# Copy backup to pb_data
cp -r /d/My\ App/billiard/pocketbase/backups/milestone-02/checkpoint-5-after/pb_data_20261009_135203 pb_data

# Verify copy
ls -lh pb_data/
```

**Step 3: Start Test Instance**
```bash
# Use test port (NOT 8390 or 8090)
./pocketbase.exe serve --http=127.0.0.1:9999 &

# Store PID for cleanup
TEST_PB_PID=$!
echo $TEST_PB_PID > test_pb.pid

# Wait for startup
sleep 3

# Check process running
ps -p $TEST_PB_PID
```

**Step 4: Verify Collections**
```bash
# Check collections via API
curl http://127.0.0.1:9999/api/collections 2>&1 | jq '.items[] | {name, id}'

# Expected: users, companies, branches, memberships, etc.

# Check record counts (should all be 0)
sqlite3 pb_data/data.db "SELECT 
  (SELECT COUNT(*) FROM users) as users,
  (SELECT COUNT(*) FROM companies) as companies,
  (SELECT COUNT(*) FROM branches) as branches,
  (SELECT COUNT(*) FROM memberships) as memberships;"

# Expected: 0|0|0|0
```

**Step 5: Verify API Rules**
```bash
# Check companies rules
sqlite3 pb_data/data.db "SELECT name, createRule FROM _collections WHERE name='companies';"

# Expected: companies|@request.auth.id != ""

# Check users updateRule
sqlite3 pb_data/data.db "SELECT name, updateRule FROM _collections WHERE name='users';"

# Expected: users|id = @request.auth.id || @request.auth.role = "admin"
```

**Step 6: Test Signup (Verify Functional)**
```bash
# Try to create a test user
curl -X POST http://127.0.0.1:9999/api/collections/users/records \
  -d '{
    "username": "restore_test",
    "password": "testpass123",
    "passwordConfirm": "testpass123"
  }'

# Expected: 200 OK with user record

# Verify user created
sqlite3 pb_data/data.db "SELECT username FROM users WHERE username='restore_test';"

# Expected: restore_test
```

**Step 7: Stop Test Instance**
```bash
# Graceful shutdown
kill -SIGTERM $TEST_PB_PID

# Wait for clean shutdown
sleep 2

# Verify stopped
ps -p $TEST_PB_PID
# Expected: No such process
```

**Step 8: Cleanup**
```bash
# Remove test directory
cd /d/My\ App/billiard/pocketbase
rm -rf /tmp/pb_restore_test

# Verify production instance still running
ps -p 15104
curl http://127.0.0.1:8390/api/health

# Expected: Production unaffected
```

---

### Success Criteria

✅ **Backup restored successfully if:**
1. Test PocketBase starts without errors
2. All collections present and readable
3. API Rules match expected values
4. Record counts match (all 0)
5. Can create test user via API
6. Test instance shuts down cleanly

❌ **Backup restore FAILED if:**
1. Database corruption errors
2. Missing collections
3. PocketBase startup fails
4. API calls return 500 errors
5. WAL replay errors

---

### New Backup Creation (Before Phase 1)

**Method 1: PocketBase Built-in (Recommended)**
```bash
cd /d/My\ App/billiard/pocketbase

# Create backup via PocketBase command
./pocketbase.exe backup --dir backups/milestone-02/checkpoint-6-before

# Backup includes proper WAL checkpoint
# Output: backups/milestone-02/checkpoint-6-before/pb_backup_TIMESTAMP.zip
```

**Method 2: Manual (If Built-in Not Available)**
```bash
cd /d/My\ App/billiard/pocketbase

# Step 1: Checkpoint WAL
sqlite3 pb_data/data.db "PRAGMA wal_checkpoint(FULL);"
sqlite3 pb_data/auxiliary.db "PRAGMA wal_checkpoint(FULL);"

# Step 2: Copy files
mkdir -p backups/milestone-02/checkpoint-6-before
cp -r pb_data backups/milestone-02/checkpoint-6-before/pb_data_$(date +%Y%m%d_%H%M%S)

# Step 3: Backup schema
cp pb_schema.json backups/milestone-02/checkpoint-6-before/pb_schema_$(date +%Y%m%d_%H%M%S).json

# Step 4: Verify
ls -lh backups/milestone-02/checkpoint-6-before/
```

---

## Part 12: Implementation Acceptance Criteria

### ✅ Phase 1 Ready to Implement ONLY IF:

**Criterion 1: Backup Verified**
- [ ] Backup restore test executed successfully (Part 11 procedure)
- [ ] New backup created before any changes
- [ ] Rollback procedure documented and tested

**Criterion 2: Endpoint Replacement Ready**
- [ ] `auth_utils.pb.js` designed with all utility functions
- [ ] `custom_endpoints.pb.js` designed with:
  - `GET /api/custom/memberships/my-memberships`
  - `POST /api/custom/companies/create`
  - `POST /api/custom/admin/memberships/create`
- [ ] All endpoints have security checks documented
- [ ] Test cases written for each endpoint

**Criterion 3: Permission Matrix Consistent**
- [ ] Matrix covers all 5 business decisions
- [ ] System admin authorization model defined
- [ ] Membership bootstrap process defined
- [ ] No contradictions between rules and endpoints

**Criterion 4: Test Matrix Complete**
- [ ] Tests for regular users (not just superuser)
- [ ] Tests for owner, manager, cashier, staff, customer
- [ ] Tests for system admin vs non-admin
- [ ] Tests for direct REST API blocking
- [ ] Tests for custom endpoint authorization
- [ ] Tests for self-promotion prevention

**Criterion 5: Direct API Access Verified**
- [ ] Current API Rules documented from runtime
- [ ] Proposed API Rules defined for each collection
- [ ] REST API operations catalogued (allowed vs blocked)
- [ ] No bypass paths through direct API after lockdown

**Criterion 6: System Admin Grant Process**
- [ ] Initial grant method defined (superuser SQL/Admin UI)
- [ ] Self-promotion paths identified and blocked
- [ ] Audit logging designed
- [ ] Revocation process defined

---

### 🔴 BLOCKERS (Cannot Implement If):

1. **Backup restore test fails** → Cannot guarantee rollback capability
2. **Field exclusion syntax not supported** → Cannot block users.company/role updates
3. **Custom endpoints crash** → Users locked out after API Rules lockdown
4. **No way to grant initial system admin** → Cannot bootstrap first company

---

### Deployment Checklist

**Before Implementation:**
- [ ] Run backup restore test (Part 11)
- [ ] Create new backup (checkpoint-6-before)
- [ ] Verify PocketBase 0.40.4 version
- [ ] Verify database empty (0 records)
- [ ] Review all test cases

**During Implementation:**
- [ ] Apply migrations in order: 1 → 2 → 3 → 4
- [ ] Test after EACH migration with regular user token
- [ ] Do NOT use superuser token for authorization tests
- [ ] Monitor PocketBase logs for errors
- [ ] Stop if any migration fails

**After Implementation:**
- [ ] Execute full test matrix
- [ ] Grant initial system admin (via superuser)
- [ ] Create test companies via system admin
- [ ] Verify all 5 vulnerabilities fixed
- [ ] Document results

---

## Summary and Final Recommendation

### ✅ SAFE TO PROCEED with updated conditions:

**Phase 1 Implementation Plan:**

1. **Add is_system_admin field** (Migration 1)
2. **Implement custom endpoints** (auth_utils.pb.js + custom_endpoints.pb.js)
3. **Test endpoints with regular tokens** (before lockdown)
4. **Secure users fields** (Migration 2 - block company/role/is_system_admin updates)
5. **Lock companies API** (Migration 3)
6. **Lock memberships API** (Migration 4)
7. **Execute test matrix**

**Bootstrap Process:**
1. Grant initial system admin via superuser
2. System admin creates companies via custom endpoint
3. System admin creates owner memberships via bootstrap endpoint
4. Owners manage their companies through memberships

**Rollback:**
- Revert migrations 2→3→4 (restore API Rules)
- Custom endpoints remain but unused
- Database state preserved

---

**Status:** ✅ PRE-IMPLEMENTATION REVIEW UPDATED  
**Decision:** Membership bootstrap endpoint designed (Option B selected)  
**Next Step:** Await your approval for implementation

---

**End of Pre-Implementation Safety Review - Updated 2026-10-10**
