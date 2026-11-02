# Checkpoint 6 — Phase 1 Implementation Plan

**Date:** 2026-01-09  
**Status:** DESIGN APPROVED — Ready for implementation after business decision confirmation  
**PocketBase Version:** 0.40.4  
**Phase:** Phase 1 — Lock Critical Vulnerabilities

---

## Executive Summary

This document provides detailed implementation plan for **Phase 1** of Checkpoint 6, incorporating the **5 confirmed business decisions**:

1. ✅ **Company creation:** Invite-only (not public)
2. ✅ **Customer permissions:** Can view menu AND create orders (self-service)
3. ✅ **Manager scope:** Cannot create branches
4. ✅ **Membership approval:** Invitation link with expiration and usage limits
5. ✅ **Multiple memberships:** User explicitly switches context

**Phase 1 Goals:**
- Lock down critical security vulnerabilities
- Establish authorization architecture foundation
- Block self-promotion and unauthorized access
- Prepare for Phase 2 (invitation system) and Phase 3 (customer ordering)

**Database State:** ✅ All collections empty (0 records) — completely safe to refactor

---

## Part 1: Business Decisions Impact Analysis

### Decision 1: Invite-Only Company Creation

**Impact on Design:**

**Current State (VULNERABLE):**
```javascript
// companies collection
createRule: "@request.auth.id != \"\""  // ANY authenticated user can create
```

**Required Changes:**
1. Block direct company creation via REST API
2. Create custom endpoint `/api/custom/companies/create-with-owner`
3. Implement authorization check: who can create companies?

**Authorization Options:**

**Option A: System Admin Only**
- Add `users.is_system_admin` BOOLEAN field
- Only system admins can create companies
- Manual admin assignment by superuser
- **Pros:** Strictest control, clear authority
- **Cons:** Requires manual admin management, bottleneck for onboarding

**Option B: Special Invitation to Create Company**
- System has "company creator" invitations
- Superuser/existing owner creates invitation
- Invitation grants one-time company creation right
- **Pros:** Scalable, traceable, auditable
- **Cons:** More complex invitation types

**Option C: Owner Can Create Additional Companies**
- If user is owner of at least one company, can create another
- Prevents spam (first company requires admin approval)
- **Pros:** Self-service for legitimate business users
- **Cons:** Harder to prevent abuse

**🔴 DECISION REQUIRED:** Which authorization model for company creation?

**Recommendation:** Start with **Option A** (system admin) for MVP, implement Option B (special invitations) in Phase 2 when invitation system is mature.

---

### Decision 2: Customer Can View Menu and Create Orders

**Impact on Design:**

**Collections Needed:**
- ✅ `products` (exists)
- ✅ `tables` (exists)
- ✅ `customers` (exists)
- ❌ **`orders`** (MISSING — must create)
- ❌ **`order_items`** (MISSING — must create)

**New Collections Schema:**

```javascript
// orders collection
{
  id: TEXT PRIMARY KEY,
  company: TEXT NOT NULL,           // Which company
  branch: TEXT NOT NULL,            // Which branch
  customer: TEXT NOT NULL,          // Customer membership (not customer record!)
  table: TEXT,                      // Optional: dine-in table
  status: TEXT NOT NULL,            // pending/confirmed/preparing/completed/cancelled
  total_amount: NUMERIC NOT NULL,   // Server-calculated, NOT from client
  payment_status: TEXT NOT NULL,    // unpaid/paid/refunded
  notes: TEXT,
  created_by: TEXT NOT NULL,        // User who created (customer or staff)
  created: TEXT NOT NULL,
  updated: TEXT NOT NULL
}

// order_items collection
{
  id: TEXT PRIMARY KEY,
  order: TEXT NOT NULL,             // Relation to orders
  product: TEXT NOT NULL,           // Relation to products
  quantity: NUMERIC NOT NULL,
  unit_price: NUMERIC NOT NULL,     // Snapshot at order time
  subtotal: NUMERIC NOT NULL,       // Server-calculated: quantity * unit_price
  created: TEXT NOT NULL
}
```

**Customer Permissions (Updated):**

| Action | Customer | Logic |
|--------|----------|-------|
| View products (menu) | ✅ | Read-only, own branch |
| View table status | ✅ | Read-only, own branch |
| Create order | ✅ | Via custom endpoint, own branch only |
| View own orders | ✅ | Only orders where customer = own membership |
| View other orders | ❌ | Privacy protection |
| Modify order after creation | ❌ | Contact staff |
| Modify prices/totals | ❌ | **CRITICAL: Server-side calculation only** |
| Cancel own pending order | ✅ | Only if status=pending, via endpoint |

**Security Requirements:**

1. **Price Validation:** Customer CANNOT send `total_amount` or `subtotal`
   - Server fetches current product prices
   - Server calculates totals
   - Client-sent prices are IGNORED

2. **Scope Validation:** Customer can only order from their active branch
   - Verify customer membership active
   - Verify product belongs to same company/branch
   - Verify table (if specified) belongs to same branch

3. **Status Workflow:** Strict state machine
   ```
   pending → confirmed → preparing → completed
                ↓
            cancelled (only from pending)
   ```

4. **Audit Trail:** Log all order creation and status changes

**Custom Endpoints Required:**

```
POST /api/custom/orders/create
  - Validates customer membership
  - Validates products exist and belong to same branch
  - Fetches current prices (ignores client prices)
  - Calculates totals
  - Creates order + order_items atomically
  - Returns order with actual prices

GET /api/custom/orders/my-orders
  - Returns only orders where customer = caller's membership
  - Filtered by active company/branch

PATCH /api/custom/orders/{id}/cancel
  - Only if status=pending
  - Only if order.customer = caller's membership
```

**⚠️ PHASE 1 SCOPE:** Collections and basic API Rules only. Full customer ordering implementation in **Phase 3**.

---

### Decision 3: Manager Cannot Create Branches

**Impact on Design:**

**Current Vulnerable Rules:**
```javascript
// branches collection
createRule: "@request.auth.company = company && @request.auth.role = 'owner'"
// This check FAILS because users.role != memberships.role
```

**Fixed Rules (Phase 1):**
```javascript
// branches collection
createRule: null  // Block direct API
// Custom endpoint checks membership role
```

**Permission Matrix:**

| Role | Create Branch | Update Branch | Delete Branch |
|------|---------------|---------------|---------------|
| owner (company-wide) | ✅ | ✅ | ✅ |
| owner (branch-specific) | ❌ | ✅ (own branch) | ❌ |
| manager | ❌ | ✅ (own scope) | ❌ |
| cashier/staff/customer | ❌ | ❌ | ❌ |

**Custom Endpoint:**
```
POST /api/custom/branches/create
  - Check caller has owner role
  - Check owner membership is company-wide (branch=null)
  - Prevent branch-specific owners from creating branches
```

---

### Decision 4: Invitation Link with Expiration and Usage Limits

**Impact on Design:**

**New Collection Required: `invitations`**

```javascript
{
  id: TEXT PRIMARY KEY,
  company: TEXT NOT NULL,           // Target company
  branch: TEXT,                     // Target branch (null = company-wide)
  role: TEXT NOT NULL,              // Role to grant (owner/manager/cashier/staff/customer)
  token: TEXT NOT NULL,             // Unique, hard-to-guess token (32+ chars)
  expires_at: TEXT NOT NULL,        // ISO timestamp
  max_uses: INTEGER NOT NULL,       // Maximum number of acceptances
  current_uses: INTEGER DEFAULT 0,  // How many times already used
  status: TEXT NOT NULL,            // active/revoked/expired/exhausted
  created_by: TEXT NOT NULL,        // Membership who created invitation
  created: TEXT NOT NULL,
  updated: TEXT NOT NULL
}

-- Indexes
CREATE UNIQUE INDEX idx_invitation_token ON invitations(token);
CREATE INDEX idx_invitation_company ON invitations(company);
CREATE INDEX idx_invitation_status ON invitations(status);
```

**Security Requirements:**

1. **Token Generation:**
   - Use cryptographically secure random (32+ chars)
   - DO NOT use predictable sequences or timestamps
   - Hash token before storage if high-security context

2. **Who Can Create Invitations:**
   - owner (company-wide): can invite to any branch
   - owner (branch-specific): can only invite to own branch
   - manager: can invite to own scope (company-wide or branch)
   - cashier/staff/customer: CANNOT create invitations

3. **Role Restrictions:**
   - CANNOT create invitation for "owner" role via regular endpoint
   - Owner invitations require special approval or system admin
   - Prevents privilege escalation

4. **Validation on Accept:**
   - Check invitation exists and token matches
   - Check status = active
   - Check expires_at > now
   - Check current_uses < max_uses
   - Check user authenticated
   - Check user doesn't already have membership in this company/branch
   - Atomic increment of current_uses (prevent race condition)

5. **Audit Trail:**
   - Log invitation creation
   - Log invitation acceptance
   - Log invitation revocation
   - Do NOT log raw tokens

**Custom Endpoints:**

```
POST /api/custom/invitations/create
  Body: {company, branch?, role, expires_at, max_uses}
  - Verify caller has owner/manager role
  - Verify caller's scope covers target scope
  - Generate secure token
  - Return invitation ID and token (one-time display)

POST /api/custom/invitations/accept
  Body: {token}
  - Validate token
  - Check all security requirements
  - Create membership atomically
  - Increment current_uses
  - Return membership record

DELETE /api/custom/invitations/{id}/revoke
  - Verify caller created invitation OR is owner
  - Set status = revoked

GET /api/custom/invitations/my-invitations
  - List invitations created by caller's memberships
  - Include usage stats
```

**API Rules (Block Direct Access):**

```javascript
invitations: {
  listRule: null,
  viewRule: null,
  createRule: null,
  updateRule: null,
  deleteRule: null
}
// ALL operations through custom endpoints
```

**⚠️ PHASE 1 SCOPE:** Design only. Implementation in **Phase 2** after core authorization is locked down.

---

### Decision 5: User Explicitly Switches Context

**Impact on Design:**

**Authorization Flow (Updated):**

```
1. User authenticates → JWT token (user.id only)
2. Frontend calls GET /api/custom/memberships/my-memberships
3. Frontend shows company/branch selector
4. User selects active context
5. Frontend stores: activeCompanyId, activeBranchId, activeRole
6. ALL subsequent requests send headers:
   X-Active-Company: {companyId}
   X-Active-Branch: {branchId}  (optional)
7. Backend VALIDATES on EVERY request:
   - Extract user.id from JWT
   - Extract companyId/branchId from headers
   - Query: SELECT * FROM memberships 
            WHERE user = {user.id} 
            AND company = {companyId}
            AND (branch = {branchId} OR branch IS NULL)
            AND active = true
   - If no match: 403 Forbidden
   - If match: proceed with role-based authorization
```

**Security Requirements:**

1. **Never Trust Headers:**
   - X-Active-Company is a REQUEST, not authorization
   - Must verify membership exists and is active
   - Must verify scope matches

2. **Scope Hierarchy:**
   - Company-wide membership (branch=null) → access all branches
   - Branch-specific membership → access only that branch
   - If user has both, company-wide takes precedence

3. **Role Resolution:**
   - If user has multiple memberships in same company, use highest privilege
   - owner > manager > cashier > staff > customer

4. **Session Isolation:**
   - Context switch does NOT modify membership records
   - Context switch does NOT modify users table
   - Context is purely frontend state

**Custom Endpoint (Get Available Contexts):**

```
GET /api/custom/memberships/my-memberships
  Returns: [
    {
      id: membership_id,
      company: {id, name},
      branch: {id, name} | null,
      role: "owner" | "manager" | ...,
      active: true/false
    }
  ]
  - Only active memberships
  - Grouped by company
  - Frontend builds context selector
```

**Authorization Middleware (All Endpoints):**

```javascript
function requireActiveMembership(requiredRole?) {
  return (c) => {
    // 1. Get user from JWT
    const user = $apis.requestInfo(c).auth;
    
    // 2. Get context from headers
    const companyId = c.req.header("X-Active-Company");
    const branchId = c.req.header("X-Active-Branch");
    
    if (!companyId) {
      throw new BadRequestError("X-Active-Company header required");
    }
    
    // 3. Verify membership
    const membership = $app.dao().findFirstRecordByFilter(
      "memberships",
      `user = {:user} && company = {:company} && active = true && 
       (branch = {:branch} || branch = "")`,
      {user: user.id, company: companyId, branch: branchId || ""}
    );
    
    if (!membership) {
      throw new ForbiddenError("No active membership for this context");
    }
    
    // 4. Check role if required
    if (requiredRole && !hasPermission(membership.role, requiredRole)) {
      throw new ForbiddenError("Insufficient permissions");
    }
    
    // 5. Attach to context
    c.set("membership", membership);
    c.set("companyId", companyId);
    c.set("branchId", branchId);
  }
}
```

---

## Part 2: Updated Permission Matrix

Based on 5 business decisions, here is the **complete permission matrix**:

### Collection: users

| Action | Anonymous | Authenticated (no membership) | Any Role |
|--------|-----------|-------------------------------|----------|
| List all | ❌ | ❌ | ❌ (privacy) |
| View self | ❌ | ✅ | ✅ |
| View others | ❌ | ❌ | ❌ |
| Create (signup) | ✅ | N/A | N/A |
| Update self | ❌ | ✅ (limited fields) | ✅ (limited fields) |
| Update others | ❌ | ❌ | ❌ |
| Delete | ❌ | ❌ | ❌ (contact admin) |

**Limited Update Fields:** username, email, password, emailVisibility  
**CANNOT Update:** company, role (prevents self-promotion)

### Collection: companies

| Action | owner | manager | cashier | staff | customer | no membership | system admin |
|--------|-------|---------|---------|-------|----------|---------------|--------------|
| List own | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ (all) |
| List all | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| View own | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| View others | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Create | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Update | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Delete | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

**Decision 1 Impact:** Only system admin can create companies (invite-only model)

### Collection: branches

| Action | owner (company-wide) | owner (branch) | manager | cashier | staff | customer |
|--------|---------------------|----------------|---------|---------|-------|----------|
| List (own company) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View (own company) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Update | ✅ | ✅ (own only) | ✅ (own scope) | ❌ | ❌ | ❌ |
| Delete | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

**Decision 3 Impact:** Manager CANNOT create branches

### Collection: memberships

| Action | owner | manager | cashier | staff | customer | no membership |
|--------|-------|---------|---------|-------|----------|---------------|
| List (own company) | ✅ | ✅ | ✅ (read-only) | ✅ (read-only) | ✅ (read-only) | ❌ |
| View self | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| View others (same company) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create via invitation | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create directly | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Update own | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Update others | ✅ | ✅ (own scope) | ❌ | ❌ | ❌ | ❌ |
| Delete/deactivate | ✅ | ✅ (own scope) | ❌ | ❌ | ❌ | ❌ |

**Decision 4 Impact:** Memberships created via invitation link only

### Collection: invitations

| Action | owner (company-wide) | owner (branch) | manager | cashier | staff | customer |
|--------|---------------------|----------------|---------|---------|-------|----------|
| List own created | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Create | ✅ (any branch) | ✅ (own branch) | ✅ (own scope) | ❌ | ❌ | ❌ |
| Accept | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Revoke own | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Revoke others | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

**Decision 4 Impact:** Invitation system is the ONLY way to join a company

### Collection: products

| Action | owner | manager | cashier | staff | customer | no membership |
|--------|-------|---------|---------|-------|----------|---------------|
| List (own scope) | ✅ | ✅ | ✅ | ✅ | ✅ (menu) | ❌ |
| View (own scope) | ✅ | ✅ | ✅ | ✅ | ✅ (menu) | ❌ |
| Create | ✅ | ✅ | ✅ (POS) | ❌ | ❌ | ❌ |
| Update | ✅ | ✅ | ✅ (POS) | ❌ | ❌ | ❌ |
| Delete | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

**Decision 2 Impact:** Customer can view products (menu display)

### Collection: tables

| Action | owner | manager | cashier | staff | customer | no membership |
|--------|-------|---------|---------|-------|----------|---------------|
| List (own scope) | ✅ | ✅ | ✅ | ✅ | ✅ (status) | ❌ |
| View (own scope) | ✅ | ✅ | ✅ | ✅ | ✅ (status) | ❌ |
| Create | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Update | ✅ | ✅ | ✅ (status) | ✅ (status) | ❌ | ❌ |
| Delete | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

**Decision 2 Impact:** Customer can view table status (for table selection)

### Collection: orders (NEW)

| Action | owner | manager | cashier | staff | customer | no membership |
|--------|-------|---------|---------|-------|----------|---------------|
| List (all in scope) | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| List (own only) | N/A | N/A | N/A | N/A | ✅ | ❌ |
| View (all in scope) | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| View (own only) | N/A | N/A | N/A | N/A | ✅ | ❌ |
| Create | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Update status | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Cancel (own, pending) | N/A | N/A | N/A | N/A | ✅ | ❌ |
| Delete | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

**Decision 2 Impact:** Customer can create orders (self-service)

### Collection: order_items (NEW)

| Action | owner | manager | cashier | staff | customer | no membership |
|--------|-------|---------|---------|-------|----------|---------------|
| List (via order) | ✅ | ✅ | ✅ | ✅ | ✅ (own orders) | ❌ |
| View (via order) | ✅ | ✅ | ✅ | ✅ | ✅ (own orders) | ❌ |
| Create | Via order creation endpoint only (all roles blocked from direct API) |
| Update | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Delete | Via order deletion only (owner/manager) |

**Decision 2 Impact:** Order items managed atomically with orders

---

## Part 3: Phase 1 Implementation Steps

### Overview

Phase 1 locks down **critical security vulnerabilities** identified in the audit:

1. 🔴 **VULN-1:** Fatal role check logic (`@request.auth.role = 'owner'` never matches)
2. 🔴 **VULN-2:** No authorization on companies (any user can CRUD any company)
3. 🔴 **VULN-3:** Users can self-assign to any company via `users.company`
4. 🔴 **VULN-4:** Users can self-promote via direct membership API
5. 🔴 **VULN-5:** No tenant isolation (users can see all companies)

**Phase 1 Goals:**
- Block all unauthorized access paths
- Implement membership-based authorization foundation
- Create secure custom endpoints
- Establish test framework with regular user tokens

**Out of Scope (Future Phases):**
- Invitation system implementation (Phase 2)
- Customer ordering implementation (Phase 3)
- Frontend migration (Phase 3)
- Resource branch assignment (Phase 4)

---

### Step 1: Backup Verification

**Goal:** Ensure safe rollback capability

**Tasks:**
1. ✅ Verify backup exists: `backups/milestone-02/checkpoint-5-after/pb_data_20261009_135203/`
2. ✅ Verify backup readable: 28KB schema file + pb_data directory
3. ✅ Verify database state: 0 records in all collections (completely safe)
4. Create new backup before any changes: `backups/milestone-02/checkpoint-6-before/`

**Verification:**
```bash
# Verify backup can be read
sqlite3 backups/milestone-02/checkpoint-5-after/pb_data_20261009_135203/data.db ".tables"

# Create new backup
mkdir -p backups/milestone-02/checkpoint-6-before
cp -r pb_data backups/milestone-02/checkpoint-6-before/pb_data_$(date +%Y%m%d_%H%M%S)
cp pb_schema.json backups/milestone-02/checkpoint-6-before/pb_schema_$(date +%Y%m%d_%H%M%S).json
```

**Rollback Plan:**
```bash
# If Phase 1 needs rollback:
# 1. Stop PocketBase (do NOT kill -9)
# 2. Restore backup
rm -rf pb_data
cp -r backups/milestone-02/checkpoint-6-before/pb_data_TIMESTAMP pb_data
# 3. Restart PocketBase
# 4. Verify with: sqlite3 pb_data/data.db "SELECT name, createRule FROM _collections WHERE name='companies';"
```

**Status:** ✅ COMPLETED (backup verified in previous step)

---

### Step 2: Block Self-Promotion Paths

**Goal:** Prevent users from modifying their own authorization fields

**Problem:** Users can currently:
- Update `users.company` to any company ID
- Update `users.role` to "admin"
- Both via `PATCH /api/collections/users/records/{id}`

**Current Vulnerable Rule:**
```javascript
// users collection
updateRule: "id = @request.auth.id || @request.auth.role = \"admin\""
// Allows user to update their OWN record, including company/role!
```

**Solution:** Block company/role updates at field level

**Implementation:**

**File:** `pb_migrations/1791537XXX_secure_users_fields.js`

```javascript
/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")

  // Make company and role fields non-updateable by users
  collection.schema.getFieldById("relation_company").system = true
  collection.schema.getFieldById("select_role").system = true

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")

  // Rollback: make fields updateable again
  collection.schema.getFieldById("relation_company").system = false
  collection.schema.getFieldById("select_role").system = false

  return app.save(collection)
})
```

**⚠️ Alternative (if system field doesn't work):** Update API Rule to exclude these fields

```javascript
updateRule: "id = @request.auth.id && @request.data.company:isset = false && @request.data.role:isset = false || @request.auth.role = \"admin\""
```

**Test Cases:**
```bash
# Test 1: User tries to update own company
curl -X PATCH http://127.0.0.1:8390/api/collections/users/records/{id} \
  -H "Authorization: Bearer {user_token}" \
  -d '{"company": "other_company_id"}'
# Expected: 400 Bad Request (field not updateable)

# Test 2: User tries to update own role
curl -X PATCH http://127.0.0.1:8390/api/collections/users/records/{id} \
  -H "Authorization: Bearer {user_token}" \
  -d '{"role": "admin"}'
# Expected: 400 Bad Request (field not updateable)

# Test 3: User updates allowed fields
curl -X PATCH http://127.0.0.1:8390/api/collections/users/records/{id} \
  -H "Authorization: Bearer {user_token}" \
  -d '{"username": "new_username"}'
# Expected: 200 OK
```

**Files Modified:**
- `pb_migrations/1791537XXX_secure_users_fields.js` (NEW)

**Rollback:** Revert migration or update API Rule back

---

### Step 3: Lock Down Companies Collection

**Goal:** Block unauthorized company access and modification

**Current Vulnerability:**
```javascript
// companies collection
listRule: "@request.auth.id != \"\""      // ANY authenticated user
createRule: "@request.auth.id != \"\""    // ANY authenticated user can create
updateRule: "@request.auth.id != \"\""    // ANY authenticated user can update
deleteRule: "@request.auth.id != \"\""    // ANY authenticated user can delete
```

**Solution:** Block direct API access, route through custom endpoints

**Implementation:**

**File:** `pb_migrations/1791537XXX_secure_companies.js`

```javascript
/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_XXXXXX") // companies

  collection.listRule = null
  collection.viewRule = null
  collection.createRule = null
  collection.updateRule = null
  collection.deleteRule = null

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_XXXXXX") // companies

  // Rollback to previous (vulnerable) rules
  collection.listRule = "@request.auth.id != \"\""
  collection.viewRule = "@request.auth.id != \"\""
  collection.createRule = "@request.auth.id != \"\""
  collection.updateRule = "@request.auth.id != \"\""
  collection.deleteRule = "@request.auth.id != \"\""

  return app.save(collection)
})
```

**Test Cases:**
```bash
# Test 1: Try to list companies directly
curl http://127.0.0.1:8390/api/collections/companies/records \
  -H "Authorization: Bearer {user_token}"
# Expected: 403 Forbidden

# Test 2: Try to create company directly
curl -X POST http://127.0.0.1:8390/api/collections/companies/records \
  -H "Authorization: Bearer {user_token}" \
  -d '{"name": "Evil Corp"}'
# Expected: 403 Forbidden
```

**Files Modified:**
- `pb_migrations/1791537XXX_secure_companies.js` (NEW)

**Rollback:** Revert migration

---

### Step 4: Lock Down Memberships Collection

**Goal:** Prevent self-promotion and unauthorized membership creation

**Current Vulnerability:**
```javascript
// memberships collection
createRule: "@request.auth.company = company && @request.auth.role ?= 'owner'"
// This NEVER works (users.role != 'owner'), but if it did, users could create own memberships
```

**Solution:** Block direct API access
