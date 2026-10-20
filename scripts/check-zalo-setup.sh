#!/bin/bash

# Zalo Login Setup Verification Script

echo "=========================================="
echo "Zalo Login Setup Checker"
echo "=========================================="
echo ""

ERRORS=0
WARNINGS=0

# Check 1: app-config.json has permissions
echo "[1/6] Checking app-config.json permissions..."
if grep -q '"permission"' vie-minizalo/app-config.json; then
  if grep -q 'scope.userInfo' vie-minizalo/app-config.json; then
    echo "  ✓ Permissions configured"
  else
    echo "  ✗ Missing scope.userInfo"
    ERRORS=$((ERRORS + 1))
  fi
else
  echo "  ✗ No permission block in app-config.json"
  ERRORS=$((ERRORS + 1))
fi
echo ""

# Check 2: PocketBase schema has zalo_id
echo "[2/6] Checking PocketBase schema..."
if grep -q '"name": "zalo_id"' pocketbase/pb_schema.json; then
  echo "  ✓ zalo_id field exists"
else
  echo "  ✗ zalo_id field missing in users collection"
  ERRORS=$((ERRORS + 1))
fi
echo ""

# Check 3: Zalo auth hook exists
echo "[3/6] Checking Zalo auth backend hook..."
if [ -f "pocketbase/pb_hooks/zalo_auth.pb.js" ]; then
  echo "  ✓ zalo_auth.pb.js exists"
else
  echo "  ✗ zalo_auth.pb.js missing"
  ERRORS=$((ERRORS + 1))
fi
echo ""

# Check 4: Frontend auth code updated
echo "[4/6] Checking frontend auth code..."
if grep -q 'authorize' vie-minizalo/src/api/zaloAuth.ts; then
  echo "  ✓ authorize() call added"
else
  echo "  ⚠ authorize() not found - may cause token issues"
  WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Check 5: PocketBase running
echo "[5/6] Checking if PocketBase is running..."
if curl -s http://127.0.0.1:8390/api/health > /dev/null 2>&1; then
  echo "  ✓ PocketBase is running on port 8390"
else
  echo "  ⚠ PocketBase not running or not accessible"
  WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Check 6: Companies collection exists
echo "[6/6] Checking companies collection..."
if grep -q '"name": "companies"' pocketbase/pb_schema.json; then
  echo "  ✓ Companies collection exists"
else
  echo "  ⚠ Companies collection missing - users won't see data without company"
  WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Summary
echo "=========================================="
echo "Summary"
echo "=========================================="
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo "✓ All checks passed! Ready to deploy."
  exit 0
elif [ $ERRORS -eq 0 ]; then
  echo "⚠ $WARNINGS warning(s) found. Review before deploy."
  exit 0
else
  echo "✗ $ERRORS error(s) and $WARNINGS warning(s) found."
  echo ""
  echo "Fix errors before deploying!"
  echo "See DEPLOY_CHECKLIST.md for details."
  exit 1
fi
