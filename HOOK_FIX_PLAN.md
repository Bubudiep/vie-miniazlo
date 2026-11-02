# User Field Protection Hook - Fix Plan

## Bug Identified

**File:** `pb_hooks/users_field_protection.pb.js`

**Lines 33-35 (CRITICAL BUG):**
```javascript
if (!isSelfUpdate) {
  return  // BUG: Allows User A to modify User B's protected fields
}
```

**Impact:** 
- The backwards logic causes the protection check (lines 37-46) to ONLY run for self-updates
- Cross-user updates bypass the protection entirely
- User A can modify User B's `company`, `role`, and `is_system_admin` fields

## Root Cause

The `if (!isSelfUpdate) return` statement creates opposite behavior:
- When `isSelfUpdate = false` (User A editing User B) → **returns early, skips protection**
- When `isSelfUpdate = true` (User editing themselves) → **continues to protection check**

This is the inverse of the intended security model.

## Minimal Fix

Replace lines 29-35 with proper authorization logic:

```javascript
const isAdmin = authRecord.get("role") === "admin"
const isSelfUpdate = authRecord.id === e.record.id

// Allow admins to modify other users' protected fields
if (isAdmin && !isSelfUpdate) {
  return
}

// Block cross-user updates by non-admins
if (!isSelfUpdate) {
  throw new ForbiddenError("Cannot modify other users")
}

// Protection check runs for all self-updates (including admins)
```

## Security Model After Fix

1. **Superusers** (`_superusers` collection) → bypass all checks
2. **Admins modifying others** → allowed (for user management)
3. **Admins self-updating** → blocked from changing protected fields
4. **Regular users self-updating** → blocked from changing protected fields
5. **Regular users cross-updating** → blocked entirely

## Test Plan - 7 Test Cases

### Test Environment Setup
- Instance: `pocketbase_test_v2` on port 9996
- Need: 2 test users (user1, user2) with known IDs and auth tokens
- Need: 1 test admin with auth token

### TC1: User updates own normal field (SHOULD SUCCEED)
```bash
# User updates their own email or username
PATCH /api/collections/users/records/{user1_id}
Authorization: Bearer {user1_token}
Body: {"email": "newemail@test.com"}

Expected: 200 OK
```

### TC2: User self-modifies role field (SHOULD FAIL)
```bash
PATCH /api/collections/users/records/{user1_id}
Authorization: Bearer {user1_token}
Body: {"role": "admin"}

Expected: 400 Bad Request
Error: "Cannot modify protected field: role"
```

### TC3: User self-modifies company field (SHOULD FAIL)
```bash
PATCH /api/collections/users/records/{user1_id}
Authorization: Bearer {user1_token}
Body: {"company": "other_company_id"}

Expected: 400 Bad Request
Error: "Cannot modify protected field: company"
```

### TC4: User A modifies User B's sensitive field (SHOULD FAIL)
```bash
PATCH /api/collections/users/records/{user2_id}
Authorization: Bearer {user1_token}
Body: {"role": "admin"}

Expected: 403 Forbidden
Error: "Cannot modify other users"
```

### TC5: User A modifies User B's normal field (SHOULD FAIL)
```bash
# Even normal fields should be blocked by cross-user check
PATCH /api/collections/users/records/{user2_id}
Authorization: Bearer {user1_token}
Body: {"email": "hacked@test.com"}

Expected: 403 Forbidden or 404 Not Found (depending on API rules)
```

### TC6: Admin modifies other user's role (SHOULD SUCCEED)
```bash
PATCH /api/collections/users/records/{user1_id}
Authorization: Bearer {admin_token}
Body: {"role": "manager"}

Expected: 200 OK
```

### TC7: Admin self-modifies own role (SHOULD FAIL)
```bash
PATCH /api/collections/users/records/{admin_id}
Authorization: Bearer {admin_token}
Body: {"role": "owner"}

Expected: 400 Bad Request
Error: "Cannot modify protected field: role"
```

## Additional Verification

### Check: is_system_admin field
- Field does NOT exist in actual schema
- Hook references it but won't cause runtime error
- Should be removed from protectedFields array if confirmed unused

### Check: API Rules
From `pb_schema.json`:
- Users updateRule: `id = @request.auth.id || @request.auth.role = "admin"`
- This allows admins to update any user (relies on role field)
- Hook provides additional server-side validation

### Security Note: Role Field Trust
- Current admin bypass relies on `authRecord.get("role") === "admin"`
- This field is protected by THIS hook once fixed
- Before fix: role field may have been compromised
- After fix deployment: role field becomes trustworthy
- If role field is found compromised: remove admin bypass, only trust superusers

## Deployment Steps

1. ✅ Verify test instance has matching schema
2. ✅ Deploy fix to test instance
3. ⏳ Start test instance on port 9996
4. ⏳ Create test users and obtain auth tokens
5. ⏳ Execute 7 test cases
6. ⏳ Verify all expected behaviors
7. ⏳ Review production user roles for anomalies
8. ⏳ Deploy to production (requires user approval)
9. ⏳ Monitor production logs after deployment

## Files Changed

- `pocketbase_test_v2/pb_hooks/users_field_protection.pb.js` (✅ FIXED)
- `pocketbase/pb_hooks/users_field_protection.pb.js` (⏳ PENDING VERIFICATION)
