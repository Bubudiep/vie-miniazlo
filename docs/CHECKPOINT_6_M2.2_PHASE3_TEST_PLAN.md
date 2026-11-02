# CHECKPOINT 6 M2.2 PHASE 3: SECURITY TESTS - TEST PLAN

**Date**: 2026-10-11  
**Test Instance**: `pocketbase_test_v2` on port 9996  
**Hook Under Test**: `users_field_protection.pb.js`  
**Status**: ⏸️ **AWAITING APPROVAL**

---

## TEST OBJECTIVE

Verify that the JavaScript hook `users_field_protection.pb.js` correctly prevents regular users from modifying protected fields (`company`, `role`, `is_system_admin`) at runtime.

---

## HOOK BEHAVIOR (Expected)

**File**: `pb_hooks/users_field_protection.pb.js`  
**Event**: `onRecordUpdateRequest` for "users" collection  
**Logic**:
```javascript
// Allow if:
1. User is admin (role === "admin")
2. User is NOT updating themselves (authRecord.id !== record.id)

// Block if:
- Non-admin user attempts self-update with protected field changes
- Protected fields: ["company", "role", "is_system_admin"]
- Error: BadRequestError("Cannot modify protected field: {field}")
```

---

## TEST ENVIRONMENT SETUP

### Prerequisites
- ✅ Test instance running on port 9996
- ✅ Database schema includes protected fields
- ✅ Hook file present in `pb_hooks/`
- ⏸️ No test users created yet

### Test Users to Create

#### User 1: Admin (Superuser)
```
email: admin@test.local
password: Admin123!@#Test
is_system_admin: true
role: admin
company: (empty)
```

#### User 2: Regular User
```
username: testuser
email: user@test.local  
password: User123!@#Test
is_system_admin: false
role: staff
company: test_company_001
```

---

## TEST CASES

### Test A: Baseline - Regular User Can Update Allowed Fields ✅

**Purpose**: Verify hook doesn't block legitimate updates

**Request**:
```bash
curl -X PATCH "http://127.0.0.1:9996/api/collections/users/records/{user_id}" \
  -H "Authorization: Bearer {user_token}" \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Name", "email": "newemail@test.local"}'
```

**Expected Result**: HTTP 200, record updated

---

### Test B: Block User Self-Modifying `role` ❌

**Purpose**: Verify hook blocks `role` modification

**Request**:
```bash
curl -X PATCH "http://127.0.0.1:9996/api/collections/users/records/{user_id}" \
  -H "Authorization: Bearer {user_token}" \
  -H "Content-Type: application/json" \
  -d '{"role": "owner"}'
```

**Expected Result**: HTTP 400  
**Expected Error**: `{"message": "Cannot modify protected field: role", ...}`

---

### Test C: Block User Self-Modifying `is_system_admin` ❌

**Purpose**: Verify hook blocks privilege escalation

**Request**:
```bash
curl -X PATCH "http://127.0.0.1:9996/api/collections/users/records/{user_id}" \
  -H "Authorization: Bearer {user_token}" \
  -H "Content-Type: application/json" \
  -d '{"is_system_admin": true}'
```

**Expected Result**: HTTP 400  
**Expected Error**: `{"message": "Cannot modify protected field: is_system_admin", ...}`

---

### Test D: Block User Self-Modifying `company` ❌

**Purpose**: Verify hook blocks company switching

**Request**:
```bash
curl -X PATCH "http://127.0.0.1:9996/api/collections/users/records/{user_id}" \
  -H "Authorization: Bearer {user_token}" \
  -H "Content-Type: application/json" \
  -d '{"company": "different_company_002"}'
```

**Expected Result**: HTTP 400  
**Expected Error**: `{"message": "Cannot modify protected field: company", ...}`

---

### Test E: Block Multiple Protected Fields in One Request ❌

**Purpose**: Verify hook blocks batched attacks

**Request**:
```bash
curl -X PATCH "http://127.0.0.1:9996/api/collections/users/records/{user_id}" \
  -H "Authorization: Bearer {user_token}" \
  -H "Content-Type: application/json" \
  -d '{"role": "owner", "is_system_admin": true, "name": "Hacker"}'
```

**Expected Result**: HTTP 400  
**Expected Error**: First protected field detected (likely "role")

---

### Test F: Hook Loading Verification 🔍

**Purpose**: Confirm hooks are actually executing

**Method 1 - Check Custom Endpoint**:
```bash
curl -s "http://127.0.0.1:9996/api/custom/test"
```
**Expected**: 404 or custom response (confirms hooks loaded)

**Method 2 - Check Another Hook**:
```bash
# memberships_invariant.pb.js should enforce rules
curl -X POST "http://127.0.0.1:9996/api/collections/memberships/records" \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{"user": "{user_id}", "company": "{company_id}", "role": "staff"}'
```
**Expected**: Hook-enforced validation

**Method 3 - Startup Logs**:
```bash
grep -i "hook" pb_test.log
```
**Expected**: Hook registration messages (if available)

---

## EXECUTION WORKFLOW

### Step 1: Create Admin User
```bash
cd /d/My\ App/billiard/pocketbase_test_v2
./pocketbase.exe superuser upsert admin@test.local Admin123!@#Test
```

### Step 2: Get Admin Token
```bash
curl -X POST "http://127.0.0.1:9996/api/collections/_superusers/auth-with-password" \
  -H "Content-Type: application/json" \
  -d '{"identity": "admin@test.local", "password": "Admin123!@#Test"}' \
  | jq -r '.token'
```

### Step 3: Create Regular User
```bash
curl -X POST "http://127.0.0.1:9996/api/collections/users/records" \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "user@test.local",
    "password": "User123!@#Test",
    "passwordConfirm": "User123!@#Test",
    "is_system_admin": false,
    "role": "staff",
    "company": "test_company_001"
  }'
```

### Step 4: Get User Token
```bash
curl -X POST "http://127.0.0.1:9996/api/collections/users/auth-with-password" \
  -H "Content-Type: application/json" \
  -d '{"identity": "user@test.local", "password": "User123!@#Test"}' \
  | jq -r '.token'
```

### Step 5: Execute Tests A-F
- Run each test case
- Document HTTP status codes
- Capture error messages
- Verify expected behavior

### Step 6: Document Results
- Create `CHECKPOINT_6_M2.2_PHASE3_RESULTS.md`
- Include all test outputs
- Mark PASS/FAIL for each test
- Overall assessment

---

## SUCCESS CRITERIA

**Phase 3 PASSES if**:
- ✅ Test A: User can update allowed fields (200 OK)
- ✅ Test B: Role modification blocked (400 Bad Request)
- ✅ Test C: is_system_admin modification blocked (400 Bad Request)
- ✅ Test D: Company modification blocked (400 Bad Request)
- ✅ Test E: Multiple protected fields blocked (400 Bad Request)
- ✅ Test F: Hook loading confirmed (any evidence)

**Phase 3 FAILS if**:
- ❌ Any protected field can be modified by regular user
- ❌ Hook not executing (no blocking behavior)
- ❌ Error messages don't match expected format
- ❌ Admin users blocked from legitimate actions

---

## RISK MITIGATION

### If Hooks Not Loading
**Symptom**: All tests allow protected field updates  
**Diagnosis**: Check PocketBase logs for hook errors  
**Solution**: Verify hook syntax, check PocketBase version compatibility

### If Wrong Error Messages
**Symptom**: Tests block correctly but wrong error text  
**Diagnosis**: Hook is working but error format differs  
**Action**: Document actual error format, verify protection still works

### If Test Environment Corrupted
**Symptom**: Unexpected API errors, database issues  
**Action**: Stop instance, delete `pb_data/`, restart from Phase 2

---

## PRODUCTION SAFETY

**Isolation Verified**:
- ✅ Test port 9996 (production on 8390)
- ✅ Separate database (`pocketbase_test_v2/pb_data/`)
- ✅ Separate process (PID 10256)
- ✅ No shared data with production

**No Production Impact**:
- Tests run against isolated instance only
- No production database queries
- No production user modifications
- No production API calls

---

## NEXT STEPS AFTER PHASE 3

### If Tests PASS ✅
1. Stop test instance
2. Cleanup test directory (optional - can keep for audit)
3. Proceed to M2.3 Deployment
4. Document production deployment plan

### If Tests FAIL ❌
1. Document failure details
2. Analyze root cause
3. Options:
   - Fix hook code and retry
   - Modify migration to disable API Rules
   - Escalate to user for decision
4. Do NOT proceed to production deployment

---

**Test Plan Status**: ✅ **READY**  
**Awaiting**: User approval to execute Phase 3  
**Estimated Duration**: 15-20 minutes
