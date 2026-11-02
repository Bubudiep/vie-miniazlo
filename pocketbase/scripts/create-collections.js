import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8390');

const ADMIN_EMAIL = 'admin@ccc.com';
const ADMIN_PASSWORD = 'Hoanghai12!';

// Collection IDs will be stored here as we create them
const collectionIds = {};

async function loginAdmin() {
  console.log('Logging in as admin...');
  await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
  console.log('Login successful\n');
}

async function createCollection(data) {
  try {
    const collection = await pb.collections.create(data);
    console.log(`[OK] Created: ${data.name} (${collection.id})`);
    collectionIds[data.name] = collection.id;
    return collection.id;
  } catch (error) {
    console.error(`[FAIL] ${data.name}: ${error.message}`);
    return null;
  }
}

async function updateCollection(id, data) {
  try {
    await pb.collections.update(id, data);
    console.log(`[OK] Updated: ${data.name || id}`);
  } catch (error) {
    console.error(`[FAIL] Update ${id}: ${error.message}`);
  }
}

async function main() {
  console.log('=== PocketBase Collections Setup ===\n');

  await loginAdmin();

  // 1. Companies
  await createCollection({
    name: 'companies',
    type: 'base',
    schema: [
      { name: 'name', type: 'text', required: true, options: { max: 255 } },
      { name: 'business_code', type: 'text', options: { max: 50 } },
      { name: 'service_type', type: 'select', options: { values: ['retail', 'restaurant', 'wholesale', 'service', 'other'] } },
      { name: 'contact_name', type: 'text', options: { max: 150 } },
      { name: 'contact_email', type: 'email' },
      { name: 'contact_phone', type: 'text', options: { max: 20 } },
      { name: 'address', type: 'text', options: { max: 255 } }
    ]
  });

  // 2. Roles
  await createCollection({
    name: 'roles',
    type: 'base',
    schema: [
      { name: 'company', type: 'relation', required: true, options: { collectionId: collectionIds.companies, cascadeDelete: true } },
      { name: 'name', type: 'text', required: true, options: { max: 100 } },
      { name: 'display_name', type: 'text', options: { max: 100 } }
    ]
  });

  // 3. Departments (temporary schema, will update later)
  await createCollection({
    name: 'departments',
    type: 'base',
    schema: [
      { name: 'company', type: 'relation', required: true, options: { collectionId: collectionIds.companies, cascadeDelete: true } },
      { name: 'name', type: 'text', required: true, options: { max: 150 } }
    ]
  });

  // 4. Positions
  await createCollection({
    name: 'positions',
    type: 'base',
    schema: [
      { name: 'company', type: 'relation', required: true, options: { collectionId: collectionIds.companies, cascadeDelete: true } },
      { name: 'name', type: 'text', required: true, options: { max: 150 } },
      { name: 'level', type: 'number', required: true }
    ]
  });

  // 5. Users (auth collection)
  await createCollection({
    name: 'users',
    type: 'auth',
    schema: [
      { name: 'company', type: 'relation', options: { collectionId: collectionIds.companies, maxSelect: 1 } },
      { name: 'role', type: 'relation', options: { collectionId: collectionIds.roles, maxSelect: 1 } },
      { name: 'department', type: 'relation', options: { collectionId: collectionIds.departments, maxSelect: 1 } },
      { name: 'position', type: 'relation', options: { collectionId: collectionIds.positions, maxSelect: 1 } },
      { name: 'must_change_password', type: 'bool', required: true }
    ]
  });

  // Update departments to include parent and head relations
  await updateCollection(collectionIds.departments, {
    name: 'departments',
    schema: [
      { name: 'company', type: 'relation', required: true, options: { collectionId: collectionIds.companies, cascadeDelete: true } },
      { name: 'name', type: 'text', required: true, options: { max: 150 } },
      { name: 'parent', type: 'relation', options: { collectionId: collectionIds.departments, maxSelect: 1 } },
      { name: 'head', type: 'relation', options: { collectionId: collectionIds.users, maxSelect: 1 } }
    ]
  });

  // 6. Profiles
  await createCollection({
    name: 'profiles',
    type: 'base',
    schema: [
      { name: 'user', type: 'relation', required: true, options: { collectionId: collectionIds.users, cascadeDelete: true, maxSelect: 1 } },
      { name: 'display_name', type: 'text', options: { max: 150 } },
      { name: 'facebook_url', type: 'url' },
      { name: 'phone', type: 'text', options: { max: 20 } },
      { name: 'avatar', type: 'file', options: { maxSelect: 1, maxSize: 5242880 } },
      { name: 'avatar_url', type: 'url' },
      { name: 'cover', type: 'file', options: { maxSelect: 1, maxSize: 5242880 } },
      { name: 'address', type: 'text', options: { max: 255 } },
      { name: 'date_of_birth', type: 'date' },
      { name: 'bio', type: 'text' }
    ]
  });

  // 7. Notifications
  await createCollection({
    name: 'notifications',
    type: 'base',
    schema: [
      { name: 'company', type: 'relation', required: true, options: { collectionId: collectionIds.companies, cascadeDelete: true } },
      { name: 'event', type: 'text', required: true, options: { max: 100 } },
      { name: 'title', type: 'text', required: true, options: { max: 255 } },
      { name: 'comment', type: 'text' },
      { name: 'payload', type: 'json' },
      { name: 'is_public', type: 'bool', required: true },
      { name: 'target', type: 'relation', options: { collectionId: collectionIds.users, maxSelect: 1 } }
    ]
  });

  // === CHAT APP ===

  // 8. Chat Rooms
  await createCollection({
    name: 'chat_rooms',
    type: 'base',
    schema: [
      { name: 'company', type: 'relation', required: true, options: { collectionId: collectionIds.companies, cascadeDelete: true } },
      { name: 'room_type', type: 'select', required: true, options: { values: ['company', 'direct', 'group'] } },
      { name: 'name', type: 'text', options: { max: 255 } },
      { name: 'avatar', type: 'file', options: { maxSelect: 1, maxSize: 5242880 } },
      { name: 'created_by', type: 'relation', options: { collectionId: collectionIds.users, maxSelect: 1 } },
      { name: 'last_message_at', type: 'date' },
      { name: 'chat_enabled', type: 'bool', required: true },
      { name: 'attachments_enabled', type: 'bool', required: true }
    ]
  });

  // 9. Chat Room Members
  await createCollection({
    name: 'chat_room_members',
    type: 'base',
    schema: [
      { name: 'room', type: 'relation', required: true, options: { collectionId: collectionIds.chat_rooms, cascadeDelete: true } },
      { name: 'user', type: 'relation', required: true, options: { collectionId: collectionIds.users, cascadeDelete: true } },
      { name: 'role', type: 'select', required: true, options: { values: ['owner', 'deputy', 'member'] } },
      { name: 'last_seen_at', type: 'date' },
      { name: 'is_muted', type: 'bool', required: true },
      { name: 'is_pinned', type: 'bool', required: true }
    ]
  });

  // 10. Messages
  await createCollection({
    name: 'messages',
    type: 'base',
    schema: [
      { name: 'room', type: 'relation', required: true, options: { collectionId: collectionIds.chat_rooms, cascadeDelete: true } },
      { name: 'sender', type: 'relation', options: { collectionId: collectionIds.users, maxSelect: 1 } },
      { name: 'content', type: 'text' }
    ]
  });

  // 11. Attachments
  await createCollection({
    name: 'attachments',
    type: 'base',
    schema: [
      { name: 'message', type: 'relation', required: true, options: { collectionId: collectionIds.messages, cascadeDelete: true } },
      { name: 'kind', type: 'select', required: true, options: { values: ['file', 'link'] } },
      { name: 'file', type: 'file', options: { maxSelect: 1, maxSize: 52428800 } },
      { name: 'url', type: 'url' },
      { name: 'name', type: 'text', options: { max: 255 } },
      { name: 'content_type', type: 'text', options: { max: 100 } },
      { name: 'size', type: 'number' }
    ]
  });

  // === INVENTORY APP ===

  // 12. Stock Categories
  await createCollection({
    name: 'stock_categories',
    type: 'base',
    schema: [
      { name: 'company', type: 'relation', required: true, options: { collectionId: collectionIds.companies, cascadeDelete: true } },
      { name: 'name', type: 'text', required: true, options: { max: 150 } },
      { name: 'order', type: 'number', required: true }
    ]
  });

  // 13. Stock Items
  await createCollection({
    name: 'stock_items',
    type: 'base',
    schema: [
      { name: 'company', type: 'relation', required: true, options: { collectionId: collectionIds.companies, cascadeDelete: true } },
      { name: 'category', type: 'relation', options: { collectionId: collectionIds.stock_categories, maxSelect: 1 } },
      { name: 'name', type: 'text', required: true, options: { max: 255 } },
      { name: 'unit', type: 'text', required: true, options: { max: 50 } },
      { name: 'sku', type: 'text', options: { max: 100 } },
      { name: 'quantity_on_hand', type: 'number', required: true },
      { name: 'reorder_level', type: 'number' },
      { name: 'is_active', type: 'bool', required: true }
    ]
  });

  // 14. Stock Movements
  await createCollection({
    name: 'stock_movements',
    type: 'base',
    schema: [
      { name: 'company', type: 'relation', required: true, options: { collectionId: collectionIds.companies, cascadeDelete: true } },
      { name: 'item', type: 'relation', required: true, options: { collectionId: collectionIds.stock_items } },
      { name: 'movement_type', type: 'select', required: true, options: { values: ['in', 'out'] } },
      { name: 'quantity', type: 'number', required: true },
      { name: 'unit_cost', type: 'number' },
      { name: 'reference', type: 'text', options: { max: 255 } },
      { name: 'created_by', type: 'relation', options: { collectionId: collectionIds.users, maxSelect: 1 } },
      { name: 'occurred_at', type: 'date', required: true }
    ]
  });

  // === STORE APP ===

  // 15. Customers
  await createCollection({
    name: 'customers',
    type: 'base',
    schema: [
      { name: 'company', type: 'relation', required: true, options: { collectionId: collectionIds.companies, cascadeDelete: true } },
      { name: 'name', type: 'text', required: true, options: { max: 150 } },
      { name: 'phone', type: 'text', options: { max: 20 } },
      { name: 'email', type: 'email' },
      { name: 'address', type: 'text', options: { max: 255 } },
      { name: 'note', type: 'text' }
    ]
  });

  // 16. Categories (Product Categories)
  await createCollection({
    name: 'categories',
    type: 'base',
    schema: [
      { name: 'company', type: 'relation', required: true, options: { collectionId: collectionIds.companies, cascadeDelete: true } },
      { name: 'name', type: 'text', required: true, options: { max: 150 } },
      { name: 'order', type: 'number', required: true }
    ]
  });

  // 17. Products
  await createCollection({
    name: 'products',
    type: 'base',
    schema: [
      { name: 'company', type: 'relation', required: true, options: { collectionId: collectionIds.companies, cascadeDelete: true } },
      { name: 'category', type: 'relation', options: { collectionId: collectionIds.categories, maxSelect: 1 } },
      { name: 'kind', type: 'select', required: true, options: { values: ['goods', 'food', 'drink'] } },
      { name: 'name', type: 'text', required: true, options: { max: 255 } },
      { name: 'unit', type: 'text', required: true, options: { max: 50 } },
      { name: 'price', type: 'number', required: true },
      { name: 'sku', type: 'text', options: { max: 100 } },
      { name: 'image', type: 'file', options: { maxSelect: 1, maxSize: 5242880 } },
      { name: 'track_stock', type: 'bool', required: true },
      { name: 'stock_quantity', type: 'number', required: true },
      { name: 'is_out_of_stock', type: 'bool', required: true },
      { name: 'show_in_menu', type: 'bool', required: true },
      { name: 'is_active', type: 'bool', required: true }
    ]
  });

  // 18. Floors
  await createCollection({
    name: 'floors',
    type: 'base',
    schema: [
      { name: 'company', type: 'relation', required: true, options: { collectionId: collectionIds.companies, cascadeDelete: true } },
      { name: 'name', type: 'text', required: true, options: { max: 100 } },
      { name: 'order', type: 'number', required: true }
    ]
  });

  // 19. Tables
  await createCollection({
    name: 'tables',
    type: 'base',
    schema: [
      { name: 'company', type: 'relation', required: true, options: { collectionId: collectionIds.companies, cascadeDelete: true } },
      { name: 'floor', type: 'relation', required: true, options: { collectionId: collectionIds.floors, cascadeDelete: true } },
      { name: 'name', type: 'text', required: true, options: { max: 100 } },
      { name: 'table_type', type: 'select', required: true, options: { values: ['dining', 'billiards', 'karaoke', 'other'] } },
      { name: 'capacity', type: 'number', required: true },
      { name: 'hourly_rate', type: 'number' },
      { name: 'pos_x', type: 'number', required: true },
      { name: 'pos_y', type: 'number', required: true },
      { name: 'width', type: 'number', required: true },
      { name: 'height', type: 'number', required: true },
      { name: 'status', type: 'select', required: true, options: { values: ['available', 'occupied', 'reserved', 'cleaning'] } },
      { name: 'is_active', type: 'bool', required: true },
      { name: 'camera_url', type: 'url' }
    ]
  });

  // 20. Table Sessions
  await createCollection({
    name: 'table_sessions',
    type: 'base',
    schema: [
      { name: 'table', type: 'relation', required: true, options: { collectionId: collectionIds.tables } },
      { name: 'opened_by', type: 'relation', options: { collectionId: collectionIds.users, maxSelect: 1 } },
      { name: 'closed_by', type: 'relation', options: { collectionId: collectionIds.users, maxSelect: 1 } },
      { name: 'guest_count', type: 'number', required: true },
      { name: 'customer', type: 'relation', options: { collectionId: collectionIds.customers, maxSelect: 1 } },
      { name: 'status', type: 'select', required: true, options: { values: ['open', 'closed'] } },
      { name: 'opened_at', type: 'date', required: true },
      { name: 'closed_at', type: 'date' },
      { name: 'rental_amount', type: 'number', required: true },
      { name: 'card_minutes_used', type: 'number', required: true }
    ]
  });

  // 21. Orders
  await createCollection({
    name: 'orders',
    type: 'base',
    schema: [
      { name: 'company', type: 'relation', required: true, options: { collectionId: collectionIds.companies, cascadeDelete: true } },
      { name: 'session', type: 'relation', options: { collectionId: collectionIds.table_sessions, maxSelect: 1 } },
      { name: 'customer', type: 'relation', options: { collectionId: collectionIds.customers, maxSelect: 1 } },
      { name: 'created_by', type: 'relation', options: { collectionId: collectionIds.users, maxSelect: 1 } },
      { name: 'status', type: 'select', required: true, options: { values: ['pending', 'served', 'cancelled'] } },
      { name: 'note', type: 'text', options: { max: 255 } }
    ]
  });

  // 22. Order Items
  await createCollection({
    name: 'order_items',
    type: 'base',
    schema: [
      { name: 'order', type: 'relation', required: true, options: { collectionId: collectionIds.orders, cascadeDelete: true } },
      { name: 'product', type: 'relation', required: true, options: { collectionId: collectionIds.products } },
      { name: 'product_name', type: 'text', required: true, options: { max: 255 } },
      { name: 'unit_price', type: 'number', required: true },
      { name: 'quantity', type: 'number', required: true }
    ]
  });

  // === MEMBERSHIP APP ===

  // 23. Membership Plans
  await createCollection({
    name: 'membership_plans',
    type: 'base',
    schema: [
      { name: 'company', type: 'relation', required: true, options: { collectionId: collectionIds.companies, cascadeDelete: true } },
      { name: 'name', type: 'text', required: true, options: { max: 150 } },
      { name: 'minutes', type: 'number', required: true },
      { name: 'price', type: 'number', required: true },
      { name: 'is_active', type: 'bool', required: true },
      { name: 'order', type: 'number', required: true }
    ]
  });

  // 24. Membership Cards
  await createCollection({
    name: 'membership_cards',
    type: 'base',
    schema: [
      { name: 'company', type: 'relation', required: true, options: { collectionId: collectionIds.companies, cascadeDelete: true } },
      { name: 'customer', type: 'relation', required: true, options: { collectionId: collectionIds.customers, cascadeDelete: true, maxSelect: 1 } },
      { name: 'remaining_minutes', type: 'number', required: true },
      { name: 'expires_at', type: 'date' }
    ]
  });

  // 25. Card Transactions
  await createCollection({
    name: 'card_transactions',
    type: 'base',
    schema: [
      { name: 'card', type: 'relation', required: true, options: { collectionId: collectionIds.membership_cards, cascadeDelete: true } },
      { name: 'kind', type: 'select', required: true, options: { values: ['topup', 'consume', 'adjust'] } },
      { name: 'minutes', type: 'number', required: true },
      { name: 'plan', type: 'relation', options: { collectionId: collectionIds.membership_plans, maxSelect: 1 } },
      { name: 'session', type: 'relation', options: { collectionId: collectionIds.table_sessions, maxSelect: 1 } },
      { name: 'note', type: 'text', options: { max: 255 } },
      { name: 'created_by', type: 'relation', options: { collectionId: collectionIds.users, maxSelect: 1 } }
    ]
  });

  // 26. Events
  await createCollection({
    name: 'events',
    type: 'base',
    schema: [
      { name: 'company', type: 'relation', required: true, options: { collectionId: collectionIds.companies, cascadeDelete: true } },
      { name: 'title', type: 'text', required: true, options: { max: 200 } },
      { name: 'description', type: 'text' },
      { name: 'image', type: 'file', options: { maxSelect: 1, maxSize: 5242880 } },
      { name: 'start_time', type: 'date' },
      { name: 'end_time', type: 'date' },
      { name: 'is_active', type: 'bool', required: true },
      { name: 'order', type: 'number', required: true }
    ]
  });

  // 27. Points Accounts
  await createCollection({
    name: 'points_accounts',
    type: 'base',
    schema: [
      { name: 'company', type: 'relation', required: true, options: { collectionId: collectionIds.companies, cascadeDelete: true } },
      { name: 'customer', type: 'relation', required: true, options: { collectionId: collectionIds.customers, cascadeDelete: true, maxSelect: 1 } },
      { name: 'balance', type: 'number', required: true }
    ]
  });

  // 28. Points Transactions
  await createCollection({
    name: 'points_transactions',
    type: 'base',
    schema: [
      { name: 'account', type: 'relation', required: true, options: { collectionId: collectionIds.points_accounts, cascadeDelete: true } },
      { name: 'kind', type: 'select', required: true, options: { values: ['earn_spend', 'earn_visit', 'earn_manual', 'redeem', 'adjust'] } },
      { name: 'points', type: 'number', required: true },
      { name: 'session', type: 'relation', options: { collectionId: collectionIds.table_sessions, maxSelect: 1 } },
      { name: 'note', type: 'text', options: { max: 255 } },
      { name: 'created_by', type: 'relation', options: { collectionId: collectionIds.users, maxSelect: 1 } }
    ]
  });

  // 29. Vouchers
  await createCollection({
    name: 'vouchers',
    type: 'base',
    schema: [
      { name: 'company', type: 'relation', required: true, options: { collectionId: collectionIds.companies, cascadeDelete: true } },
      { name: 'title', type: 'text', required: true, options: { max: 150 } },
      { name: 'description', type: 'text', options: { max: 255 } },
      { name: 'discount_type', type: 'select', required: true, options: { values: ['fixed', 'percent'] } },
      { name: 'discount_value', type: 'number', required: true },
      { name: 'is_active', type: 'bool', required: true }
    ]
  });

  // 30. Customer Vouchers
  await createCollection({
    name: 'customer_vouchers',
    type: 'base',
    schema: [
      { name: 'company', type: 'relation', required: true, options: { collectionId: collectionIds.companies, cascadeDelete: true } },
      { name: 'voucher', type: 'relation', required: true, options: { collectionId: collectionIds.vouchers, cascadeDelete: true } },
      { name: 'customer', type: 'relation', required: true, options: { collectionId: collectionIds.customers, cascadeDelete: true } },
      { name: 'status', type: 'select', required: true, options: { values: ['active', 'used', 'expired'] } },
      { name: 'expires_at', type: 'date' },
      { name: 'used_at', type: 'date' },
      { name: 'used_session', type: 'relation', options: { collectionId: collectionIds.table_sessions, maxSelect: 1 } },
      { name: 'assigned_by', type: 'relation', options: { collectionId: collectionIds.users, maxSelect: 1 } }
    ]
  });

  // 31. Customer Tokens
  await createCollection({
    name: 'customer_tokens',
    type: 'base',
    schema: [
      { name: 'customer', type: 'relation', required: true, options: { collectionId: collectionIds.customers, cascadeDelete: true, maxSelect: 1 } },
      { name: 'key', type: 'text', required: true, options: { max: 64 } }
    ]
  });

  console.log(`\n[SUCCESS] Created ${Object.keys(collectionIds).length} collections!`);
  console.log('\nAccess Admin UI at: http://127.0.0.1:8390/_/');
  console.log('\nNext steps:');
  console.log('1. Configure API rules for each collection');
  console.log('2. Update frontend to use PocketBase SDK');
}

main().catch(console.error);
