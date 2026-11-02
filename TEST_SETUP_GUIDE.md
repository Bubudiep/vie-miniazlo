# Test Setup Guide - User Field Protection Hook

## Current Status

✅ Test instance running on http://127.0.0.1:9996
✅ Fixed hook deployed to `pocketbase_test_v2/pb_hooks/users_field_protection.pb.js`
⚠️ No test users exist yet

## Manual Setup Required

### Step 1: Create Test Users via Admin UI

Open: http://127.0.0.1:9996/_/

Create 3 users:

**User 1 (Regular User):**
- Email: `testuser1@local.test`
- Username: `testuser1`
- Password: `Test1234!`
- Role: (leave empty or set to default)
- Company: (leave empty)

**User 2 (Regular User):**
- Email: `testuser2@local.test`
- Username: `testuser2`
- Password: `Test1234!`
- Role: (leave empty or set to default)
- Company: (leave empty)

**Admin User:**
- Email: `testadmin@local.test`
- Username: `testadmin`
- Password: `Admin1234!`
- Role: `admin`
- Company: (any test company ID or empty)

### Step 2: Obtain Auth Tokens

After creating users, authenticate each one:

```bash
# User 1 token
curl -X POST 'http://127.0.0.1:9996/api/collections/users/auth-with-password' \
  -H 'Content-Type: application/json' \
  -d '{"identity":"testuser1@local.test","password":"Test1234!"}'

# User 2 token
curl -X POST 'http://127.0.0.1:9996/api/collections/users/auth-with-password' \
  -H 'Content-Type: application/json' \
  -d '{"identity":"testuser2@local.test","password":"Test1234!"}'

# Admin token
curl -X POST 'http://127.0.0.1:9996/api/collections/users/auth-with-password' \
  -H 'Content-Type: application/json' \
  -d '{"identity":"testadmin@local.test","password":"Admin1234!"}'
```

Save the tokens and user IDs from responses.

### Step 3: Run Test Cases

Replace placeholders with actual values:
- `{user1_id}` - User 1's record ID
- `{user1_token}` - User 1's auth token
- `{user2_id}` - User 2's record ID
- `{admin_id}` - Admin's record ID
- `{admin_token}` - Admin's auth token

#### TC1: User updates own normal field (SHOULD SUCCEED)
```bash
curl -X PATCH 'http://127.0.0.1:9996/api/collections/users/records/{user1_id}' \
  -H 'Authorization: Bearer {user1_token}' \
  -H 'Content-Type: application/json' \
  -d '{"username":"testuser1_modified"}'
```

#### TC2: User self-modifies role field (SHOULD FAIL - 400)
```bash
curl -X PATCH 'http://127.0.0.1:9996/api/collections/users/records/{user1_id}' \
  -H 'Authorization: Bearer {user1_token}' \
  -H 'Content-Type: application/json' \
  -d '{"role":"admin"}'
```

#### TC3: User self-modifies company field (SHOULD FAIL - 400)
```bash
curl -X PATCH 'http://127.0.0.1:9996/api/collections/users/records/{user1_id}' \
  -H 'Authorization: Bearer {user1_token}' \
  -H 'Content-Type: application/json' \
  -d '{"company":"fake_company_id"}'
```

#### TC4: User A modifies User B's role (SHOULD FAIL - 403)
```bash
curl -X PATCH 'http://127.0.0.1:9996/api/collections/users/records/{user2_id}' \
  -H 'Authorization: Bearer {user1_token}' \
  -H 'Content-Type: application/json' \
  -d '{"role":"admin"}'
```

#### TC5: User A modifies User B's email (SHOULD FAIL - 403 or 404)
```bash
curl -X PATCH 'http://127.0.0.1:9996/api/collections/users/records/{user2_id}' \
  -H 'Authorization: Bearer {user1_token}' \
  -H 'Content-Type: application/json' \
  -d '{"email":"hacked@test.com"}'
```

#### TC6: Admin modifies other user's role (SHOULD SUCCEED - 200)
```bash
curl -X PATCH 'http://127.0.0.1:9996/api/collections/users/records/{user1_id}' \
  -H 'Authorization: Bearer {admin_token}' \
  -H 'Content-Type: application/json' \
  -d '{"role":"manager"}'
```

#### TC7: Admin self-modifies own role (SHOULD FAIL - 400)
```bash
curl -X PATCH 'http://127.0.0.1:9996/api/collections/users/records/{admin_id}' \
  -H 'Authorization: Bearer {admin_token}' \
  -H 'Content-Type: application/json' \
  -d '{"role":"owner"}'
```

## Expected Results Summary

| Test Case | Expected Status | Expected Error Message |
|-----------|----------------|------------------------|
| TC1 | 200 OK | - |
| TC2 | 400 Bad Request | "Cannot modify protected field: role" |
| TC3 | 400 Bad Request | "Cannot modify protected field: company" |
| TC4 | 403 Forbidden | "Cannot modify other users" |
| TC5 | 403/404 | "Cannot modify other users" or not found |
| TC6 | 200 OK | - |
| TC7 | 400 Bad Request | "Cannot modify protected field: role" |

## Next Steps After Verification

1. Document actual test results in this file
2. If all tests pass → prepare production deployment
3. If any test fails → analyze and adjust fix
4. Check production users for role field anomalies before deploying
