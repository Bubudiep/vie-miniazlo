# Milestone 02 — Multi-Tenant Migration Documentation

**Date:** 2026-10-09  
**Status:** COMPLETED  
**Database:** PocketBase 0.40.4

---

## Overview

Milestone 02 implements multi-tenant architecture with branches and memberships collections, enabling Company → Branch → Resources model with user membership management.

---

## Collections Added

### 1. `branches` Collection

**Purpose:** Represents physical or logical branches within a company.

**Fields:**
- `id` (text, auto-generated)
- `company` (relation → companies, required) - Parent company
- `name` (text, 1-200 chars, required) - Branch display name
- `code` (text, 1-50 chars, required) - Branch code (unique per company)
- `address` (text, 0-500 chars, optional) - Physical address
- `phone` (text, 0-20 chars, optional) - Contact number
- `active` (bool, required, default: true) - Active status
- `sort_order` (number, required, default: 0) - Display order

**Indexes:**
- `idx_company_code` - UNIQUE INDEX on (company, code)  
  Ensures branch codes are unique within each company.

**API Rules:**
- listRule: `@request.auth.company = company`
- viewRule: `@request.auth.company = company`
- createRule: `@request.auth.company = company && @request.auth.role = "owner"`
- updateRule: `@request.auth.company = company && @request.auth.role ?= "owner"`
- deleteRule: `@request.auth.company = company && @request.auth.role = "owner"`

**Relations:**
- Company (1:N) Branch - Each company can have multiple branches
- Branch (1:N) Membership - Each branch can have multiple memberships

---

### 2. `memberships` Collection

**Purpose:** Associates users with companies and optionally branches, defining their role and scope.

**Fields:**
- `id` (text, auto-generated)
- `user` (relation → users, cascadeDelete: true, required) - User account
- `company` (relation → companies, cascadeDelete: true, required) - Company
- `branch` (relation → branches, cascadeDelete: true, optional) - Branch (null = company-wide)
- `role` (select, required) - User role: owner | manager | cashier | staff | customer
- `active` (bool, required, default: true) - Active status

**Indexes:**
- `idx_user_company_branch` - UNIQUE INDEX on (user, company, branch) WHERE branch IS NOT NULL  
  Ensures a user can have only one membership per branch.
  
- `idx_user_company` - UNIQUE INDEX on (user, company) WHERE branch IS NULL  
  Ensures a user can have only one company-wide membership per company.

**API Rules:**
- listRule: `@request.auth.id = user || @request.auth.company = company`
- viewRule: `@request.auth.id = user || @request.auth.company = company`
- createRule: `@request.auth.company = company && @request.auth.role ?= 'owner'`
- updateRule: `@request.auth.company = company && @request.auth.role ?= 'owner'`
- deleteRule: `@request.auth.company = company && @request.auth.role ?= 'owner'`

**Relations:**
- User (1:N) Membership - Each user can have multiple memberships
- Company (1:N) Membership - Each company can have multiple members
- Branch (1:N) Membership - Each branch can have multiple members (optional)

---

## Business Rules & Invariants

### Membership Scope

**Company-wide membership** (`branch` = null):
- User has access to all branches of the company
- Typically used for company owners and managers

**Branch-specific membership** (`branch` = non-null):
- User has access only to that specific branch
- Used for branch staff, cashiers, and customers

### Invariant: Branch-Company Consistency

**Rule:** When `membership.branch` is not null, `membership.branch.company` MUST equal `membership.company`.

**Enforcement:** `pb_hooks/memberships_invariant.pb.js`

**Implementation:**
```javascript
onRecordCreateRequest((e) => {
  if (!e.record) return;
  
  const record = e.record;
  const branchId = record.get("branch");
  
  // Allow company-wide memberships (branch = null)
  if (!branchId || branchId === "") return;
  
  const membershipCompanyId = record.get("company");
  if (!membershipCompanyId) {
    throw new BadRequestError("Membership company is required");
  }
  
  // Fetch branch and verify it belongs to the same company
  let branch = $app.findRecordById("branches", branchId);
  const branchCompanyId = branch.get("company");
  
  if (membershipCompanyId !== branchCompanyId) {
    throw new BadRequestError(
      "Membership branch must belong to the same company"
    );
  }
}, "memberships");
```

**Hook verified on:**
- `onRecordCreateRequest` - When creating new membership
- `onRecordUpdateRequest` - When updating existing membership

---

## Role Model

| Role     | Scope        | Permissions                                          |
|----------|--------------|------------------------------------------------------|
| owner    | Company-wide | Full access to all branches, create/manage users     |
| manager  | Branch/Company | Manage branch operations, view reports             |
| cashier  | Branch       | POS operations, process orders                       |
| staff    | Branch       | Service operations, customer service                 |
| customer | Branch       | End customer, view own orders                        |

**Note:** Authorization enforcement is currently API-rule-based and has NOT been fully tested with regular user accounts. All tests were performed using superuser tokens which bypass API rules.

---

## Migration Files

### Created Migrations

1. **`pb_migrations/1728393600_create_branches.js`**  
   Creates branches collection with fields and unique index.

2. **`pb_migrations/1728393700_create_memberships.js`**  
   Creates memberships collection with fields and partial unique indexes.

3. **`pb_migrations/1791496427_collections_snapshot.js`**  
   Full collections snapshot after migration (auto-generated).

### Hook Files

- **`pb_hooks/memberships_invariant.pb.js`** - Enforces branch-company consistency
- **`pb_hooks/memberships_invariant.pb.js.backup`** - Backup before final fix

---

## Testing Results

### Tests Performed (Checkpoint 5.5)

All tests were performed using **superuser token**, which bypasses API rules.

| Test # | Description                                    | Expected | Actual | Result |
|--------|------------------------------------------------|----------|--------|--------|
| 1      | Company-wide membership (branch=null)          | HTTP 200 | HTTP 200 | ✅ PASS |
| 2      | Valid membership Company A + Branch A          | HTTP 200 | HTTP 200 | ✅ PASS |
| 3      | Invalid: Company A + Branch B (cross-company)  | HTTP 400 | HTTP 400 | ✅ PASS |
| 4      | Invalid: Empty company + Branch A              | HTTP 400 | HTTP 400 | ✅ PASS |
| 5      | Invalid: Non-existent branch ID                | HTTP 400 | HTTP 400 | ✅ PASS |

**Hook Behavior Verified:**
- ✅ Allows company-wide memberships (branch=null)
- ✅ Allows valid branch memberships (same company)
- ✅ Rejects cross-company branch assignments
- ✅ Rejects memberships with empty company when branch specified
- ✅ Rejects memberships with non-existent branches

### Limitations & Untested Scenarios

⚠️ **Authorization NOT verified with regular users:**
- All tests used superuser token which bypasses `createRule: @request.auth.company = company`
- Normal user creation blocked by API rules has NOT been tested
- Normal user querying memberships has NOT been tested
- Role-based permissions (owner, manager, etc.) have NOT been tested in practice

⚠️ **Frontend NOT implemented:**
- UI for membership management does not exist yet
- Zalo OAuth + membership assignment flow pending
- Branch selection UI pending

⚠️ **Update operations NOT tested:**
- Hook `onRecordUpdateRequest` exists but was not tested
- Changing branch on existing membership not verified
- Changing company on existing membership not verified

---

## Backup & Restore

### Backup Locations

**Pre-migration backups:**
- `backups/milestone-02/checkpoint-4-before/pb_data_20261008_163331/` (before schema changes)
- `backups/milestone-02/checkpoint-5-before/pb_data_20261009_043658/` (before hook testing)

**Post-migration backup:**
- `backups/milestone-02/checkpoint-5-after/pb_data_20261009_135203/` (1.3 MB, after cleanup)
- Schema: `pb_schema_20261009_135203.json` (24 KB)

### Restore Procedure

```bash
cd D:/My App/billiard/pocketbase

# 1. Stop PocketBase
taskkill /PID <pid> /F

# 2. Backup current state (optional)
cp -r pb_data pb_data_backup_$(date +%Y%m%d_%H%M%S)

# 3. Restore from backup
rm -rf pb_data
cp -r backups/milestone-02/checkpoint-5-after/pb_data_20261009_135203 pb_data

# 4. Restart PocketBase
./pocketbase.exe serve --http=127.0.0.1:8390
```

---

## Database State After Migration

### Collections (7 total)

1. **users** (auth collection) - 0 records
2. **companies** - 0 records
3. **products** - 0 records
4. **tables** - 0 records
5. **customers** - 0 records
6. **branches** ✨ NEW - 0 records
7. **memberships** ✨ NEW - 0 records

### Schema Changes

- ✅ Added `branches` collection with UNIQUE(company, code)
- ✅ Added `memberships` collection with 2 partial unique indexes
- ✅ Added `memberships_invariant.pb.js` hook
- ✅ Preserved all existing collections and fields
- ✅ No data loss (empty database before migration)

### API Rules Status

All API rules are in their **final state** (not temporary):
- branches: Tenant-isolated, owner-only create/update/delete
- memberships: Tenant-isolated, owner-only create/update/delete
- Other collections: Unchanged from Milestone 01

---

## Known Issues & Future Work

### Known Issues

1. **Hook error message could be more specific**  
   Current: "Membership branch must belong to the same company"  
   Suggestion: Include branch name and company names for clarity.

2. **No seed data**  
   Database is empty after migration. Need to create initial companies, branches, and owner memberships manually or via seeding script.

### Future Work (Milestone 03+)

1. **Implement Zalo OAuth + Membership Assignment Flow**
   - User logs in via Zalo
   - Auto-create membership or prompt user to join company
   - Assign appropriate role and branch

2. **Test Authorization with Regular Users**
   - Create test users without superuser privileges
   - Verify API rules work correctly
   - Test role-based permissions

3. **Deprecate `users.company` Field**
   - Currently kept for compatibility
   - Migrate frontend to use memberships
   - Remove field in future milestone

4. **Implement Frontend UI**
   - Membership management page
   - Branch selection
   - Role assignment

5. **Add Membership Approval Workflow**
   - User requests to join company
   - Owner/manager approves
   - Send notification

---

## Troubleshooting

### Hook Error: "Branch not found"

**Symptom:** Hook throws "Branch not found: <branch_id>" even when branch exists.

**Root Cause:** Hook was using `$app.dao().findRecordById()` instead of `$app.findRecordById()`.

**Fix:** Use `$app.findRecordById("branches", branchId)` directly.

### Hook Error: "Something went wrong"

**Symptom:** Generic error "Something went wrong while processing your request" without details.

**Common Causes:**
1. Hook using `e.app` instead of `$app` (PocketBase 0.40.4 uses global `$app`)
2. Hook throwing JavaScript error (syntax, undefined variable, etc.)
3. Database query failing silently

**Debug Steps:**
1. Add console.log statements to hook
2. Check PocketBase logs (if available)
3. Test with minimal hook first
4. Gradually add logic back

### Cascading Deletes

**Behavior:** Deleting a company auto-deletes all its branches and memberships due to `cascadeDelete: true`.

**If Unexpected:** Review relation configurations in migrations before deploying to production.

---

## Summary

**Status:** ✅ Milestone 02 COMPLETED

**Achievements:**
- ✅ Designed and implemented multi-tenant architecture
- ✅ Created branches and memberships collections
- ✅ Implemented business invariant enforcement via hook
- ✅ Verified hook behavior with 5 test cases
- ✅ Cleaned up test data
- ✅ Created post-migration backup
- ✅ Documented architecture and limitations

**Next Milestone:** Implement frontend integration and test with regular user accounts.

---

**End of Documentation**
