#!/bin/bash

# Run all 7 test cases for hook verification
# Must source test_credentials.sh first

if [ -z "$USER1_ID" ]; then
  echo "❌ Test credentials not loaded"
  echo "Run: source test_credentials.sh"
  exit 1
fi

echo "========================================="
echo "Hook Verification - 7 Test Cases"
echo "========================================="
echo ""
echo "Test Environment: $BASE_URL"
echo "User1: $USER1_ID"
echo "User2: $USER2_ID"
echo "Admin: $ADMIN_ID"
echo ""

PASSED=0
FAILED=0

# Helper function to test API call
test_case() {
  local tc_num="$1"
  local description="$2"
  local expected_status="$3"
  local method="$4"
  local url="$5"
  local token="$6"
  local body="$7"
  local expected_error="$8"

  echo "----------------------------------------"
  echo "TC${tc_num}: ${description}"
  echo "Expected: ${expected_status}"
  echo ""

  RESPONSE=$(curl -s -w "\n%{http_code}" -X "$method" "$url" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -d "$body")

  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | head -n -1)

  echo "Actual: $HTTP_CODE"
  echo "Response: $BODY"

  # Check status code
  if echo "$expected_status" | grep -q "$HTTP_CODE"; then
    # Check error message if specified
    if [ -n "$expected_error" ]; then
      if echo "$BODY" | grep -q "$expected_error"; then
        echo "✅ PASSED"
        PASSED=$((PASSED + 1))
      else
        echo "⚠️  PARTIAL - Status OK but error message differs"
        echo "   Expected message: $expected_error"
        FAILED=$((FAILED + 1))
      fi
    else
      echo "✅ PASSED"
      PASSED=$((PASSED + 1))
    fi
  else
    echo "❌ FAILED"
    FAILED=$((FAILED + 1))
  fi
  echo ""
}

# TC1: User updates own normal field (SHOULD SUCCEED)
test_case "1" \
  "User updates own normal field" \
  "200" \
  "PATCH" \
  "${BASE_URL}/api/collections/users/records/${USER1_ID}" \
  "$USER1_TOKEN" \
  '{"username":"testuser1_modified"}' \
  ""

# TC2: User self-modifies role field (SHOULD FAIL - 400)
test_case "2" \
  "User self-modifies role field" \
  "400" \
  "PATCH" \
  "${BASE_URL}/api/collections/users/records/${USER1_ID}" \
  "$USER1_TOKEN" \
  '{"role":"admin"}' \
  "Cannot modify protected field: role"

# TC3: User self-modifies company field (SHOULD FAIL - 400)
test_case "3" \
  "User self-modifies company field" \
  "400" \
  "PATCH" \
  "${BASE_URL}/api/collections/users/records/${USER1_ID}" \
  "$USER1_TOKEN" \
  '{"company":"fake_company_id"}' \
  "Cannot modify protected field: company"

# TC4: User A modifies User B's role (SHOULD FAIL - 403)
test_case "4" \
  "User A modifies User B's role" \
  "403|404" \
  "PATCH" \
  "${BASE_URL}/api/collections/users/records/${USER2_ID}" \
  "$USER1_TOKEN" \
  '{"role":"admin"}' \
  "Cannot modify other users"

# TC5: User A modifies User B's email (SHOULD FAIL - 403 or 404)
test_case "5" \
  "User A modifies User B's email" \
  "403|404" \
  "PATCH" \
  "${BASE_URL}/api/collections/users/records/${USER2_ID}" \
  "$USER1_TOKEN" \
  '{"email":"hacked@test.com"}' \
  ""

# TC6: Admin modifies other user's role (SHOULD SUCCEED - 200)
test_case "6" \
  "Admin modifies other user's role" \
  "200" \
  "PATCH" \
  "${BASE_URL}/api/collections/users/records/${USER1_ID}" \
  "$ADMIN_TOKEN" \
  '{"role":"manager"}' \
  ""

# TC7: Admin self-modifies own role (SHOULD FAIL - 400)
test_case "7" \
  "Admin self-modifies own role" \
  "400" \
  "PATCH" \
  "${BASE_URL}/api/collections/users/records/${ADMIN_ID}" \
  "$ADMIN_TOKEN" \
  '{"role":"owner"}' \
  "Cannot modify protected field: role"

# Summary
echo "========================================="
echo "Test Results Summary"
echo "========================================="
echo "PASSED: $PASSED / 7"
echo "FAILED: $FAILED / 7"
echo ""

if [ $FAILED -eq 0 ]; then
  echo "✅ All tests passed! Hook is working correctly."
  echo ""
  echo "Next step: Deploy to production"
else
  echo "❌ Some tests failed. Review and fix before deployment."
fi

echo "========================================="
