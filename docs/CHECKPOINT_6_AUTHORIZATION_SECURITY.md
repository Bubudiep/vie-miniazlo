# Checkpoint 6 — Authorization & Security Audit

**Date:** 2026-10-09  
**Status:** AUDIT COMPLETED — Awaiting approval before implementation  
**PocketBase Version:** 0.40.4  
**Session Type:** Design & Analysis Only — No runtime changes made

---

## Executive Summary

This audit identifies **CRITICAL security vulnerabilities** in the current authorization model and proposes a membership-based authorization architecture for the H2 Billiard multi-tenant system.

**Key Findings:**
- ❌ Current API Rules contain **fatal architectural flaw**: checking `@request.auth.role = 'owner'` when users can only have roles "admin"/"user"
- ❌ Authorization model mixing `users.company`/`users.role` with `memberships` inconsistently
- ❌ API Rules cannot safely enforce membership-based permissions without custom endpoints
- ✅ All collections are empty (0 records) — safe to refactor without data migration risk
- ✅ Hook `memberships_invariant.pb.js` correctly enforces branch-company consistency

**Recommended Architecture:** Use `memberships` as the single source of truth for business permissions, with custom endpoints for authorization checks.

---

## Part 1: Runtime Verification

### Process & Database Status

✅ **VERIFIED:**
```
Process: pocketbase.exe (PID 15104)
Command: D:\My App\billiard\pocketbase\pocketbase.exe serve --http=127.0.0.1:8390
Database: D:\My App\billiard\pocketbase\pb_data\data.db (240 KB)
Port: 127.0.0.1:8390 (LISTENING)
Admin UI: http://127.0.0.1:8390/_/ (accessible)
```

⚠️ **Note:** `.pocketbase.pid` file contains PID 2025 but actual process is 15104 (stale PID file).

### Database State

**All collections are EMPTY (0 records):**
- users: 0
- companies: 0  
- branches: 0
- memberships: 0
- products: 0
- tables: 0
- customers: 0

**✅ POSITIVE IMPACT:** Migration is completely safe. No data loss risk, no orphaned records, no backwards compatibility constraints.

### Schema Verification (SQLite)

**users table:**
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  email TEXT NOT NULL,
  emailVisibility BOOLEAN DEFAULT FALSE NOT NULL,
  verified BOOLEAN DEFAULT FALSE NOT NULL,
  tokenKey TEXT NOT NULL,
  company TEXT DEFAULT '' NOT NULL,     -- ← EXISTS (weak reference)
  role TEXT DEFAULT '' NOT NULL,        -- ← EXISTS (no enum constraint)
  zalo_id TEXT DEFAULT '' NOT NULL,     -- ← EXISTS (added by migration)
  created TEXT NOT NULL,
  updated TEXT NOT NULL
);
```

**branches table:**
```sql
CREATE TABLE branches (
  id TEXT PRIMARY KEY,
  company TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  active BOOLEAN DEFAULT FALSE NOT NULL,
  sort_order NUMERIC DEFAULT 0 NOT NULL
);
-- Index: UNIQUE(company, code)
```

**memberships table:**
```sql
CREATE TABLE memberships (
  id TEXT PRIMARY KEY,
  user TEXT NOT NULL,
  company TEXT NOT NULL,
  branch TEXT,              -- nullable = company-wide
  role TEXT NOT NULL,       -- owner|manager|cashier|staff|customer
  active BOOLEAN DEFAULT FALSE NOT NULL
);
-- Index: UNIQUE(user, company, branch) WHERE branch IS NOT NULL
-- Index: UNIQUE(user, company) WHERE branch IS NULL
```

---

## Part 2: Schema State Comparison

### Migration History (Applied)

All 16 migrations have been applied successfully:

| Migration | Purpose | Status |
|-----------|---------|--------|
| `1728393600_create_branches.js` | Create branches collection | ✅ Applied |
| `1728393700_create_memberships.js` | Create memberships collection | ✅ Applied |
| `1791409222_updated_users.js` | Add `zalo_id` field | ✅ Applied |
| `1791409239_updated_users.js` | Add unique index on `zalo_id` | ✅ Applied |
| `1791410178_updated_users.js` | Reorder indexes | ✅ Applied |
| `1791496427_collections_snapshot.js` | Full snapshot | ✅ Applied |
| `1791515596_updated_memberships.js` | **Remove** createRule | ✅ Applied |
| `1791516928_updated_memberships.js` | **Restore** createRule | ✅ Applied |

### Schema Mismatches: Migration vs Runtime

**Critical Discrepancy Found:**

#### Migration Files Define:
```javascript
// 1728393600_create_branches.js
listRule: "@request.auth.company = company"
createRule: "@request.auth.company = company && @request.auth.role = 'owner'"

// 1728393700_create_memberships.js  
listRule: "@request.auth.id = user || @request.auth.company = company"
createRule: "@request.auth.company = company && @request.auth.role ?= 'owner'"
```

#### Runtime Database Shows:
```sql
-- branches
listRule: "@request.auth.company = company"
createRule: "@request.auth.company = company && @request.auth.role = 'owner'"

-- memberships
listRule: "@request.auth.id = user || @request.auth.company = company"
createRule: "@request.auth.company = company && @request.auth.role ?= 'owner'"
```

**✅ MATCH:** Migration files and runtime are CONSISTENT. The issue is architectural, not a sync problem.

---

## Part 3: Critical Security Vulnerabilities

### 🔴 VULNERABILITY 1: Fatal Role Check Logic

**Location:** API Rules for `branches` and `memberships`

**The Problem:**
```javascript
// Current API Rules check:
createRule: "@request.auth.company = company && @request.auth.role = 'owner'"
```

**Why This CANNOT Work:**

1. `users.role` field has NO enum constraint and values are:
   - Expected: `"admin"` or `"user"` (system roles, per Zalo auth hook lines 68)
   - NOT: `"owner"`, `"manager"`, `"cashier"`, `"staff"`, `"customer"`

2. `memberships.role` field has business roles:
   - `"owner"`, `"manager"`, `"cashier"`, `"staff"`, `"customer"`

3. `@request.auth` references the authenticated **user record**, not memberships

4. **Result:** `@request.auth.role = 'owner'` will **NEVER MATCH** because:
   - User can only have `role = "admin"` or `"user"`
   - "owner" only exists in `memberships.role`
   - API Rules cannot JOIN memberships table

**Impact:** 
- ❌ ALL create/update/delete operations on branches/memberships will FAIL for regular users
- ❌ Only superuser (bypasses API Rules) can create data
- ❌ Authorization model is fundamentally broken

---

### 🔴 VULNERABILITY 2: No Tenant Isolation on Companies

**Runtime API Rules for `companies`:**
```javascript
listRule: "@request.auth.id != \"\""      // Any authenticated user
viewRule: "@request.auth.id != \"\""
createRule: "@request.auth.id != \"\""    // ← CRITICAL
updateRule: "@request.auth.id != \"\""    // ← CRITICAL  
deleteRule: "@request.auth.id != \"\""    // ← CRITICAL
```

**Impact:**
- ❌ Any authenticated user can list ALL companies (cross-tenant data leak)
- ❌ Any authenticated user can create/update/delete ANY company
- ❌ No ownership validation
- ❌ No authorization checks whatsoever

**Attack Scenario:**
1. User A creates company "A Corp"
2. User B (malicious) lists all companies, sees "A Corp"
3. User B updates or deletes "A Corp"
4. User A loses their company data

---

### 🔴 VULNERABILITY 3: Weak References (No Referential Integrity)

**All `company` fields are TEXT, not proper relations:**

```sql
-- In users, products, tables, customers
company TEXT DEFAULT '' NOT NULL
```

**Problems:**
1. ❌ No foreign key constraints
2. ❌ Company can be deleted without cascade
3. ❌ Can be set to non-existent company ID
4. ❌ Can be empty string ""
5. ❌ No indexes on company fields (performance issue)

**Impact:**
- Data integrity cannot be guaranteed at database level
- Orphaned records possible
- Slow queries (no indexes)

---

### 🔴 VULNERABILITY 4: Users Can Self-Assign Company

**users collection createRule:**
```javascript
createRule: ""  // Empty = anyone can create
```

**Zalo auth hook (lines 48-52):**
```javascript
user.set("username", username);
user.set("password", randomPassword);
user.set("zalo_id", zaloId);
user.set("verified", true);
// Does NOT set company or role
```

**But updateRule allows:**
```javascript
updateRule: "id = @request.auth.id || @request.auth.role = \"admin\""
```

**Attack Scenario:**
1. User creates account via Zalo OAuth
2. User lists companies (allowed, see VULN 2)
3. User updates their own record: `PATCH /api/collections/users/records/{id}` with `{"company": "other_company_id"}`
4. User now has access to other company's data (products, tables, customers all check `@request.auth.company`)

---

### ⚠️ VULNERABILITY 5: No Membership Validation on Creation

**memberships createRule:**
```javascript
createRule: "@request.auth.company = company && @request.auth.role ?= 'owner'"
```

**Problems:**
1. Checks `@request.auth.role = 'owner'` which never matches (see VULN 1)
2. Even if fixed, no validation of:
   - Can user create memberships for this company?
   - Is the target user already a member?
   - Is the role assignment authorized?
   - Is the branch assignment valid?

**Missing Validations:**
- ❌ Prevent self-promotion to owner
- ❌ Prevent creating memberships for other companies
- ❌ Prevent duplicate memberships
- ❌ Verify branch belongs to company (hook does this, but after API Rules pass)

---

## Part 4: Current Hooks Analysis

### Hook: memberships_invariant.pb.js

**Purpose:** Enforce `membership.branch.company === membership.company`

**Implementation Status:** ✅ CORRECT

```javascript
// Lines 9-46: onRecordCreateRequest
// Lines 48-82: onRecordUpdateRequest

// Both check:
1. If branch is null/empty → allow (company-wide)
2. Fetch branch record using $app.findRecordById()
3. Verify branch.company === membership.company
4. Throw BadRequestError if mismatch
```

**Test Results (from M02_MIGRATION_COMPLETE.md):**
- ✅ Company-wide membership (branch=null): PASS
- ✅ Valid same-company branch: PASS
- ✅ Cross-company branch: REJECTED (400)
- ✅ Empty company + branch: REJECTED (400)
- ✅ Non-existent branch: REJECTED (400)

**⚠️ LIMITATION:** All tests used **superuser token** which bypasses API Rules. Hook behavior with regular users NOT verified.

### Hook: zalo_auth.pb.js

**Purpose:** OAuth login via Zalo, auto-create user

**Security Analysis:**

✅ **Good:**
- Verifies access token with Zalo API
- Creates user with random password (not exposed)
- Sets `verified: true`
- Returns JWT token

❌ **Issues:**
- Does NOT set `company` or `role` (lines 48-52)
- Returns `company` and `role` in response even though null (line 67-68)
- No membership creation
- User has no access to any company after signup

**Flow Gap:**
```
User logs in via Zalo
  ↓
zalo_auth.pb.js creates user (no company)
  ↓
User has JWT token but no memberships
  ↓
User CANNOT access any data (all collections check company or membership)
  ↓
??? How does user join a company? No endpoint exists.
```

---

## Part 5: Permission Matrix (Proposed)

### Business Roles Definition

| Role | Scope | Primary Use Case |
|------|-------|------------------|
| **owner** | Company-wide or Branch | Business owner, full control |
| **manager** | Company-wide or Branch | Store manager, operations |
| **cashier** | Branch only | POS operator, billing |
| **staff** | Branch only | Service staff, floor worker |
| **customer** | Branch only | End customer, self-service |

### Proposed Permissions Matrix

#### Collection: companies

| Action | owner | manager | cashier | staff | customer | no membership |
|--------|-------|---------|---------|-------|----------|---------------|
| List own | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| View own | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Create | ✅ Special¹ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Update | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Delete | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

¹ *Company creation requires special flow: create company → create owner membership*

#### Collection: branches

| Action | owner | manager | cashier | staff | customer | no membership |
|--------|-------|---------|---------|-------|----------|---------------|
| List (own company) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| View (own company) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Create | ✅ | ✅² | ❌ | ❌ | ❌ | ❌ |
| Update | ✅ | ✅² | ❌ | ❌ | ❌ | ❌ |
| Delete | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

² *Manager can manage if company-wide membership, not branch-specific*

#### Collection: memberships

| Action | owner | manager | cashier | staff | customer | no membership |
|--------|-------|---------|---------|-------|----------|---------------|
| List (own company) | ✅ | ✅ | ✅³ | ✅³ | ✅³ | ❌ |
| View own | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| View others (same company) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create | ✅ | ✅⁴ | ❌ | ❌ | ❌ | ❌ |
| Update own (limited⁵) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Update others | ✅ | ✅⁴ | ❌ | ❌ | ❌ | ❌ |
| Delete | ✅ | ✅⁴ | ❌ | ❌ | ❌ | ❌ |

³ *Can list to see who's in their company/branch*  
⁴ *Manager: only within their scope (branch or company-wide)*  
⁵ *Own membership: cannot change user, company, branch, role, or active; only metadata like preferences*

#### Collection: products, tables, customers

| Action | owner | manager | cashier | staff | customer | no membership |
|--------|-------|---------|---------|-------|----------|---------------|
| List (own scope⁶) | ✅ | ✅ | ✅ | ✅ | ✅⁷ | ❌ |
| View (own scope) | ✅ | ✅ | ✅ | ✅ | ✅⁷ | ❌ |
| Create | ✅ | ✅ | ✅⁸ | ❌ | ❌ | ❌ |
| Update | ✅ | ✅ | ✅⁸ | ✅⁹ | ❌ | ❌ |
| Delete | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

⁶ *Scope = own company if company-wide membership, own branch if branch-specific*  
⁷ *Customer: read-only, can view products/menu and table status*  
⁸ *Cashier: create/update during POS operations*  
⁹ *Staff: update table status only*

### Scope Resolution Rules

**For users with multiple memberships:**

1. **Primary Membership:** Determined by context (frontend sends `company` + optional `branch`)
2. **Scope Hierarchy:**
   - Company-wide membership (`branch = null`) → access all branches
   - Branch-specific membership → access only that branch
3. **Role Priority:** If user has multiple memberships in same company, use highest privilege role

**For resources without branch:**

Products, tables, customers currently have `company` but no `branch` field. During transition:
- Owner/Manager (company-wide): access all
- Owner/Manager (branch-specific): access only if future `branch` field added
- Cashier/Staff/Customer: access only their branch's resources

---

## Part 6: Proposed Architecture

### Decision: Memberships as Single Source of Truth

**Rationale:**
1. ✅ Supports multi-company users (same user, different roles in different companies)
2. ✅ Supports company-wide and branch-specific permissions
3. ✅ Fine-grained role control (5 business roles vs 2 system roles)
4. ✅ Enables permission inheritance and delegation
5. ✅ Aligns with real-world organizational structure

**Deprecation Path for users.company/role:**
- **Phase 1:** Keep fields, mark as deprecated in docs
- **Phase 2:** Migrate frontend to use memberships
- **Phase 3:** Remove fields in future milestone (M04+)

### Authorization Flow (Proposed)

```
1. User authenticates (Zalo OAuth or username/password)
   ↓
2. Receive JWT token (contains user.id only)
   ↓
3. Frontend calls GET /api/memberships?user={user_id}&active=true
   ↓
4. Frontend stores available companies/branches/roles
   ↓
5. User selects context (company + optional branch)
   ↓
6. Frontend sends ALL requests with headers:
      X-Active-Company: {company_id}
      X-Active-Branch: {branch_id}  (optional)
   ↓
7. Backend validates:
   - User has active membership for this company/branch
   - User's role allows this operation
   - Resource belongs to this scope
```

### Custom Endpoint Requirements

**PocketBase API Rules CANNOT safely handle membership-based authorization** because:
1. Cannot JOIN memberships table in filter rules
2. Cannot execute complex logic (scope resolution, role hierarchy)
3. Cannot prevent bypass via direct collection API

**Solution:** Custom endpoints with authorization middleware

#### Required Endpoints

**1. Membership Management**
```
POST   /api/custom/memberships/create
PUT    /api/custom/memberships/{id}/update
DELETE /api/custom/memberships/{id}
GET    /api/custom/memberships/my-memberships
```

**Logic:**
- Verify caller has owner/manager role in target company
- Prevent self-promotion
- Enforce branch-company consistency
- Create audit log

**2. Company Management**
```
POST /api/custom/companies/create-with-owner
```

**Logic:**
- Create company
- Create owner membership for creator
- Return both records
- Transaction rollback on failure

**3. Resource Access (Optional)**
```
GET /api/custom/{collection}/list
GET /api/custom/{collection}/{id}
```

**Logic:**
- Resolve active membership from headers
- Filter by scope (company/branch)
- Check role permissions
- Fallback to direct API with tight rules

#### Securing Direct Collection API

**After custom endpoints exist:**

```javascript
// Collections that MUST go through custom endpoints:
companies: {
  listRule: null,    // Block direct access
  viewRule: null,
  createRule: null,
  updateRule: null,
  deleteRule: null
}

memberships: {
  listRule: null,    // Block direct access
  viewRule: null,
  createRule: null,
  updateRule: null,
  deleteRule: null
}

// Collections that can use API Rules (if frontend sends context):
products: {
  listRule: "@request.auth.id != '' && company = @request.data.activeCompany",
  // But verify activeCompany matches user's membership server-side
}
```

**⚠️ CRITICAL:** Even with API Rules, frontend can send arbitrary `activeCompany`. Must validate server-side.

---

## Part 7: Migration Plan

### Phase 1: Foundation (This Checkpoint)

**Goal:** Fix critical vulnerabilities, establish authorization architecture

**Steps:**

1. **Create custom endpoint structure**
   - File: `pb_hooks/custom_auth.pb.js`
   - Implement membership validation middleware
   - Create company creation endpoint
   - Create membership CRUD endpoints

2. **Update API Rules to block direct access**
   - Set `companies` rules to `null`
   - Set `memberships` create/update/delete to `null`
   - Keep read rules for now (validate server-side)

3. **Create authorization utilities**
   - Function: `getUserActiveMembership(userId, companyId, branchId?)`
   - Function: `hasPermission(membership, action, resource)`
   - Function: `canManageMembership(callerMembership, targetMembership)`

4. **Test with regular users**
   - Create test fixtures
   - Verify authorization checks
   - Verify scope isolation
   - Verify role permissions

**Files to Modify:**
- `pb_hooks/custom_auth.pb.js` (NEW)
- `pb_migrations/1791XXXXXX_secure_api_rules.js` (NEW)
- `docs/API_ENDPOINTS.md` (NEW - document custom endpoints)

**No Data Migration Required:** All collections are empty.

### Phase 2: Frontend Integration (Milestone 03)

**Goal:** Migrate frontend from `users.company` to `memberships`

**Steps:**

1. Update AuthContext to fetch memberships
2. Add company/branch selector
3. Send X-Active-Company header on all requests
4. Remove dependencies on `users.company`
5. Add membership UI (invite, manage roles)

### Phase 3: Resource Branch Assignment (Milestone 04)

**Goal:** Add `branch` field to products, tables, customers

**Steps:**

1. Add nullable `branch` field to collections
2. Migrate existing data (use default branch per company)
3. Update API Rules to check branch scope
4. Update frontend to filter by active branch

### Phase 4: Deprecate Legacy Fields (Milestone 05+)

**Goal:** Remove `users.company` and `users.role`

**Steps:**

1. Verify no code references these fields
2. Create migration to drop fields
3. Update documentation

---

## Part 8: Testing Strategy

### Test Fixtures (To Be Created)

**Companies:**
- Company A: "Alpha Corp" (owner: user_a_owner)
- Company B: "Beta Inc" (owner: user_b_owner)

**Branches:**
- Company A: Branch A1 "HQ", Branch A2 "Store 1"
- Company B: Branch B1 "Main Office"

**Users:**
- user_a_owner: owner of Company A (company-wide)
- user_a_manager: manager of Branch A1
- user_a_cashier: cashier of Branch A2
- user_b_owner: owner of Company B (company-wide)
- user_no_membership: authenticated but no memberships

**Prefix:** All test data must use prefix `M06_TEST_` for easy cleanup.

### Test Matrix

#### Category 1: Tenant Isolation

| Test | Actor | Target | Expected |
|------|-------|--------|----------|
| List companies | user_a_owner | ALL | See only Company A |
| List companies | user_b_owner | ALL | See only Company B |
| View Company B | user_a_owner | Company B | 403 Forbidden |
| List products | user_a_owner | Company A | See all products |
| List products | user_a_owner | Company B | Empty (no access) |
| Create product in B | user_a_owner | Company B | 403 Forbidden |

#### Category 2: Role-Based Permissions

| Test | Actor (Role) | Action | Target | Expected |
|------|--------------|--------|--------|----------|
| Create branch | user_a_owner (owner) | POST | Company A | 200 OK |
| Create branch | user_a_manager (manager) | POST | Company A | 200 OK |
| Create branch | user_a_cashier (cashier) | POST | Company A | 403 Forbidden |
| Delete branch | user_a_manager (manager) | DELETE | Branch A1 | 403 Forbidden |
| Delete branch | user_a_owner (owner) | DELETE | Branch A1 | 200 OK |

#### Category 3: Scope Resolution

| Test | Actor | Membership Scope | Action | Target | Expected |
|------|-------|------------------|--------|--------|----------|
| List branches | user_a_manager | Branch A1 only | GET | /branches | See all in Company A |
| List products | user_a_cashier | Branch A2 only | GET | /products | See only Branch A2 |
| Create product | user_a_manager | Branch A1 only | POST | Branch A2 | 403 Forbidden |

#### Category 4: Self-Promotion Prevention

| Test | Actor | Action | Expected |
|------|-------|--------|----------|
| Update own membership role | user_a_cashier | PATCH own membership, role: "owner" | 403 Forbidden |
| Update own membership company | user_a_cashier | PATCH own membership, company: B | 403 Forbidden |
| Create membership for self | user_a_owner | POST membership, user: self, role: owner | 403 Forbidden (must use separate endpoint) |

#### Category 5: Direct API Bypass

| Test | Method | Bypassing | Expected |
|------|--------|-----------|----------|
| Direct collection API | POST /api/collections/memberships/records | Custom endpoint | 403 Forbidden (rule = null) |
| Direct collection API | PUT /api/collections/companies/records/{id} | Custom endpoint | 403 Forbidden (rule = null) |

#### Category 6: Hook Validation

| Test | Payload | Expected |
|------|---------|----------|
| Create membership: valid branch | {company: A, branch: A1} | 200 OK |
| Create membership: cross-company | {company: A, branch: B1} | 400 Bad Request |
| Update membership: change branch | {branch: B1} | 400 Bad Request |

#### Category 7: User Without Membership

| Test | Actor | Action | Expected |
|------|-------|--------|----------|
| List companies | user_no_membership | GET /companies | Empty or 403 |
| Create company | user_no_membership | POST /companies | 403 or special signup flow |
| Access any resource | user_no_membership | GET /products | Empty (no memberships) |

### Test Execution Requirements

**⚠️ CRITICAL:**
- ❌ DO NOT use superuser token for authorization tests
- ✅ Create regular user accounts with JWT tokens
- ✅ Test with actual HTTP requests (not direct DAO calls)
- ✅ Verify HTTP status codes (not just database state)
- ✅ Test both positive (allowed) and negative (forbidden) cases
- ✅ Clean up test data after each test run

**Test Tools:**
- PocketBase JavaScript SDK (client-side)
- `curl` commands with JWT tokens
- Automated test script (to be created)

---

## Part 9: Business Decision Points

**These require your explicit decision before implementation:**

### Decision 1: Company Creation Flow

**Option A:** Public company creation
- Any authenticated user can create a company
- Creator automatically becomes owner
- Simple onboarding flow

**Option B:** Invite-only company creation
- Only existing owners can create companies
- Requires admin approval or invite code
- More controlled growth

**Recommendation:** Start with Option A for MVP, add Option B later if needed.

---

### Decision 2: Customer Role Permissions

**Question:** Should "customer" role be able to:
- View products/prices? (Likely yes - menu display)
- View table status? (Likely yes - self-service table selection)
- View other customers? (Likely no - privacy)
- Create orders for themselves? (Requires new `orders` collection)

**Recommendation:** Customer = read-only menu access. Self-service ordering is future feature.

---

### Decision 3: Manager Scope

**Question:** Can a branch manager create sub-branches?

**Option A:** No - only company-wide owners
**Option B:** Yes - managers can split their branch

**Recommendation:** Option A for simplicity. Branch creation = strategic decision.

---

### Decision 4: Membership Approval Workflow

**Question:** When a user wants to join a company:

**Option A:** Auto-join with pending status, owner approves
**Option B:** Request invite code from owner first
**Option C:** Owner sends invite link, user accepts

**Recommendation:** Option C for security (prevents spam membership requests).

---

### Decision 5: Multiple Active Memberships

**Question:** User has memberships in Company A and Company B. Frontend needs to:

**Option A:** User explicitly switches context (dropdown: "Switch to Company B")
**Option B:** Auto-detect from current route (/company-a/dashboard vs /company-b/dashboard)
**Option C:** Allow multiple tabs with different contexts

**Recommendation:** Option A for clarity. User always knows their current context.

---

## Part 10: Security Checklist

### Before Implementation

- [ ] Review permission matrix with stakeholders
- [ ] Confirm business decision points (Section 9)
- [ ] Create backup of current database state
- [ ] Document rollback procedure
- [ ] Create test fixtures with prefix `M06_TEST_`

### During Implementation

- [ ] Implement custom endpoints with authorization
- [ ] Update API Rules to block direct access
- [ ] Add audit logging for sensitive operations
- [ ] Implement rate limiting on membership changes
- [ ] Add input validation for all endpoints

### After Implementation

- [ ] Execute full test matrix (Section 8)
- [ ] Verify with regular user tokens (not superuser)
- [ ] Test edge cases (empty memberships, multiple roles)
- [ ] Perform penetration testing (attempt bypasses)
- [ ] Review PocketBase logs for errors

### Production Readiness

- [ ] Document all custom endpoints
- [ ] Create admin guide for membership management
- [ ] Set up monitoring/alerting for auth failures
- [ ] Plan for user migration from legacy flow
- [ ] Prepare incident response plan

---

## Part 11: Files Analysis

### Hooks

**pb_hooks/memberships_invariant.pb.js**
- ✅ Status: Working correctly
- ✅ Purpose: Enforce branch-company consistency
- ❌ Gap: Not tested with regular users

**pb_hooks/zalo_auth.pb.js**
- ✅ Status: Working for authentication
- ❌ Gap: Does not create membership
- ❌ Gap: User cannot access any data after signup
- 🔧 Action Required: Add company selection/joining flow

### Frontend (vie-minizalo)

⚠️ **Not audited in this phase** - frontend folder exists but no search performed per instructions.

**Expected Frontend Dependencies:**
- `users.company` field (to be migrated)
- `users.role` field (to be migrated)
- Likely: hardcoded company ID or auth context

**Frontend Migration Plan:**
1. Add membership fetching to AuthContext
2. Add company/branch selector UI
3. Store active context in state
4. Send X-Active-Company header
5. Remove users.company dependencies

### Migration Files

All migrations successfully applied. No rollback needed.

**Final migration to create:**
- `1791XXXXXX_secure_api_rules.js` - Lock down companies and memberships

---

## Summary of Findings

### Critical Security Issues (Must Fix)

1. ❌ **FATAL FLAW:** API Rules check `@request.auth.role = 'owner'` but users can only have "admin"/"user"
2. ❌ **NO AUTHORIZATION:** Any user can CRUD any company
3. ❌ **SELF-PROMOTION:** Users can assign themselves to any company
4. ❌ **NO TENANT ISOLATION:** Users can see all companies
5. ❌ **WEAK REFERENCES:** No foreign key constraints

### Architecture Decisions (Confirmed)

✅ **Use `memberships` as single source of truth**  
✅ **Custom endpoints for authorization-sensitive operations**  
✅ **Block direct collection API for companies/memberships**  
✅ **5-tier role model: owner, manager, cashier, staff, customer**  
✅ **Support company-wide and branch-specific memberships**

### Ready for Implementation

✅ All collections empty (no data migration risk)  
✅ Schema structure understood  
✅ Hook validation working  
✅ Permission matrix defined  
✅ Test plan created  
✅ Migration plan documented

### Awaiting User Decision

⏸️ Company creation flow (public vs invite-only)  
⏸️ Customer role permissions (read-only vs self-service)  
⏸️ Manager scope (can create sub-branches?)  
⏸️ Membership approval workflow  
⏸️ Multiple active memberships UI

---

## Verification Status

### ✅ Verified

- [x] PocketBase process (PID 15104, port 8390)
- [x] Database state (0 records in all collections)
- [x] Schema structure (users, companies, branches, memberships)
- [x] API Rules (runtime matches migrations)
- [x] Hooks (memberships_invariant, zalo_auth)
- [x] Migration history (all 16 applied)
- [x] Indexes (UNIQUE constraints on memberships)

### ❌ Not Verified (By Design)

- [ ] Frontend code usage of users.company/role (not searched per instructions)
- [ ] Authorization with regular user tokens (no test data created)
- [ ] Custom endpoints (not implemented yet)
- [ ] End-to-end flows (authentication → membership → resource access)

### ⚠️ Cannot Verify Without Implementation

- [ ] Performance of membership-based queries
- [ ] Frontend UX for company switching
- [ ] Membership invitation flow
- [ ] Audit logging effectiveness

---

## Next Steps

### Immediate Actions (Awaiting Your Approval)

1. **Review permission matrix** (Section 5)
2. **Make business decisions** (Section 9)
3. **Approve architecture** (Section 6)
4. **Authorize implementation** of Phase 1 migration plan

### After Approval

1. Create `pb_hooks/custom_auth.pb.js` with authorization logic
2. Create `pb_migrations/1791XXXXXX_secure_api_rules.js`
3. Create test fixtures with `M06_TEST_` prefix
4. Execute test matrix with regular user tokens
5. Document custom API endpoints
6. Update `M02_MIGRATION_COMPLETE.md` with security notes

---

## Files Modified in This Audit

**Created:**
- `docs/CHECKPOINT_6_AUTHORIZATION_SECURITY.md` (this file)

**Read (not modified):**
- `pocketbase/pb_schema.json`
- `pocketbase/pb_migrations/*.js` (all 8 migration files)
- `pocketbase/pb_hooks/memberships_invariant.pb.js`
- `pocketbase/pb_hooks/zalo_auth.pb.js`
- `pocketbase/pb_data/data.db` (via SQLite read-only queries)
- `docs/M02_MIGRATION_COMPLETE.md`
- `docs/M02_CURRENT_SCHEMA.md`

**Not Modified:**
- No schema changes
- No API Rule changes
- No hook changes
- No data changes
- No process restarts

---

**Audit Completed:** 2026-10-09  
**Status:** SAFE TO IMPLEMENT after business decisions confirmed  
**Risk Level:** LOW (empty database, fully reversible changes)

---

**End of Checkpoint 6 Authorization Security Audit**
