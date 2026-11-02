#!/usr/bin/env python3
"""
PocketBase Collections Auto-Setup Script
Tạo tất cả collections cần thiết cho dự án billiard qua Admin API
"""

import requests
import json
import time

BASE_URL = "http://127.0.0.1:8390"
ADMIN_EMAIL = "admin@ccc.com"
ADMIN_PASSWORD = "Hoanghai12!"

def login_admin():
    """Login và lấy admin token"""
    response = requests.post(
        f"{BASE_URL}/api/admins/auth-with-password",
        json={"identity": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    if response.status_code == 200:
        return response.json()["token"]
    else:
        print(f"Login failed: {response.text}")
        return None

def create_collection(token, collection_data):
    """Create a collection"""
    headers = {"Authorization": token, "Content-Type": "application/json"}
    response = requests.post(
        f"{BASE_URL}/api/collections",
        headers=headers,
        json=collection_data
    )
    if response.status_code in [200, 201]:
        print(f"[OK] Created: {collection_data['name']}")
        return response.json()["id"]
    else:
        print(f"[FAIL] Failed to create {collection_data['name']}: {response.text}")
        return None

def get_collection_id(token, name):
    """Get collection ID by name"""
    headers = {"Authorization": token}
    response = requests.get(f"{BASE_URL}/api/collections/{name}", headers=headers)
    if response.status_code == 200:
        return response.json()["id"]
    return None

def main():
    print("=== PocketBase Collections Setup ===\n")

    # Login
    print("Logging in as admin...")
    token = login_admin()
    if not token:
        print("Failed to login. Check admin credentials.")
        return

    print(f"Login successful\n")

    # Dictionary để lưu collection IDs
    col_ids = {}

    # 1. Companies (base collection)
    print("Creating collection: companies")
    companies_id = create_collection(token, {
        "name": "companies",
        "type": "base",
        "schema": [
            {"name": "name", "type": "text", "required": True, "options": {"max": 255}},
            {"name": "business_code", "type": "text", "options": {"max": 50}},
            {"name": "service_type", "type": "select", "options": {"values": ["retail","restaurant","wholesale","service","other"]}},
            {"name": "contact_name", "type": "text", "options": {"max": 150}},
            {"name": "contact_email", "type": "email"},
            {"name": "contact_phone", "type": "text", "options": {"max": 20}},
            {"name": "address", "type": "text", "options": {"max": 255}}
        ]
    })
    if companies_id:
        col_ids["companies"] = companies_id
    time.sleep(0.5)

    # 2. Roles
    print("Creating collection: roles")
    roles_id = create_collection(token, {
        "name": "roles",
        "type": "base",
        "schema": [
            {"name": "company", "type": "relation", "required": True, "options": {"collectionId": companies_id, "cascadeDelete": True}},
            {"name": "name", "type": "text", "required": True, "options": {"max": 100}},
            {"name": "display_name", "type": "text", "options": {"max": 100}}
        ]
    })
    if roles_id:
        col_ids["roles"] = roles_id
    time.sleep(0.5)

    # 3. Departments (without parent/head relation for now)
    print("Creating collection: departments")
    departments_id = create_collection(token, {
        "name": "departments",
        "type": "base",
        "schema": [
            {"name": "company", "type": "relation", "required": True, "options": {"collectionId": companies_id, "cascadeDelete": True}},
            {"name": "name", "type": "text", "required": True, "options": {"max": 150}}
        ]
    })
    if departments_id:
        col_ids["departments"] = departments_id
    time.sleep(0.5)

    # 4. Positions
    print("Creating collection: positions")
    positions_id = create_collection(token, {
        "name": "positions",
        "type": "base",
        "schema": [
            {"name": "company", "type": "relation", "required": True, "options": {"collectionId": companies_id, "cascadeDelete": True}},
            {"name": "name", "type": "text", "required": True, "options": {"max": 150}},
            {"name": "level", "type": "number", "required": True}
        ]
    })
    if positions_id:
        col_ids["positions"] = positions_id
    time.sleep(0.5)

    # 5. Users (auth collection)
    print("Creating collection: users (auth)")
    users_id = create_collection(token, {
        "name": "users",
        "type": "auth",
        "schema": [
            {"name": "company", "type": "relation", "options": {"collectionId": companies_id, "maxSelect": 1}},
            {"name": "role", "type": "relation", "options": {"collectionId": roles_id, "maxSelect": 1}},
            {"name": "department", "type": "relation", "options": {"collectionId": departments_id, "maxSelect": 1}},
            {"name": "position", "type": "relation", "options": {"collectionId": positions_id, "maxSelect": 1}},
            {"name": "must_change_password", "type": "bool", "required": True}
        ]
    })
    if users_id:
        col_ids["users"] = users_id
    time.sleep(0.5)

    # 6. Customers
    print("Creating collection: customers")
    customers_id = create_collection(token, {
        "name": "customers",
        "type": "base",
        "schema": [
            {"name": "company", "type": "relation", "required": True, "options": {"collectionId": companies_id, "cascadeDelete": True}},
            {"name": "name", "type": "text", "required": True, "options": {"max": 150}},
            {"name": "phone", "type": "text", "options": {"max": 20}},
            {"name": "email", "type": "email"},
            {"name": "address", "type": "text", "options": {"max": 255}},
            {"name": "note", "type": "text"}
        ]
    })
    if customers_id:
        col_ids["customers"] = customers_id
    time.sleep(0.5)

    # 7. Categories (product categories)
    print("Creating collection: categories")
    categories_id = create_collection(token, {
        "name": "categories",
        "type": "base",
        "schema": [
            {"name": "company", "type": "relation", "required": True, "options": {"collectionId": companies_id, "cascadeDelete": True}},
            {"name": "name", "type": "text", "required": True, "options": {"max": 150}},
            {"name": "order", "type": "number", "required": True}
        ]
    })
    if categories_id:
        col_ids["categories"] = categories_id
    time.sleep(0.5)

    # 8. Products
    print("Creating collection: products")
    products_id = create_collection(token, {
        "name": "products",
        "type": "base",
        "schema": [
            {"name": "company", "type": "relation", "required": True, "options": {"collectionId": companies_id, "cascadeDelete": True}},
            {"name": "category", "type": "relation", "options": {"collectionId": categories_id, "maxSelect": 1}},
            {"name": "kind", "type": "select", "required": True, "options": {"values": ["goods","food","drink"]}},
            {"name": "name", "type": "text", "required": True, "options": {"max": 255}},
            {"name": "unit", "type": "text", "required": True, "options": {"max": 50}},
            {"name": "price", "type": "number", "required": True},
            {"name": "sku", "type": "text", "options": {"max": 100}},
            {"name": "image", "type": "file", "options": {"maxSelect": 1, "maxSize": 5242880}},
            {"name": "track_stock", "type": "bool", "required": True},
            {"name": "stock_quantity", "type": "number", "required": True},
            {"name": "is_out_of_stock", "type": "bool", "required": True},
            {"name": "show_in_menu", "type": "bool", "required": True},
            {"name": "is_active", "type": "bool", "required": True}
        ]
    })
    if products_id:
        col_ids["products"] = products_id
    time.sleep(0.5)

    # 9. Floors
    print("Creating collection: floors")
    floors_id = create_collection(token, {
        "name": "floors",
        "type": "base",
        "schema": [
            {"name": "company", "type": "relation", "required": True, "options": {"collectionId": companies_id, "cascadeDelete": True}},
            {"name": "name", "type": "text", "required": True, "options": {"max": 100}},
            {"name": "order", "type": "number", "required": True}
        ]
    })
    if floors_id:
        col_ids["floors"] = floors_id
    time.sleep(0.5)

    # 10. Tables
    print("Creating collection: tables")
    tables_id = create_collection(token, {
        "name": "tables",
        "type": "base",
        "schema": [
            {"name": "company", "type": "relation", "required": True, "options": {"collectionId": companies_id, "cascadeDelete": True}},
            {"name": "floor", "type": "relation", "required": True, "options": {"collectionId": floors_id, "cascadeDelete": True}},
            {"name": "name", "type": "text", "required": True, "options": {"max": 100}},
            {"name": "table_type", "type": "select", "required": True, "options": {"values": ["dining","billiards","karaoke","other"]}},
            {"name": "capacity", "type": "number", "required": True},
            {"name": "hourly_rate", "type": "number"},
            {"name": "pos_x", "type": "number", "required": True},
            {"name": "pos_y", "type": "number", "required": True},
            {"name": "width", "type": "number", "required": True},
            {"name": "height", "type": "number", "required": True},
            {"name": "status", "type": "select", "required": True, "options": {"values": ["available","occupied","reserved","cleaning"]}},
            {"name": "is_active", "type": "bool", "required": True},
            {"name": "camera_url", "type": "url"}
        ]
    })
    if tables_id:
        col_ids["tables"] = tables_id
    time.sleep(0.5)

    # 11. Table Sessions
    print("Creating collection: table_sessions")
    table_sessions_id = create_collection(token, {
        "name": "table_sessions",
        "type": "base",
        "schema": [
            {"name": "table", "type": "relation", "required": True, "options": {"collectionId": tables_id}},
            {"name": "opened_by", "type": "relation", "options": {"collectionId": users_id, "maxSelect": 1}},
            {"name": "closed_by", "type": "relation", "options": {"collectionId": users_id, "maxSelect": 1}},
            {"name": "guest_count", "type": "number", "required": True},
            {"name": "customer", "type": "relation", "options": {"collectionId": customers_id, "maxSelect": 1}},
            {"name": "status", "type": "select", "required": True, "options": {"values": ["open","closed"]}},
            {"name": "rental_amount", "type": "number", "required": True},
            {"name": "card_minutes_used", "type": "number", "required": True}
        ]
    })
    if table_sessions_id:
        col_ids["table_sessions"] = table_sessions_id
    time.sleep(0.5)

    # 12. Orders
    print("Creating collection: orders")
    orders_id = create_collection(token, {
        "name": "orders",
        "type": "base",
        "schema": [
            {"name": "company", "type": "relation", "required": True, "options": {"collectionId": companies_id, "cascadeDelete": True}},
            {"name": "session", "type": "relation", "options": {"collectionId": table_sessions_id, "maxSelect": 1}},
            {"name": "customer", "type": "relation", "options": {"collectionId": customers_id, "maxSelect": 1}},
            {"name": "created_by", "type": "relation", "options": {"collectionId": users_id, "maxSelect": 1}},
            {"name": "status", "type": "select", "required": True, "options": {"values": ["pending","served","cancelled"]}},
            {"name": "note", "type": "text", "options": {"max": 255}}
        ]
    })
    if orders_id:
        col_ids["orders"] = orders_id
    time.sleep(0.5)

    # 13. Order Items
    print("Creating collection: order_items")
    order_items_id = create_collection(token, {
        "name": "order_items",
        "type": "base",
        "schema": [
            {"name": "order", "type": "relation", "required": True, "options": {"collectionId": orders_id, "cascadeDelete": True}},
            {"name": "product", "type": "relation", "required": True, "options": {"collectionId": products_id}},
            {"name": "product_name", "type": "text", "required": True, "options": {"max": 255}},
            {"name": "unit_price", "type": "number", "required": True},
            {"name": "quantity", "type": "number", "required": True}
        ]
    })
    if order_items_id:
        col_ids["order_items"] = order_items_id
    time.sleep(0.5)

    # 14. Membership Plans
    print("Creating collection: membership_plans")
    membership_plans_id = create_collection(token, {
        "name": "membership_plans",
        "type": "base",
        "schema": [
            {"name": "company", "type": "relation", "required": True, "options": {"collectionId": companies_id, "cascadeDelete": True}},
            {"name": "name", "type": "text", "required": True, "options": {"max": 150}},
            {"name": "minutes", "type": "number", "required": True},
            {"name": "price", "type": "number", "required": True},
            {"name": "is_active", "type": "bool", "required": True},
            {"name": "order", "type": "number", "required": True}
        ]
    })
    if membership_plans_id:
        col_ids["membership_plans"] = membership_plans_id
    time.sleep(0.5)

    # 15. Membership Cards
    print("Creating collection: membership_cards")
    membership_cards_id = create_collection(token, {
        "name": "membership_cards",
        "type": "base",
        "schema": [
            {"name": "company", "type": "relation", "required": True, "options": {"collectionId": companies_id, "cascadeDelete": True}},
            {"name": "customer", "type": "relation", "required": True, "options": {"collectionId": customers_id, "cascadeDelete": True, "maxSelect": 1}},
            {"name": "remaining_minutes", "type": "number", "required": True},
            {"name": "expires_at", "type": "date"}
        ]
    })
    if membership_cards_id:
        col_ids["membership_cards"] = membership_cards_id

    print(f"\n[SUCCESS] Created {len(col_ids)} collections!")
    print("\nCollection IDs:")
    for name, cid in col_ids.items():
        print(f"  - {name}: {cid}")

    print(f"\n[DONE] Setup complete! Access Admin UI at: {BASE_URL}/_/")

if __name__ == "__main__":
    main()
