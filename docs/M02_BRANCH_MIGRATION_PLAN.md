# M02 BRANCH MIGRATION PLAN
**Date:** 2026-10-08  
**Checkpoint:** 2 — Company → Branch Design  
**Status:** DESIGN PHASE (No database changes)

---

## 1. ARCHITECTURE OVERVIEW

### Current Architecture (Milestone 01)
```
Company (weak reference)
  ├── users.company (TEXT field)
  ├── tables.company (TEXT field)
  ├── products.company (TEXT field)
  └── customers.company (TEXT field)
```

**Issues:**
- No referential integrity
- Single-tenant only (user belongs to one company)
- No branch concept
- Direct company reference in users table

### Target Architecture (Multi-Tenant)
```
Company
  └── Branch (1:N)
       ├── Tables (N:1)
       ├── Products (N:1)
       ├── Customers (N:1)
       ├── Table Sessions (N:1)
       ├── Orders (N:1)
       ├── Reservations (N:1)
       └── Invoices (N:1)

User
  └── Membership (1:N)
       ├── Company (N:1)
       ├── Branch (N:1)
       └── Role (enum)
```

**Benefits:**
- Multi-tenant support (user can belong to multiple companies/branches)
- Branch-level data isolation
- Role-based access control
- Proper referential integrity
- Scalable for franchise/chain businesses

---

## 2. PHASE 1 — `branches` COLLECTION DESIGN

### Schema Definition

```typescript
interface Branch {
  id: string                    // PocketBase auto-generated (15 chars)
  company: string               // Relation to companies (required)
  name: string                  // Branch name (required)
  code: string                  // Branch code (required, unique per company)
  address?: string              // Physical address
  phone?: string                // Contact phone
  active: boolean               // Soft delete flag (default: true)
  sort_order: number            // Display ordering (default: 0)
  created: string               // Auto timestamp
  updated: string               // Auto timestamp
}
```

### Field Analysis

| Field | Type | Required | Unique | Relation | Default | Notes |
|-------|------|----------|--------|----------|---------|-------|
| id | TEXT | ✅ Yes | ✅ Yes (PK) | - | auto | 15-char random |
| **company** | TEXT | ✅ Yes | ❌ No | companies | - | **Relation field** |
| **name** | TEXT | ✅ Yes | ❌ No | - | - | Display name |
| **code** | TEXT | ✅ Yes | ⚠️ Partial | - | - | **Unique per company** |
| address | TEXT | ❌ No | ❌ No | - | '' | Optional |
| phone | TEXT | ❌ No | ❌ No | - | '' | Optional |
| **active** | BOOLEAN | ✅ Yes | ❌ No | - | true | Soft delete |
| sort_order | NUMBER | ✅ Yes | ❌ No | - | 0 | Display order |
| created | TEXT | ✅ Yes | ❌ No | - | auto | Timestamp |
| updated | TEXT | ✅ Yes | ❌ No | - | auto | Timestamp |

### Critical Design Decisions

#### **Decision 1: `code` Uniqueness**

**Requirement:** `code` should be unique **per company**, not globally.

**Problem:** PocketBase unique indexes are global, not scoped.

**Solutions Evaluated:**

**Option A: Composite Unique Index (Preferred)**
```sql
CREATE UNIQUE INDEX idx_company_code ON branches (company, code);
```
- ✅ Database-level enforcement
- ✅ No race conditions
- ✅ Clear error messages
- ⚠️ **PocketBase 0.40.4 support:** UNKNOWN (needs verification)

**Option B: API Rule Validation**
```javascript
// In createRule/updateRule
@collection.branches.company = company && 
@collection.branches.code = code
```
- ⚠️ Application-level only
- ❌ Subject to race conditions
- ❌ Complex rule expression

**Option C: Backend Hook Validation**
```javascript
// In pb_hooks/branches.pb.js
onBeforeCreate/onBeforeUpdate: check for duplicates
```
- ✅ Application-level enforcement
- ✅ Flexible validation logic
- ⚠️ Not atomic (race window)

**Recommendation:** 
1. **Try Option A first** (composite unique index)
2. **Fallback to Option C** if PocketBase doesn't support composite indexes

#### **Decision 2: Soft Delete vs Hard Delete**

**Choice:** Use `active` boolean for soft delete

**Why:**
- Preserve historical data for audit
- Allow branch reactivation
- Maintain referential integrity with existing records
- Support "archive" UX pattern

**How to apply:**
- All queries must filter `active = true` by default
- Admin UI can show inactive branches
- Cannot hard-delete branch with active tables/products/orders

---

## 3. PHASE 2 — `memberships` COLLECTION DESIGN

### Schema Definition

```typescript
interface Membership {
  id: string                    // PocketBase auto-generated
  user: string                  // Relation to users (required)
  company: string               // Relation to companies (required)
  branch?: string               // Relation to branches (nullable)
  role: 'owner' | 'manager' | 'cashier' | 'staff' | 'customer'
  active: boolean               // Soft delete flag (default: true)
  created: string               // Auto timestamp
  updated: string               // Auto timestamp
}
```

### Field Analysis

| Field | Type | Required | Unique | Relation | Default | Notes |
|-------|------|----------|--------|----------|---------|-------|
| id | TEXT | ✅ Yes | ✅ Yes (PK) | - | auto | 15-char random |
| **user** | TEXT | ✅ Yes | ❌ No | users | - | **Relation** |
| **company** | TEXT | ✅ Yes | ❌ No | companies | - | **Relation** |
| **branch** | TEXT | ❌ No | ❌ No | branches | null | **Nullable relation** |
| **role** | TEXT | ✅ Yes | ❌ No | - | - | **Enum (see below)** |
| active | BOOLEAN | ✅ Yes | ❌ No | - | true | Soft delete |
| created | TEXT | ✅ Yes | ❌ No | - | auto | Timestamp |
| updated | TEXT | ✅ Yes | ❌ No | - | auto | Timestamp |

### Critical Design Decisions

#### **Decision 3: `branch` Nullable Semantics**

**Question:** What does `branch = null` mean in a membership?

**Options:**

**Option A: Company-Level Membership (Recommended)**
```
branch = null → User has access to ALL branches of that company
```
- Use case: Company owner, CEO, auditor
- Scope: Company-wide permissions
- Example: Owner can manage all branches

**Option B: Branch Required**
```
branch = NOT NULL → Every membership must specify a branch
```
- Use case: Strict branch isolation
- Scope: Branch-specific only
- Example: Each staff member assigned to one branch

**Recommendation:** **Option A** (nullable branch)

**Why:**
- Flexible for multi-branch owners
- Natural hierarchy: company → branch
- Simplifies onboarding (owner can see all branches)

**How to apply:**
- `branch = null` + `role = owner` → company-wide owner
- `branch = <id>` + `role = manager` → branch manager
- API rules check: `membership.branch = null OR membership.branch = resource.branch`

#### **Decision 4: Role Enforcement**

**Requirement:** `role` must be one of: `owner`, `manager`, `cashier`, `staff`, `customer`

**Problem:** PocketBase TEXT fields don't enforce enums at database level.

**Solutions:**

**Option A: Frontend + API Rule Validation (Recommended)**
```javascript
// API Rule (createRule/updateRule)
role = "owner" || role = "manager" || role = "cashier" || 
role = "staff" || role = "customer"
```
- ✅ Database-enforced via API rules
- ✅ Clear validation errors
- ⚠️ Long rule expression

**Option B: Backend Hook Validation**
```javascript
// pb_hooks/memberships.pb.js
const VALID_ROLES = ['owner', 'manager', 'cashier', 'staff', 'customer'];
if (!VALID_ROLES.includes(record.get('role'))) {
  throw new BadRequestError('Invalid role');
}
```
- ✅ Clean validation logic
- ✅ Easy to maintain
- ⚠️ Not enforced at DB level

**Option C: Select Field in PocketBase Schema**
```json
{
  "type": "select",
  "name": "role",
  "values": ["owner", "manager", "cashier", "staff", "customer"],
  "maxSelect": 1
}
```
- ✅ **Native PocketBase enum support**
- ✅ Admin UI dropdown
- ✅ Database-level validation
- ✅ **BEST OPTION**

**Recommendation:** **Option C** (use PocketBase select field)

**Why:**
- Native enum support in PocketBase 0.40.4
- Clean, maintainable
- Enforced at schema level

#### **Decision 5: Unique Constraint on Membership**

**Question:** Can a user have multiple memberships for the same company/branch?

**Answer:** **No** — one membership per user/company/branch combination.

**Implementation:**
```sql
CREATE UNIQUE INDEX idx_user_company_branch 
ON memberships (user, company, branch)
WHERE branch IS NOT NULL;

CREATE UNIQUE INDEX idx_user_company_null_branch
ON memberships (user, company)
WHERE branch IS NULL;
```

**Why:**
- Prevents duplicate memberships
- Clarifies role assignment
- Simplifies access control logic

**Edge case:**
- User can have `branch = null` (company-wide) AND `branch = <id>` memberships
- Company-wide takes precedence in access checks

---

## 4. PHASE 3 — RELATIONSHIP INVARIANTS

### Invariant Rules

#### **INV-1: Company → Branch (1:N)**
```
One company can have many branches.
One branch belongs to exactly one company.
```

**Enforcement:**
- `branches.company` is required relation
- Cascade delete: deleting company deletes all branches (⚠️ dangerous)
- Recommended: Prevent company deletion if branches exist

#### **INV-2: User → Membership (1:N)**
```
One user can have many memberships (multi-tenant).
One membership belongs to exactly one user.
```

**Enforcement:**
- `memberships.user` is required relation
- Cascade delete: deleting user deletes all memberships (✅ safe)

#### **INV-3: Company → Membership (1:N)**
```
One company can have many memberships.
One membership belongs to exactly one company.
```

**Enforcement:**
- `memberships.company` is required relation
- Prevent company deletion if active memberships exist

#### **INV-4: Branch → Membership (1:N)**
```
One branch can have many memberships.
One membership belongs to zero or one branch (nullable).
```

**Enforcement:**
- `memberships.branch` is nullable relation
- `branch = null` means company-wide membership
- Prevent branch deletion if memberships exist

#### **INV-5: Membership Consistency (CRITICAL)**
```
membership.branch.company MUST EQUAL membership.company
```

**Why:**
Cannot have:
```javascript
membership.company = Company A
membership.branch = Branch X (belongs to Company B)  // ❌ INVALID
```

**Enforcement Options:**

**Option A: API Rule Validation (Preferred)**
```javascript
// In memberships createRule/updateRule
branch = null || @request.data.branch.company = company
```

**Why this is complex in PocketBase:**
- PocketBase API rules cannot traverse relations deeply
- Expression: `@request.data.branch.company` may not work
- **Limitation: PocketBase 0.40.4 does NOT support nested relation checks in rules**

**Option B: Backend Hook (REQUIRED)**
```javascript
// pb_hooks/memberships.pb.js
onBeforeCreate(e) {
  const branchId = e.record.get('branch');
  if (branchId) {
    const branch = $app.dao().findRecordById('branches', branchId);
    const membershipCompany = e.record.get('company');
    if (branch.get('company') !== membershipCompany) {
      throw new BadRequestError('Branch must belong to membership company');
    }
  }
}
```

**Recommendation:** **Use Option B** (backend hook) because PocketBase API rules cannot check nested relations.

**⚠️ SECURITY IMPLICATION:**
- This invariant CANNOT be enforced purely at database level
- Backend hook is application-level validation (race condition window)
- Frontend MUST NOT rely on this for security
- API rules MUST check membership.company, not just membership.branch

---

## 5. PHASE 4 — ROLE PERMISSION MODEL

### Permission Matrix

| Role     | View Company | Manage Branches | View Tables | Manage Tables | View Products | Manage Products | Create Orders | View Orders | View Invoices | Manage Invoices | Manage Users |
|----------|--------------|-----------------|-------------|---------------|---------------|-----------------|---------------|-------------|---------------|-----------------|--------------|
| **owner** | ✅ Full | ✅ Full | ✅ All | ✅ All | ✅ All | ✅ All | ✅ Yes | ✅ All | ✅ All | ✅ All | ✅ Full |
| **manager** | ✅ Read | ✅ Assigned | ✅ Assigned | ✅ Assigned | ✅ Assigned | ✅ Assigned | ✅ Yes | ✅ Assigned | ✅ Assigned | ✅ Assigned | ⚠️ Invite only |
| **cashier** | ❌ No | ❌ No | ✅ Assigned | ⚠️ Status only | ✅ Assigned | ❌ No | ✅ Yes | ✅ Own shift | ✅ Own shift | ✅ Process | ❌ No |
| **staff** | ❌ No | ❌ No | ✅ Assigned | ⚠️ Status only | ✅ Assigned | ❌ No | ✅ Yes | ✅ Own | ⚠️ View own | ❌ No | ❌ No |
| **customer** | ❌ No | ❌ No | ✅ Available | ❌ No | ✅ Active | ❌ No | ✅ Own | ✅ Own | ✅ Own | ❌ No | ⚠️ Own profile |

### Role Definitions

#### **owner**
- **Scope:** Company-wide (can have `branch = null`)
- **Permissions:** Full CRUD on all resources within company
- **Use case:** Company founder, CEO
- **Special:** Can create/delete branches, assign managers

#### **manager**
- **Scope:** Branch-specific (must have `branch != null`)
- **Permissions:** Full CRUD on assigned branch resources
- **Use case:** Branch manager, area supervisor
- **Special:** Can invite staff, view reports

#### **cashier**
- **Scope:** Branch-specific
- **Permissions:** 
  - View tables/products (read-only)
  - Create/manage orders
  - Process payments
  - Print invoices
- **Use case:** Front desk, cashier
- **Limitations:** Cannot modify prices, cannot void invoices

#### **staff**
- **Scope:** Branch-specific
- **Permissions:**
  - View assigned tables
  - Update table status (available/occupied)
  - Create orders for customers
  - View own orders
- **Use case:** Waiter, service staff
- **Limitations:** Cannot access billing

#### **customer**
- **Scope:** Self only
- **Permissions:**
  - View available tables
  - View active products (menu)
  - Create reservations
  - View own orders/invoices
- **Use case:** End customer
- **Limitations:** Cannot see internal data

### Permission Enforcement Strategy

**PocketBase API Rule Pattern:**

```javascript
// For tables collection
listRule: `
  @request.auth.id != "" && (
    // Owner with company-wide access
    (@collection.memberships.user = @request.auth.id && 
     @collection.memberships.company = company &&
     @collection.memberships.branch = null &&
     @collection.memberships.role = "owner") ||
    
    // Any role with branch-specific access
    (@collection.memberships.user = @request.auth.id &&
     @collection.memberships.branch = branch &&
     @collection.memberships.active = true)
  )
`
```

**⚠️ CRITICAL LIMITATION:**

PocketBase API rules have limited expression depth. The above pattern may be **too complex** for PocketBase 0.40.4.

**Fallback Strategy:**

1. **API Rule:** Check membership existence only
   ```javascript
   @request.auth.id != "" && @collection.memberships.user = @request.auth.id
   ```

2. **Backend Hook:** Enforce role-based permissions
   ```javascript
   // In pb_hooks/tables.pb.js
   onBeforeList(e) {
     const userMemberships = getUserMemberships(e.request.auth.id);
     const allowedBranches = getMembershipBranches(userMemberships);
     e.query.andWhere('branch IN (:branches)', { branches: allowedBranches });
   }
   ```

**Why this is necessary:**
- PocketBase API rules cannot join multiple collections efficiently
- Complex role logic needs procedural code
- Performance: avoid N+1 queries in API rules

**⚠️ SECURITY IMPLICATIONS:**
- API rules are FIRST line of defense (block unauthorized requests)
- Backend hooks are SECOND line (enforce business logic)
- Frontend validation is NOT security (only UX)

---

## 6. PHASE 5 — MIGRATION STRATEGY

### Current State Analysis

**Database:** All collections have **0 records**

**Implication:** Migration is **ADDITIVE ONLY** — no data to migrate.

### Migration Phases

#### **Phase A: Create New Collections**
```
✅ Create branches collection
✅ Create memberships collection
✅ No data migration needed (empty database)
```

**Steps:**
1. Add `branches` schema to PocketBase
2. Add `memberships` schema to PocketBase
3. Verify collections created
4. Verify API rules applied

**Risk:** ⚠️ None (no existing data)

#### **Phase B: Add Branch Fields (Optional)**
```
➕ Add tables.branch (nullable)
➕ Add products.branch (nullable)
➕ Add customers.branch (nullable)
```

**Decision:** **SKIP in Checkpoint 4**

**Why:**
- Database is empty
- Can add `branch` field when creating tables/products/customers
- No need for nullable → required migration
- Cleaner to have `branch` required from start

**Recommendation:**
- Create new tables/products/customers with `branch` field (required)
- Remove `company` field entirely
- Simpler schema, no legacy fields

#### **Phase C: Seed Default Tenant (Checkpoint 7)**
```
1. Create company: "H2 Billiard"
2. Create branch: "Cơ sở 1"
3. Create development owner membership
4. Seed tables (5-7)
5. Seed products (10-15)
```

**Why deferred:**
- Need schema finalized first
- Seed data is development-only
- Can recreate easily if schema changes

#### **Phase D: Future — Remove Legacy Fields**
```
❌ Remove users.company (after M03)
❌ Remove tables.company (if added branch)
❌ Remove products.company (if added branch)
❌ Remove customers.company (if added branch)
```

**When:** Milestone 03 (Frontend Integration)

**Why not now:**
- AuthContext may depend on `users.company`
- Frontend may read `users.company`
- Need compatibility during transition

### Migration Timeline

```
Checkpoint 4 (Database Migration):
  ├── Create branches collection (schema only)
  ├── Create memberships collection (schema only)
  ├── Verify schema
  └── No data migration (0 records)

Checkpoint 7 (Seed Data):
  ├── Create H2 Billiard company
  ├── Create "Cơ sở 1" branch
  ├── Create development owner
  ├── Seed 5-7 tables (with branch field)
  └── Seed 10-15 products (with branch field)

Milestone 03 (Frontend Integration):
  ├── Update AuthContext to use memberships
  ├── Update pages to query by branch
  ├── Remove mock data
  ├── Test authentication flow
  └── Deprecate users.company field
```

---

## 7. PHASE 6 — API SECURITY DESIGN

### Security Principles

1. **Frontend is NOT a security boundary**
   - Frontend filtering is UX only
   - API rules MUST enforce access control
   - Backend hooks add additional validation

2. **Tenant isolation is MANDATORY**
   - User Branch A cannot access Branch B data
   - No data leakage between companies
   - Membership determines access scope

3. **Role-based access control**
   - Membership role determines permissions
   - Higher roles inherit lower role permissions
   - Owner > Manager > Cashier > Staff > Customer

### API Rules by Collection

#### **companies Collection**

**Current (INSECURE):**
```javascript
listRule: "@request.auth.id != \"\"",  // Any user can list ALL companies ❌
createRule: "@request.auth.id != \"\"", // Any user can create companies ❌
updateRule: "@request.auth.id != \"\"", // Any user can modify ANY company ❌
deleteRule: "@request.auth.id != \"\""  // Any user can delete ANY company ❌
```

**Proposed (SECURE):**
```javascript
// List: Only companies where user has membership
listRule: `
  @request.auth.id != "" && 
  @collection.memberships.user = @request.auth.id &&
  @collection.memberships.company = id
`,

// View: Same as list
viewRule: `
  @request.auth.id != "" && 
  @collection.memberships.user = @request.auth.id &&
  @collection.memberships.company = id
`,

// Create: Owner role only (via backend hook)
createRule: "@request.auth.id != \"\"",  // Basic auth, hook checks role

// Update: Owner role only
updateRule: `
  @request.auth.id != "" && 
  @collection.memberships.user = @request.auth.id &&
  @collection.memberships.company = id &&
  @collection.memberships.role = "owner"
`,

// Delete: Owner role only (prevent if branches exist)
deleteRule: `
  @request.auth.id != "" && 
  @collection.memberships.user = @request.auth.id &&
  @collection.memberships.company = id &&
  @collection.memberships.role = "owner"
`
```

#### **branches Collection**

```javascript
// List: Branches where user has membership (company-wide or branch-specific)
listRule: `
  @request.auth.id != "" && 
  @collection.memberships.user = @request.auth.id &&
  @collection.memberships.company = company &&
  @collection.memberships.active = true
`,

// View: Same as list
viewRule: `
  @request.auth.id != "" && 
  @collection.memberships.user = @request.auth.id &&
  @collection.memberships.company = company &&
  @collection.memberships.active = true
`,

// Create: Owner or Manager role only
createRule: `
  @request.auth.id != "" && 
  @collection.memberships.user = @request.auth.id &&
  @collection.memberships.company = @request.data.company &&
  (@collection.memberships.role = "owner" || @collection.memberships.role = "manager")
`,

// Update: Owner or assigned Manager
updateRule: `
  @request.auth.id != "" && 
  @collection.memberships.user = @request.auth.id &&
  @collection.memberships.company = company &&
  (
    @collection.memberships.role = "owner" || 
    (@collection.memberships.role = "manager" && @collection.memberships.branch = id)
  )
`,

// Delete: Owner only
deleteRule: `
  @request.auth.id != "" && 
  @collection.memberships.user = @request.auth.id &&
  @collection.memberships.company = company &&
  @collection.memberships.role = "owner"
`
```

#### **memberships Collection**

```javascript
// List: User's own memberships + owners can list their company's memberships
listRule: `
  @request.auth.id != "" && (
    user = @request.auth.id ||
    (@collection.memberships.user = @request.auth.id &&
     @collection.memberships.company = company &&
     @collection.memberships.role = "owner")
  )
`,

// View: Same as list
viewRule: `
  @request.auth.id != "" && (
    user = @request.auth.id ||
    (@collection.memberships.user = @request.auth.id &&
     @collection.memberships.company = company &&
     @collection.memberships.role = "owner")
  )
`,

// Create: Owner or Manager can create memberships
createRule: `
  @request.auth.id != "" && 
  @collection.memberships.user = @request.auth.id &&
  @collection.memberships.company = @request.data.company &&
  (@collection.memberships.role = "owner" || @collection.memberships.role = "manager")
`,

// Update: Only owners can change roles, users can deactivate their own
updateRule: `
  @request.auth.id != "" && (
    (user = @request.auth.id && @request.data.active = false) ||
    (@collection.memberships.user = @request.auth.id &&
     @collection.memberships.company = company &&
     @collection.memberships.role = "owner")
  )
`,

// Delete: Owner only
deleteRule: `
  @request.auth.id != "" && 
  @collection.memberships.user = @request.auth.id &&
  @collection.memberships.company = company &&
  @collection.memberships.role = "owner"
`
```

#### **tables Collection (Refactored)**

**Assumption:** `tables` will have `branch` field instead of `company`

```javascript
// List: User has membership to branch (or company-wide)
listRule: `
  @request.auth.id != "" && 
  @collection.memberships.user = @request.auth.id &&
  (
    (@collection.memberships.branch = branch && @collection.memberships.active = true) ||
    (@collection.memberships.branch = null && 
     @collection.memberships.company = @collection.branches.company && 
     @collection.memberships.active = true)
  )
`,

// Similar pattern for view/create/update/delete
```

**⚠️ COMPLEXITY WARNING:**

The above rules are **VERY COMPLEX** and may exceed PocketBase 0.40.4 expression limits.

**Alternative: Simplified API Rules + Backend Hooks**

```javascript
// Simplified Rule: Check membership existence only
listRule: `
  @request.auth.id != "" && 
  @collection.memberships.user = @request.auth.id &&
  @collection.memberships.active = true
`,

// Backend Hook: Filter by allowed branches
onBeforeList(e) {
  const userId = e.request.auth.id;
  const memberships = getMemberships(userId);
  const allowedBranches = getBranchesFromMemberships(memberships);
  e.query.andWhere('branch IN (:branches)', { branches: allowedBranches });
}
```

**Recommendation:**
- Start with simplified API rules (basic auth check)
- Add backend hooks for complex logic
- Test thoroughly
- Upgrade to complex rules if PocketBase supports

---

## 8. PHASE 7 — COMPATIBILITY ANALYSIS

### Existing Collections

| Collection | Current | Will Change | Migration Path |
|-----------|---------|-------------|----------------|
| users | company (TEXT) | Keep temporarily | Add via memberships, deprecate in M03 |
| companies | No changes | No changes | Keep as-is |
| tables | company (TEXT) | Add branch field | Refactor in Checkpoint 4 |
| products | company (TEXT) | Add branch field | Refactor in Checkpoint 4 |
| customers | company (TEXT) | Add branch field | Refactor in Checkpoint 4 |

### Field Migration Strategy

#### **users.company**

**Current:**
```typescript
users.company: string  // Direct company ID (TEXT)
```

**Status:** **Keep temporarily**

**Why:**
- AuthContext may read `user.company`
- Frontend may depend on this field
- Need smooth transition

**Deprecation plan:**
1. Add `memberships` collection (Checkpoint 4)
2. Frontend reads from `memberships` (Milestone 03)
3. Set `users.company = ''` for new users (M03)
4. Remove field entirely (Milestone 04+)

**Interim compatibility:**
```javascript
// In AuthContext (M03)
const companyId = user.company || getCompanyFromMemberships(user.id);
```

#### **tables.company → tables.branch**

**Current:**
```typescript
tables.company: string  // Weak reference to companies
```

**Target:**
```typescript
tables.branch: string  // Relation to branches
```

**Migration path (since database is empty):**

**Option A: Keep company, add branch (nullable)**
```typescript
tables {
  company: string   // Keep for compatibility
  branch?: string   // Add nullable
}
```
- Migration: Populate `branch` from `company`
- Later: Make `branch` required, remove `company`

**Option B: Replace company with branch (recommended)**
```typescript
tables {
  branch: string    // Required from start
}
```
- No migration needed (0 records)
- Cleaner schema
- No legacy fields

**Recommendation:** **Option B** — since database is empty, start clean.

#### **products.company → products.branch**

**Same strategy as tables:** Replace `company` with `branch` (required).

#### **customers.company → customers.branch**

**Same strategy as tables:** Replace `company` with `branch` (required).

### Frontend Compatibility Checklist

**Files that may depend on `users.company`:**

1. `src/contexts/AuthContext.tsx`
   - Reads `user.company`
   - Used for filtering queries
   - **Action:** Update in M03 to read from memberships

2. `src/api/services.ts`
   - `companyService`, `tableService`, etc.
   - May filter by `user.company`
   - **Action:** Update in M03 to filter by branch

3. `src/pages/account.tsx`
   - Displays `user.company` info
   - **Action:** Update in M03 to display membership info

**Files that query `tables/products/customers` by company:**

1. `src/pages/tables.tsx`
   - Currently uses MOCK_TABLES
   - Will query `tableService.list(companyId)`
   - **Action:** Change to `tableService.list({ branch: branchId })`

2. `src/pages/playing.tsx`
   - Currently uses MOCK_MENU
   - Will query `productService.list(companyId)`
   - **Action:** Change to `productService.list({ branch: branchId })`

**IMPORTANT:** All frontend changes deferred to **Milestone 03**.

---

## 9. RISKS & OPEN QUESTIONS

### Risks

#### 🔴 CRITICAL

**RISK-001: PocketBase API Rule Complexity**
- **Issue:** Complex membership checks may exceed rule expression limits
- **Probability:** High (PocketBase 0.40.4 has limited rule depth)
- **Impact:** Cannot enforce multi-tenant isolation at API level
- **Mitigation:**
  - Use simplified API rules + backend hooks
  - Test rule expressions before deploying
  - Document rule limitations

**RISK-002: Membership Invariant Not Enforceable at DB Level**
- **Issue:** `membership.branch.company = membership.company` requires application logic
- **Probability:** Certain (PocketBase limitation)
- **Impact:** Data corruption possible if hook bypassed
- **Mitigation:**
  - Backend hook validation (required)
  - Frontend validation (UX only)
  - Integration tests for invariant
  - Consider PostgreSQL triggers if migrating later

#### ⚠️ HIGH

**RISK-003: Composite Unique Index Support Unknown**
- **Issue:** `branches(company, code)` composite unique may not work
- **Probability:** Medium (PocketBase SQLite limitations)
- **Impact:** Duplicate branch codes per company
- **Mitigation:**
  - Test composite index in Checkpoint 4
  - Fallback to backend hook if unsupported
  - Document actual implementation

**RISK-004: Frontend Compatibility During Transition**
- **Issue:** AuthContext expects `users.company` field
- **Probability:** High (current implementation)
- **Impact:** Frontend breaks if field removed too early
- **Mitigation:**
  - Keep `users.company` until M03
  - Add compatibility layer in AuthContext
  - Gradual migration, not big bang

#### 🟡 MEDIUM

**RISK-005: Role Escalation via Membership Manipulation**
- **Issue:** User could change their own membership role
- **Probability:** Low (API rules prevent)
- **Impact:** Privilege escalation
- **Mitigation:**
  - API rule: only owner can change roles
  - Backend hook: validate role changes
  - Audit log for membership changes

### Open Questions

#### ❓ QUESTION-001: Branch Code Format

**Question:** Should `branches.code` have a specific format?

**Options:**
- A) Free text (e.g., "CS1", "HCM-01", "hanoi")
- B) Enforced pattern (e.g., "^[A-Z0-9-]{2,10}$")
- C) Auto-generated (e.g., "BR001", "BR002")

**Recommendation:** **Option A** (free text)
- Most flexible
- User-friendly
- Can add validation later if needed

**Decision:** Deferred to Checkpoint 3 review

#### ❓ QUESTION-002: Default Branch Creation

**Question:** Should PocketBase automatically create a default branch when a company is created?

**Options:**
- A) Yes, via backend hook `onAfterCreate`
- B) No, require explicit branch creation
- C) Yes, but only for first company (development seed)

**Recommendation:** **Option B** (explicit creation)
- Clearer intent
- Avoids magic behavior
- Seed script handles development case

**Decision:** Deferred to Checkpoint 3 review

#### ❓ QUESTION-003: Membership Approval Workflow

**Question:** Should new memberships require owner approval?

**Options:**
- A) Yes, new memberships start with `active = false`
- B) No, trusted invitations only (owner creates membership directly)
- C) Role-dependent (customer needs approval, staff doesn't)

**Recommendation:** **Option B** (trusted invitations)
- Simpler for MVP
- Owner controls invitations
- Can add approval workflow in M04+

**Decision:** Deferred to Checkpoint 3 review

#### ❓ QUESTION-004: Cascade Delete Behavior

**Question:** What happens when deleting company/branch/user with memberships?

**Scenarios:**

| Delete | Has | Behavior |
|--------|-----|----------|
| Company | Branches | ❌ Prevent OR ⚠️ Cascade (destructive) |
| Company | Memberships | ⚠️ Cascade delete memberships |
| Branch | Tables/Products | ❌ Prevent (cannot delete with data) |
| Branch | Memberships | ⚠️ Cascade delete memberships |
| User | Memberships | ✅ Cascade delete (safe, cleanup) |

**Recommendation:**
- Prevent company/branch deletion if data exists
- Soft-delete via `active = false` instead
- Hard delete only for empty entities

**Decision:** Implement in Checkpoint 4

---

## 10. NEXT CHECKPOINT

### CHECKPOINT 3 — MEMBERSHIP SCHEMA REVIEW

**Objectives:**
1. Review `branches` and `memberships` design with user
2. Finalize open questions (Q-001 to Q-004)
3. Confirm API security approach (simplified vs complex rules)
4. Decide on composite unique index fallback
5. Approve final schema before implementation

**Deliverables:**
- Finalized `branches` schema
- Finalized `memberships` schema
- Approved API rules strategy
- Resolved open questions
- Ready for Checkpoint 4 (Database Migration)

**What NOT to do in Checkpoint 3:**
- No database changes
- No collection creation
- No code changes
- Only design finalization and review

**After Checkpoint 3 approval:**
- Proceed to **Checkpoint 4 — Database Migration**
- Execute schema changes
- Create collections
- Apply API rules
- Verify with empty database

---

---

## CHECKPOINT 3 UPDATE — SCHEMA FINALIZED

**Date:** 2026-10-08  
**Status:** ✅ READY FOR CHECKPOINT 4

### Key Decisions Finalized

✅ **Composite Unique Indexes:** Verified supported in PocketBase 0.40.4  
✅ **Select Field Type:** Native enum validation confirmed  
✅ **Branch Nullability:** `branch = null` means company-wide scope  
✅ **Membership Invariant:** Backend hooks required (API rules cannot traverse relations)  
✅ **Security Model:** Simplified API rules + backend hooks pattern  
✅ **Role Model:** Five roles finalized (no "admin")  
✅ **users.company:** Keep temporarily for compatibility

### PocketBase 0.40.4 Verified Capabilities

| Feature | Status | Source |
|---------|--------|--------|
| Composite unique indexes | ✅ Supported | [GitHub #544](https://github.com/pocketbase/pocketbase/issues/544) |
| Select field enum | ✅ Native | [PocketBase Docs](https://pocketbase.io/jsvm/classes/SelectField.html) |
| Partial indexes (WHERE) | ✅ Supported | Verified |
| Nested relation in API rules | ❌ Not supported | Known limitation |

### Migration Readiness: ✅ READY

All design questions resolved. No blockers. Database is empty (0 records). Safe to proceed to Checkpoint 4.

**See full review:** [M02_CHECKPOINT3_REVIEW.md](M02_CHECKPOINT3_REVIEW.md)

---

**End of Branch Migration Plan**

**Status:** Design finalized, ready for database migration.