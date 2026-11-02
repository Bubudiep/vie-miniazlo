#!/bin/bash

# PocketBase Auto Setup Script
# Creates admin account and all collections via API

BASE_URL="http://127.0.0.1:8390"
ADMIN_EMAIL="admin@ccc.com"
ADMIN_PASSWORD="Hoanghai12!"

echo "=== Creating Admin Account ==="
curl -X POST "$BASE_URL/api/admins" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$ADMIN_EMAIL\",
    \"password\": \"$ADMIN_PASSWORD\",
    \"passwordConfirm\": \"$ADMIN_PASSWORD\"
  }" 2>&1 | head -20

echo -e "\n\n=== Admin Login ==="
ADMIN_TOKEN=$(curl -s -X POST "$BASE_URL/api/admins/auth-with-password" \
  -H "Content-Type: application/json" \
  -d "{
    \"identity\": \"$ADMIN_EMAIL\",
    \"password\": \"$ADMIN_PASSWORD\"
  }" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$ADMIN_TOKEN" ]; then
  echo "Failed to get admin token"
  exit 1
fi

echo "Admin token obtained successfully"

echo -e "\n=== Creating Collections ==="

# Helper function to create collection
create_collection() {
  local name=$1
  local type=$2
  local schema=$3

  echo "Creating collection: $name"
  curl -s -X POST "$BASE_URL/api/collections" \
    -H "Authorization: $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"name\": \"$name\",
      \"type\": \"$type\",
      \"schema\": $schema
    }" | head -10
  echo ""
}

# 1. Companies
create_collection "companies" "base" '[
  {"name":"name","type":"text","required":true,"options":{"max":255}},
  {"name":"business_code","type":"text","options":{"max":50}},
  {"name":"service_type","type":"select","options":{"values":["retail","restaurant","wholesale","service","other"]}},
  {"name":"contact_name","type":"text","options":{"max":150}},
  {"name":"contact_email","type":"email"},
  {"name":"contact_phone","type":"text","options":{"max":20}},
  {"name":"address","type":"text","options":{"max":255}}
]'

sleep 1

# Get companies collection ID
COMPANIES_ID=$(curl -s "$BASE_URL/api/collections/companies" -H "Authorization: $ADMIN_TOKEN" | grep -o '"id":"[^"]*' | cut -d'"' -f4)

# 2. Roles
create_collection "roles" "base" "[
  {\"name\":\"company\",\"type\":\"relation\",\"required\":true,\"options\":{\"collectionId\":\"$COMPANIES_ID\",\"cascadeDelete\":true}},
  {\"name\":\"name\",\"type\":\"text\",\"required\":true,\"options\":{\"max\":100}},
  {\"name\":\"display_name\",\"type\":\"text\",\"options\":{\"max\":100}}
]"

sleep 1

# 3. Departments
create_collection "departments" "base" "[
  {\"name\":\"company\",\"type\":\"relation\",\"required\":true,\"options\":{\"collectionId\":\"$COMPANIES_ID\",\"cascadeDelete\":true}},
  {\"name\":\"name\",\"type\":\"text\",\"required\":true,\"options\":{\"max\":150}},
  {\"name\":\"parent\",\"type\":\"relation\",\"options\":{\"collectionId\":\"\",\"maxSelect\":1}},
  {\"name\":\"head\",\"type\":\"relation\",\"options\":{\"collectionId\":\"\",\"maxSelect\":1}}
]"

sleep 1

# 4. Positions
create_collection "positions" "base" "[
  {\"name\":\"company\",\"type\":\"relation\",\"required\":true,\"options\":{\"collectionId\":\"$COMPANIES_ID\",\"cascadeDelete\":true}},
  {\"name\":\"name\",\"type\":\"text\",\"required\":true,\"options\":{\"max\":150}},
  {\"name\":\"level\",\"type\":\"number\",\"required\":true}
]"

sleep 1

# Get roles, departments, positions IDs
ROLES_ID=$(curl -s "$BASE_URL/api/collections/roles" -H "Authorization: $ADMIN_TOKEN" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
DEPARTMENTS_ID=$(curl -s "$BASE_URL/api/collections/departments" -H "Authorization: $ADMIN_TOKEN" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
POSITIONS_ID=$(curl -s "$BASE_URL/api/collections/positions" -H "Authorization: $ADMIN_TOKEN" | grep -o '"id":"[^"]*' | cut -d'"' -f4)

# 5. Users (Auth collection)
create_collection "users" "auth" "[
  {\"name\":\"company\",\"type\":\"relation\",\"options\":{\"collectionId\":\"$COMPANIES_ID\",\"maxSelect\":1}},
  {\"name\":\"role\",\"type\":\"relation\",\"options\":{\"collectionId\":\"$ROLES_ID\",\"maxSelect\":1}},
  {\"name\":\"department\",\"type\":\"relation\",\"options\":{\"collectionId\":\"$DEPARTMENTS_ID\",\"maxSelect\":1}},
  {\"name\":\"position\",\"type\":\"relation\",\"options\":{\"collectionId\":\"$POSITIONS_ID\",\"maxSelect\":1}},
  {\"name\":\"must_change_password\",\"type\":\"bool\",\"required\":true}
]"

sleep 1

USERS_ID=$(curl -s "$BASE_URL/api/collections/users" -H "Authorization: $ADMIN_TOKEN" | grep -o '"id":"[^"]*' | cut -d'"' -f4)

# Update departments to reference users
echo "Updating departments collection..."
curl -s -X PATCH "$BASE_URL/api/collections/$DEPARTMENTS_ID" \
  -H "Authorization: $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"schema\": [
      {\"name\":\"company\",\"type\":\"relation\",\"required\":true,\"options\":{\"collectionId\":\"$COMPANIES_ID\",\"cascadeDelete\":true}},
      {\"name\":\"name\",\"type\":\"text\",\"required\":true,\"options\":{\"max\":150}},
      {\"name\":\"parent\",\"type\":\"relation\",\"options\":{\"collectionId\":\"$DEPARTMENTS_ID\",\"maxSelect\":1}},
      {\"name\":\"head\",\"type\":\"relation\",\"options\":{\"collectionId\":\"$USERS_ID\",\"maxSelect\":1}}
    ]
  }" | head -10

# 6. Profiles
create_collection "profiles" "base" "[
  {\"name\":\"user\",\"type\":\"relation\",\"required\":true,\"options\":{\"collectionId\":\"$USERS_ID\",\"cascadeDelete\":true,\"maxSelect\":1}},
  {\"name\":\"display_name\",\"type\":\"text\",\"options\":{\"max\":150}},
  {\"name\":\"facebook_url\",\"type\":\"url\"},
  {\"name\":\"phone\",\"type\":\"text\",\"options\":{\"max\":20}},
  {\"name\":\"avatar\",\"type\":\"file\",\"options\":{\"maxSelect\":1,\"maxSize\":5242880}},
  {\"name\":\"avatar_url\",\"type\":\"url\"},
  {\"name\":\"address\",\"type\":\"text\",\"options\":{\"max\":255}},
  {\"name\":\"date_of_birth\",\"type\":\"date\"},
  {\"name\":\"bio\",\"type\":\"text\"}
]"

echo -e "\n✅ PocketBase setup completed!"
echo "Admin email: $ADMIN_EMAIL"
echo "Admin password: $ADMIN_PASSWORD"
echo "Access admin UI: $BASE_URL/_/"
