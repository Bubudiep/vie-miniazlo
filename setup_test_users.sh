#!/bin/bash

# Simplified: Create test users without company requirement
# Users collection allows public registration

BASE_URL="http://127.0.0.1:9996"

echo "=== Creating Test Users (No Company Required) ==="
echo ""

# Create User 1 (Regular)
echo "Step 1: Creating testuser1..."
USER1_RESP=$(curl -s -X POST "${BASE_URL}/api/collections/users/records" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser1@test.local",
    "password": "Test1234!",
    "passwordConfirm": "Test1234!",
    "username": "testuser1"
  }')

USER1_ID=$(echo "$USER1_RESP" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$USER1_ID" ]; then
  echo "❌ Failed to create testuser1. Response:"
  echo "$USER1_RESP"
  echo ""
else
  echo "✅ testuser1 created: $USER1_ID"
  echo ""
fi

# Create User 2 (Regular)
echo "Step 2: Creating testuser2..."
USER2_RESP=$(curl -s -X POST "${BASE_URL}/api/collections/users/records" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser2@test.local",
    "password": "Test1234!",
    "passwordConfirm": "Test1234!",
    "username": "testuser2"
  }')

USER2_ID=$(echo "$USER2_RESP" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$USER2_ID" ]; then
  echo "❌ Failed to create testuser2. Response:"
  echo "$USER2_RESP"
  echo ""
else
  echo "✅ testuser2 created: $USER2_ID"
  echo ""
fi

# Create Admin User (will set role via admin UI)
echo "Step 3: Creating testadmin..."
ADMIN_RESP=$(curl -s -X POST "${BASE_URL}/api/collections/users/records" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testadmin@test.local",
    "password": "Admin1234!",
    "passwordConfirm": "Admin1234!",
    "username": "testadmin"
  }')

ADMIN_ID=$(echo "$ADMIN_RESP" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$ADMIN_ID" ]; then
  echo "❌ Failed to create testadmin. Response:"
  echo "$ADMIN_RESP"
  echo ""
else
  echo "✅ testadmin created: $ADMIN_ID"
  echo ""
fi

# Check if any user was created
if [ -z "$USER1_ID" ] && [ -z "$USER2_ID" ] && [ -z "$ADMIN_ID" ]; then
  echo "========================================="
  echo "❌ No users created - registration may be disabled"
  echo ""
  echo "Please create users via Admin UI:"
  echo "  ${BASE_URL}/_/"
  echo "========================================="
  exit 1
fi

# Authenticate users to get tokens
echo "Step 4: Authenticating users..."
echo ""

if [ -n "$USER1_ID" ]; then
  echo "→ Authenticating testuser1..."
  USER1_AUTH=$(curl -s -X POST "${BASE_URL}/api/collections/users/auth-with-password" \
    -H "Content-Type: application/json" \
    -d '{"identity":"testuser1@test.local","password":"Test1234!"}')

  USER1_TOKEN=$(echo "$USER1_AUTH" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

  if [ -n "$USER1_TOKEN" ]; then
    echo "✅ testuser1 token obtained"
  else
    echo "⚠️  Could not authenticate testuser1"
  fi
  echo ""
fi

if [ -n "$USER2_ID" ]; then
  echo "→ Authenticating testuser2..."
  USER2_AUTH=$(curl -s -X POST "${BASE_URL}/api/collections/users/auth-with-password" \
    -H "Content-Type: application/json" \
    -d '{"identity":"testuser2@test.local","password":"Test1234!"}')

  USER2_TOKEN=$(echo "$USER2_AUTH" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

  if [ -n "$USER2_TOKEN" ]; then
    echo "✅ testuser2 token obtained"
  else
    echo "⚠️  Could not authenticate testuser2"
  fi
  echo ""
fi

if [ -n "$ADMIN_ID" ]; then
  echo "→ Authenticating testadmin..."
  ADMIN_AUTH=$(curl -s -X POST "${BASE_URL}/api/collections/users/auth-with-password" \
    -H "Content-Type: application/json" \
    -d '{"identity":"testadmin@test.local","password":"Admin1234!"}')

  ADMIN_TOKEN=$(echo "$ADMIN_AUTH" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

  if [ -n "$ADMIN_TOKEN" ]; then
    echo "✅ testadmin token obtained"
  else
    echo "⚠️  Could not authenticate testadmin"
  fi
  echo ""
fi

# Save credentials to file
cat > test_credentials.sh <<EOF
#!/bin/bash
# Auto-generated test credentials

export BASE_URL="$BASE_URL"
export USER1_ID="$USER1_ID"
export USER1_TOKEN="$USER1_TOKEN"
export USER2_ID="$USER2_ID"
export USER2_TOKEN="$USER2_TOKEN"
export ADMIN_ID="$ADMIN_ID"
export ADMIN_TOKEN="$ADMIN_TOKEN"

echo "✅ Test credentials loaded"
EOF

chmod +x test_credentials.sh

echo "========================================="
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Open Admin UI: ${BASE_URL}/_/"
echo "2. Set testadmin role to 'admin' (ID: $ADMIN_ID)"
echo "3. Run: source test_credentials.sh"
echo "4. Run: ./run_hook_tests.sh"
echo "========================================="
