# Update Users Schema for Zalo Authentication

## Required Changes

Add `zalo_id` field to the `users` collection via Admin UI:

1. Open http://127.0.0.1:8390/_/
2. Go to Collections → users
3. Click "New field" → Text
4. Configure:
   - **Name:** `zalo_id`
   - **Max length:** 50
   - **Pattern:** (leave empty)
   - **Unique:** ✅ Check this (important!)
   - **Required:** ❌ Leave unchecked (optional, will be set on first Zalo login)

5. Add index for performance:
   - Go to "Indexes" tab
   - Add: `CREATE UNIQUE INDEX idx_zalo_id ON users (zalo_id) WHERE zalo_id != ''`

6. Click "Save changes"

## Why this matters

- `zalo_id` stores the Zalo user ID from Zalo's Graph API
- Must be unique to prevent duplicate accounts
- Used as mapping key between Zalo accounts and PocketBase users
- Indexed for fast lookup during authentication
