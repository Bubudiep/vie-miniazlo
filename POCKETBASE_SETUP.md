# PocketBase Setup Guide

## Bước 1: Truy cập Admin UI

1. Mở browser và truy cập: http://127.0.0.1:8090/_/
2. Tạo admin account (email + password)

## Bước 2: Tạo Collections

### 📋 ACCOUNTS APP

#### Collection: `companies`
- Type: **Base**
- Schema:
  - `name` - Text (required, max 255)
  - `business_code` - Text (unique, max 50)
  - `service_type` - Select (values: retail, restaurant, wholesale, service, other)
  - `contact_name` - Text (max 150)
  - `contact_email` - Email
  - `contact_phone` - Text (max 20)
  - `address` - Text (max 255)

#### Collection: `users`
- Type: **Auth** (extends PocketBase authentication)
- Schema:
  - `company` - Relation (companies, single)
  - `role` - Relation (roles, single)
  - `department` - Relation (departments, single)
  - `position` - Relation (positions, single)
  - `must_change_password` - Bool (default: true)

#### Collection: `roles`
- Type: **Base**
- Schema:
  - `company` - Relation (companies, cascade delete)
  - `name` - Text (required, max 100)
  - `display_name` - Text (max 100)
- Index: Unique on (company, name)

#### Collection: `profiles`
- Type: **Base**
- Schema:
  - `user` - Relation (users, cascade delete, single, unique)
  - `display_name` - Text (max 150)
  - `facebook_url` - URL
  - `phone` - Text (max 20)
  - `avatar` - File (max 5MB)
  - `avatar_preview_data_url` - Text
  - `avatar_url` - URL
  - `cover` - File (max 5MB)
  - `address` - Text (max 255)
  - `date_of_birth` - Date
  - `bio` - Text

#### Collection: `departments`
- Type: **Base**
- Schema:
  - `company` - Relation (companies, cascade delete)
  - `name` - Text (required, max 150)
  - `parent` - Relation (departments, single) - self-reference
  - `head` - Relation (users, single)

#### Collection: `positions`
- Type: **Base**
- Schema:
  - `company` - Relation (companies, cascade delete)
  - `name` - Text (required, max 150)
  - `level` - Number (default: 0)

#### Collection: `notifications`
- Type: **Base**
- Schema:
  - `company` - Relation (companies, cascade delete)
  - `event` - Text (required, max 100)
  - `title` - Text (required, max 255)
  - `comment` - Text
  - `payload` - JSON
  - `is_public` - Bool (default: true)
  - `target` - Relation (users, single)

---

### 💬 CHAT APP

#### Collection: `chat_rooms`
- Type: **Base**
- Schema:
  - `company` - Relation (companies, cascade delete)
  - `room_type` - Select (values: company, direct, group)
  - `name` - Text (max 255)
  - `avatar` - File (max 5MB)
  - `created_by` - Relation (users, single)
  - `last_message_at` - Date
  - `chat_enabled` - Bool (default: true)
  - `attachments_enabled` - Bool (default: true)

#### Collection: `chat_room_members`
- Type: **Base**
- Schema:
  - `room` - Relation (chat_rooms, cascade delete)
  - `user` - Relation (users, cascade delete)
  - `role` - Select (values: owner, deputy, member)
  - `last_seen_at` - Date
  - `is_muted` - Bool (default: false)
  - `is_pinned` - Bool (default: false)

#### Collection: `messages`
- Type: **Base**
- Schema:
  - `room` - Relation (chat_rooms, cascade delete)
  - `sender` - Relation (users, single)
  - `content` - Text

#### Collection: `attachments`
- Type: **Base**
- Schema:
  - `message` - Relation (messages, cascade delete)
  - `kind` - Select (values: file, link)
  - `file` - File (max 50MB)
  - `url` - URL
  - `name` - Text (max 255)
  - `content_type` - Text (max 100)
  - `size` - Number
  - `preview_data_url` - Text

---

### 📦 INVENTORY APP

#### Collection: `stock_categories`
- Type: **Base**
- Schema:
  - `company` - Relation (companies, cascade delete)
  - `name` - Text (required, max 150)
  - `order` - Number (default: 0)

#### Collection: `stock_items`
- Type: **Base**
- Schema:
  - `company` - Relation (companies, cascade delete)
  - `category` - Relation (stock_categories, single)
  - `name` - Text (required, max 255)
  - `unit` - Text (required, max 50)
  - `sku` - Text (max 100, unique per company)
  - `quantity_on_hand` - Number (default: 0)
  - `reorder_level` - Number
  - `is_active` - Bool (default: true)

#### Collection: `stock_movements`
- Type: **Base**
- Schema:
  - `company` - Relation (companies, cascade delete)
  - `item` - Relation (stock_items)
  - `movement_type` - Select (values: in, out)
  - `quantity` - Number (required)
  - `unit_cost` - Number
  - `reference` - Text (max 255)
  - `created_by` - Relation (users, single)
  - `occurred_at` - Date (required)

---

### 🏪 STORE APP

#### Collection: `categories`
- Type: **Base**
- Schema:
  - `company` - Relation (companies, cascade delete)
  - `name` - Text (required, max 150)
  - `order` - Number (default: 0)

#### Collection: `products`
- Type: **Base**
- Schema:
  - `company` - Relation (companies, cascade delete)
  - `category` - Relation (categories, single)
  - `kind` - Select (values: goods, food, drink)
  - `name` - Text (required, max 255)
  - `unit` - Text (required, max 50)
  - `price` - Number (required)
  - `sku` - Text (max 100, unique per company)
  - `image` - File (max 5MB)
  - `track_stock` - Bool (default: false)
  - `stock_quantity` - Number (default: 0)
  - `is_out_of_stock` - Bool (default: false)
  - `show_in_menu` - Bool (default: true)
  - `is_active` - Bool (default: true)

#### Collection: `floors`
- Type: **Base**
- Schema:
  - `company` - Relation (companies, cascade delete)
  - `name` - Text (required, max 100)
  - `order` - Number (default: 0)

#### Collection: `tables`
- Type: **Base**
- Schema:
  - `company` - Relation (companies, cascade delete)
  - `floor` - Relation (floors, cascade delete)
  - `name` - Text (required, max 100)
  - `table_type` - Select (values: dining, billiards, karaoke, other)
  - `capacity` - Number (default: 4)
  - `hourly_rate` - Number
  - `pos_x` - Number (default: 0)
  - `pos_y` - Number (default: 0)
  - `width` - Number (default: 1)
  - `height` - Number (default: 1)
  - `status` - Select (values: available, occupied, reserved, cleaning)
  - `is_active` - Bool (default: true)
  - `camera_url` - URL

#### Collection: `customers`
- Type: **Base**
- Schema:
  - `company` - Relation (companies, cascade delete)
  - `name` - Text (required, max 150)
  - `phone` - Text (max 20, unique per company)
  - `email` - Email
  - `address` - Text (max 255)
  - `note` - Text

#### Collection: `table_sessions`
- Type: **Base**
- Schema:
  - `table` - Relation (tables)
  - `opened_by` - Relation (users, single)
  - `closed_by` - Relation (users, single)
  - `guest_count` - Number (default: 1)
  - `customer` - Relation (customers, single)
  - `status` - Select (values: open, closed)
  - `opened_at` - Date (required)
  - `closed_at` - Date
  - `rental_amount` - Number (default: 0)
  - `card_minutes_used` - Number (default: 0)

#### Collection: `orders`
- Type: **Base**
- Schema:
  - `company` - Relation (companies, cascade delete)
  - `session` - Relation (table_sessions, single)
  - `customer` - Relation (customers, single)
  - `created_by` - Relation (users, single)
  - `status` - Select (values: pending, served, cancelled)
  - `note` - Text (max 255)

#### Collection: `order_items`
- Type: **Base**
- Schema:
  - `order` - Relation (orders, cascade delete)
  - `product` - Relation (products)
  - `product_name` - Text (required, max 255)
  - `unit_price` - Number (required)
  - `quantity` - Number (required)

---

### 🎫 MEMBERSHIP APP

#### Collection: `membership_plans`
- Type: **Base**
- Schema:
  - `company` - Relation (companies, cascade delete)
  - `name` - Text (required, max 150)
  - `minutes` - Number (required)
  - `price` - Number (required)
  - `is_active` - Bool (default: true)
  - `order` - Number (default: 0)

#### Collection: `membership_cards`
- Type: **Base**
- Schema:
  - `company` - Relation (companies, cascade delete)
  - `customer` - Relation (customers, cascade delete, single, unique)
  - `remaining_minutes` - Number (default: 0)
  - `expires_at` - Date

#### Collection: `card_transactions`
- Type: **Base**
- Schema:
  - `card` - Relation (membership_cards, cascade delete)
  - `kind` - Select (values: topup, consume, adjust)
  - `minutes` - Number (required)
  - `plan` - Relation (membership_plans, single)
  - `session` - Relation (table_sessions, single)
  - `note` - Text (max 255)
  - `created_by` - Relation (users, single)

#### Collection: `events`
- Type: **Base**
- Schema:
  - `company` - Relation (companies, cascade delete)
  - `title` - Text (required, max 200)
  - `description` - Text
  - `image` - File (max 5MB)
  - `start_time` - Date
  - `end_time` - Date
  - `is_active` - Bool (default: true)
  - `order` - Number (default: 0)

#### Collection: `points_accounts`
- Type: **Base**
- Schema:
  - `company` - Relation (companies, cascade delete)
  - `customer` - Relation (customers, cascade delete, single, unique)
  - `balance` - Number (default: 0)

#### Collection: `points_transactions`
- Type: **Base**
- Schema:
  - `account` - Relation (points_accounts, cascade delete)
  - `kind` - Select (values: earn_spend, earn_visit, earn_manual, redeem, adjust)
  - `points` - Number (required)
  - `session` - Relation (table_sessions, single)
  - `note` - Text (max 255)
  - `created_by` - Relation (users, single)

#### Collection: `vouchers`
- Type: **Base**
- Schema:
  - `company` - Relation (companies, cascade delete)
  - `title` - Text (required, max 150)
  - `description` - Text (max 255)
  - `discount_type` - Select (values: fixed, percent)
  - `discount_value` - Number (required)
  - `is_active` - Bool (default: true)

#### Collection: `customer_vouchers`
- Type: **Base**
- Schema:
  - `company` - Relation (companies, cascade delete)
  - `voucher` - Relation (vouchers, cascade delete)
  - `customer` - Relation (customers, cascade delete)
  - `status` - Select (values: active, used, expired)
  - `expires_at` - Date
  - `used_at` - Date
  - `used_session` - Relation (table_sessions, single)
  - `assigned_by` - Relation (users, single)

#### Collection: `customer_tokens`
- Type: **Base**
- Schema:
  - `customer` - Relation (customers, cascade delete, single, unique)
  - `key` - Text (required, max 64, unique)

---

## Bước 3: API Rules

Sau khi tạo xong collections, cần thiết lập API Rules cho từng collection:

### Ví dụ cho `users` collection:
- **List/Search**: `@request.auth.id != "" && @request.auth.company = company`
- **View**: `@request.auth.id != "" && @request.auth.company = company`
- **Create**: `@request.auth.role.name = "admin"`
- **Update**: `@request.auth.id = id || @request.auth.role.name = "admin"`
- **Delete**: `@request.auth.role.name = "admin"`

### Cho các collections khác:
- Mọi collection có `company` field: filter theo `@request.auth.company = company`
- Collections liên quan đến customer: cho phép customer truy cập data của chính họ

---

## Bước 4: Test API

Sau khi setup xong, test API endpoints:

```bash
# Health check
curl http://127.0.0.1:8090/api/health

# List collections
curl http://127.0.0.1:8090/api/collections

# Create a company
curl -X POST http://127.0.0.1:8090/api/collections/companies/records \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Company", "service_type": "restaurant"}'
```

---

## Bước 5: Export Schema (Backup)

Sau khi tạo xong tất cả collections, export schema ra file JSON để backup:

1. Vào Settings > Export collections
2. Save file JSON
3. Commit vào git để version control

---

## Ghi chú

- PocketBase tự động tạo `id`, `created`, `updated` fields cho mọi collection
- Auth collection (`users`) có thêm các fields: `username`, `email`, `emailVisibility`, `verified`
- Cascade delete: khi xóa parent record, tất cả children cũng bị xóa
- Single relation: chỉ cho phép chọn 1 record
- Multiple relation: cho phép chọn nhiều records (default)
