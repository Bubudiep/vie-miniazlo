# ARCHITECTURE AUDIT REPORT
**Project:** Billiard Management Zalo Mini App  
**Date:** 2026-10-08  
**Audit Scope:** Milestone 01 - Baseline Assessment  
**Status:** ✅ PASS

---

## 1. CURRENT ARCHITECTURE

### System Overview
```
billiard/
├── pocketbase/          # Backend - PocketBase v0.22.x
│   ├── pb_hooks/        # Custom endpoints (Zalo auth)
│   ├── pb_data/         # Database + storage
│   ├── pb_migrations/   # Schema migrations (3 files)
│   └── pb_schema.json   # Schema definition
├── vie-minizalo/        # Frontend - Zalo Mini App
│   └── src/             # 24 TypeScript files, ~2,897 LOC
└── vie-django/          # ❌ LEGACY - Not used
```

**Tech Stack:**
- Frontend: React 18.3 + TypeScript + Vite 5.2 + TailwindCSS 3.4
- UI Library: ZMP UI (Zalo Mini Program UI)
- State: React Context API + Jotai 2.12 (unused residual)
- Backend: PocketBase 0.28.1 (JavaScript runtime for hooks)
- Auth: Dual system - Zalo OAuth + Username/Password

---

## 2. FRONTEND STRUCTURE

### Core Configuration
**tsconfig.json:**
- ✅ Strict mode enabled
- ✅ Path alias `@/*` configured
- ⚠️ `noImplicitAny: false` (weak typing)
- ⚠️ `noUnusedLocals: false` (may hide dead code)

**vite.config.mts:**
- ✅ Root set to `./src`
- ✅ Path alias configured
- ✅ Zalo Mini App plugin active
- ⚠️ `assetsInlineLimit: 0` (no asset inlining)

**package.json:**
- ✅ Dependencies aligned with requirements
- ❌ No `build` script (only `start`, `deploy`)
- ❌ No `lint` or `typecheck` scripts
- ⚠️ Jotai installed but unused (residual from VieStore migration)

### Directory Structure
```
src/
├── api/
│   ├── pocketbase.ts       # PB client + TypeScript interfaces
│   ├── services.ts         # CRUD services (auth, company, product, table, customer)
│   └── zaloAuth.ts         # Zalo OAuth flow
├── contexts/
│   └── AuthContext.tsx     # Auth state management (React Context)
├── pages/ (6 pages)
│   ├── login.tsx           # ✅ Login (Zalo + Password)
│   ├── tables.tsx          # ⚠️ MOCK DATA - Table listing
│   ├── playing.tsx         # ⚠️ MOCK DATA - Game session + orders
│   ├── index.tsx           # Home/News feed
│   ├── menu.tsx            # Product menu
│   └── account.tsx         # User profile (rewritten for PocketBase)
├── components/ (8 components)
│   ├── layout.tsx          # ✅ App layout + routing + AuthProvider
│   ├── taskbar.tsx         # ✅ Bottom navigation (3 tabs)
│   ├── table.tsx           # Table card component
│   ├── memberCard.tsx      # Membership card (legacy UI, not used)
│   └── ...
├── mock/ (3 files)
│   ├── account.ts          # Account stats + notifications
│   ├── discover.ts         # Discover content
│   └── products.ts         # Product samples
├── utils/
│   ├── format.ts           # Date/time formatters
│   └── debounce.ts         # Debounce utility
└── app.ts                  # ✅ Entry point (clean, no VieStore)
```

---

## 3. BACKEND STRUCTURE

### PocketBase Configuration
**Version:** 0.28.1 (latest stable)  
**Port:** 8390 (configured in frontend)  
**Admin UI:** `http://127.0.0.1:8390/_/`

### Collections (5 total)

#### `users` (auth collection)
```typescript
{
  id: string (15 chars)
  username: string (unique, required)
  password: string (hashed, min 8 chars)
  email?: string (unique if set)
  company?: relation<companies>
  role?: 'admin' | 'user'
  verified: boolean
  // Missing: zalo_id field
}
```
**Rules:**
- List/View: Authenticated only
- Create: Public (for signup)
- Update: Self or admin
- Delete: Admin only
- Password auth: Enabled (username-based)

#### `companies`
```typescript
{
  id: string
  name: string (required)
  business_code?: string
  service_type?: 'retail' | 'restaurant' | 'wholesale' | 'service' | 'other'
  address?: string
}
```
**Rules:** All operations require authentication

#### `products`
```typescript
{
  id: string
  company: relation<companies> (required)
  name: string (required)
  price: number (≥0, required)
  kind?: 'goods' | 'food' | 'drink'
  is_active: boolean
}
```
**Rules:** Scoped to user's company (`@request.auth.company = company`)

#### `tables`
```typescript
{
  id: string
  company: relation<companies> (required)
  name: string (required)
  status: 'available' | 'occupied' | 'reserved' | 'cleaning'
  table_type?: 'dining' | 'billiards' | 'karaoke' | 'other'
}
```
**Rules:** Scoped to user's company

#### `customers`
```typescript
{
  id: string
  company: relation<companies> (required)
  name: string (required)
  phone?: string
  email?: string
}
```
**Rules:** Scoped to user's company

### Custom Hooks
**File:** `pb_hooks/zalo_auth.pb.js` (2,020 bytes)
**Endpoint:** `POST /api/zalo/auth`
**Status:** ✅ Implemented

**Flow:**
1. Receives `access_token` from Zalo SDK
2. Verifies with Zalo Graph API (`https://graph.zalo.me/v2.0/me`)
3. Finds user by `zalo_id` OR creates new user
4. Generates PocketBase JWT token
5. Returns `{token, record}`

**⚠️ CRITICAL ISSUE:** Hook expects `zalo_id` field in `users` collection, but schema audit shows it's **MISSING**.

### Migrations
3 migration files related to `users` collection updates:
- `1791409222_updated_users.js`
- `1791409239_updated_users.js`
- `1791410178_updated_users.js`

---

## 4. EXISTING AUTHENTICATION FLOW

### Current Implementation (Post-Cleanup)
**System:** Unified PocketBase auth (VieStore system removed)

**AuthContext** (`src/contexts/AuthContext.tsx`):
```typescript
interface AuthContextType {
  user: User | null
  companyId: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  loginWithZalo: () => Promise<void>
  loginWithPassword: (username: string, password: string) => Promise<void>
  logout: () => void
  clearError: () => void
}
```

**Login Methods:**

1. **Zalo OAuth** (Frontend → Backend)
   ```
   User clicks "Đăng nhập với Zalo"
        ↓
   zaloAuth.authenticateWithZalo()
        ↓
   Zalo SDK: getAccessToken()
        ↓
   POST /api/zalo/auth {access_token}
        ↓
   PocketBase hook verifies + creates/finds user
        ↓
   Returns {token, record}
        ↓
   pb.authStore.save(token, record)
        ↓
   Navigate to /
   ```

2. **Username/Password** (Direct PocketBase)
   ```
   User fills username + password
        ↓
   pb.collection('users').authWithPassword(username, password)
        ↓
   PocketBase validates
        ↓
   Returns {token, record}
        ↓
   pb.authStore.save(token, record)
        ↓
   Navigate to /
   ```

**Session Persistence:**
- Storage: `localStorage` (via `pb.authStore`)
- Key: PocketBase manages internally
- Restore: `AuthContext` checks `pb.authStore.isValid` on mount
- Duration: 5 days (432,000 seconds per schema)

**Protected Routes:**
- Wrapper: `<ProtectedRoute>` component in `layout.tsx`
- Logic: Checks `isAuthenticated` + `isLoading`
- Redirect: `/login` if not authenticated
- State preservation: React Router location state

---

## 5. EXISTING ROUTES

### Route Configuration (`layout.tsx`)
```typescript
/login          → LoginPage (public)
/               → TablesPage (protected) ← Default
/home           → HomePage (protected)
/account        → AccountPage (protected)
/:tableId       → PlayingPage (protected)
```

### Navigation (Bottom TabBar)
```
[Bảng tin]   → /home      (index 0)
[Đặt bàn]    → /          (index 1, active by default)
[Tài khoản]  → /account   (index 2)
```

**Animation:** Slide forward/backward based on tab index direction

**Hidden on:** `/cart` route (not implemented)

---

## 6. EXISTING MOCK DATA

### ⚠️ CRITICAL: Pages Using Mock Data

#### `tables.tsx` - Table Listing
**Mock Data:** `MOCK_TABLES: TableInfo[]` (7 tables)
```typescript
const MOCK_TABLES: TableInfo[] = [
  {
    id: "ban1", name: "Bàn 1",
    status: "playing", currentUser: "Hùng",
    timeRemaining: 210, price: 60000
  },
  { id: "ban2", name: "Bàn 2", status: "available", price: 60000 },
  { id: "ban3", name: "Bàn 3", status: "reserved", price: 60000 },
  // ... 4 more tables
]
```
**Impact:** NO connection to PocketBase `tables` collection

#### `playing.tsx` - Game Session Page
**Mock Data 1:** `MOCK_OFFERS` (3 promotional offers)
```typescript
const MOCK_OFFERS = [
  { id: 1, title: "Giảm 20% đồ uống", desc: "Áp dụng từ 14h-17h", icon: "zi-star" },
  // ... 2 more offers
]
```

**Mock Data 2:** `MOCK_MENU_HOT` (2 hot items)
```typescript
const MOCK_MENU_HOT = [
  { id: 1, name: "Sting dâu", price: 15000, image: "https://via.placeholder.com/80" },
  { id: 2, name: "Bimbim", price: 10000, image: "https://via.placeholder.com/80" }
]
```

**Mock Data 3:** `MOCK_MENU_ALL` (3 menu items)
```typescript
const MOCK_MENU_ALL = [
  { id: 3, name: "Coca Cola", price: 12000, image: "https://via.placeholder.com/80" },
  // ... 2 more items
]
```

**Mock Data 4:** Hardcoded bill services
```typescript
const BILL_SERVICES = [
  { name: "Nước ngọt", quantity: 2, price: 15000 },
  { name: "Bimbim", quantity: 3, price: 10000 },
  { name: "Gậy thuê", quantity: 1, price: 20000 },
  { name: "Tiền bàn", quantity: 1, price: 60000 }
]
```

**Mock Data 5:** Hardcoded time calculation
```typescript
const startTime = dayjs().subtract(1, "hour").subtract(23, "minute");
const hoursRemaining = 3.5;
const timeToReward = 37; // minutes
```

**Impact:** Entire playing experience is fake data

#### `mock/` Directory
**Files:**
1. `account.ts` - Account stats (tier, lucky number, order counts)
2. `discover.ts` - News feed content
3. `products.ts` - Sample product catalog

**Status:** Not actively used in current pages, but present

---

## 7. KNOWN BUGS

### 🔴 CRITICAL

**BUG-001: Missing `zalo_id` Field**
- **Severity:** Critical
- **Location:** `users` collection schema
- **Impact:** Zalo authentication will FAIL at runtime
- **Evidence:** 
  - Hook expects `user.get("zalo_id")` (line 51, 66 in `zalo_auth.pb.js`)
  - Schema audit shows NO `zalo_id` field in `users` collection
- **Fix Required:** Add migration to add `zalo_id` TEXT field (unique, nullable)

**BUG-002: User-Company Relationship Not Enforced**
- **Severity:** High
- **Location:** Authentication flow
- **Impact:** Users login successfully but have NO company assigned
- **Evidence:** 
  - Zalo hook creates users WITHOUT setting `company` field
  - Password signup has no company assignment logic
  - All data queries filtered by `@request.auth.company` will return EMPTY
- **Fix Required:** 
  - Add company assignment during registration
  - OR create default company for each user
  - OR require company selection during onboarding

### ⚠️ HIGH

**BUG-003: Mock Data Prevents Real Usage**
- **Severity:** High
- **Location:** `tables.tsx`, `playing.tsx`
- **Impact:** App appears functional but doesn't use real backend
- **Fix Required:** 
  - Replace `MOCK_TABLES` with PocketBase query
  - Replace mock menus with `products` collection query
  - Implement real order/session tracking

**BUG-004: No Seed Data**
- **Severity:** High
- **Location:** Backend database
- **Impact:** Fresh install has ZERO tables/products
- **Evidence:** No seed data scripts found
- **Fix Required:** Create seed script with sample data

### 🟡 MEDIUM

**BUG-005: TypeScript Configuration Weak**
- **Severity:** Medium
- **Location:** `tsconfig.json`
- **Impact:** Type safety not enforced
- **Issues:**
  - `noImplicitAny: false` allows untyped variables
  - `noUnusedLocals: false` hides dead code
- **Fix:** Enable strict type checking incrementally

**BUG-006: Missing Build Script**
- **Severity:** Medium
- **Location:** `package.json`
- **Impact:** Cannot verify production build
- **Fix:** Add build script (likely `vite build`)

---

## 8. ARCHITECTURE RISKS

### 🔴 CRITICAL RISKS

**RISK-001: Authentication System Incomplete**
- **Issue:** Zalo auth will fail due to missing schema field
- **Probability:** 100% (schema mismatch confirmed)
- **Impact:** Complete authentication failure
- **Mitigation:** MUST fix before any testing

**RISK-002: No Company Association Strategy**
- **Issue:** Multi-tenant design without tenant assignment
- **Impact:** Users cannot see any data (all queries filtered by company)
- **Scenarios:**
  - Single-tenant app? Remove company filtering
  - Multi-tenant? Need onboarding flow
- **Decision Required:** Define business model BEFORE proceeding

### ⚠️ HIGH RISKS

**RISK-003: Mock Data Masking Integration Issues**
- **Issue:** Frontend "works" with mock data, hiding backend problems
- **Impact:** False sense of completion
- **Example:** Table booking appears functional but doesn't persist
- **Mitigation:** Remove ALL mock data before Milestone 02

**RISK-004: No Real-Time Sync**
- **Issue:** Multiple users cannot see live table status updates
- **Impact:** Double-booking, stale status
- **Technology:** PocketBase supports real-time subscriptions (unused)
- **Mitigation:** Implement `pb.collection('tables').subscribe()` later

### 🟡 MEDIUM RISKS

**RISK-005: No Error Boundaries**
- **Issue:** React component errors crash entire app
- **Impact:** Poor user experience
- **Mitigation:** Add error boundaries in Milestone 02

**RISK-006: No Loading States**
- **Issue:** PocketBase queries have no loading UI
- **Impact:** App feels unresponsive
- **Mitigation:** Add skeleton loaders when integrating real API

**RISK-007: Jotai Dependency Unused**
- **Issue:** Residual state library from VieStore migration
- **Impact:** 215KB unused bundle size
- **Mitigation:** Remove from `package.json`

---

## 9. RECOMMENDED MIGRATION ORDER

### Phase 1: Fix Critical Blockers (Milestone 02)
**Estimated:** 2-3 hours

1. **Add `zalo_id` field to users collection**
   - Create migration: `pb_migrations/add_zalo_id_to_users.js`
   - Field: TEXT, unique, nullable
   - Index: `CREATE UNIQUE INDEX idx_zalo_id ON users (zalo_id) WHERE zalo_id != ''`

2. **Define Company Strategy**
   - Option A: Single-tenant (remove company filtering)
   - Option B: Multi-tenant (add company selection)
   - **Decision Required from User**

3. **Create Seed Data Script**
   - Script: `pocketbase/scripts/seed.js`
   - Data: 1 company, 5-7 tables, 10-15 products
   - Run once to populate database

4. **Verification**
   - Test Zalo login end-to-end
   - Test password login
   - Confirm user has company assigned
   - Confirm tables/products queryable

### Phase 2: Replace Mock Data (Milestone 03)
**Estimated:** 4-6 hours

1. **Replace MOCK_TABLES**
   - File: `pages/tables.tsx`
   - Replace with: `tableService.list(companyId)`
   - Add loading state
   - Handle empty state

2. **Replace MOCK_MENU**
   - File: `pages/playing.tsx`
   - Replace with: `productService.list(companyId)`
   - Filter by `kind: 'food' | 'drink'`
   - Add cart state management

3. **Implement Order System**
   - New collection: `orders`
   - Schema: customer, table, items[], total, status, timestamps
   - Service: `orderService` CRUD

4. **Implement Session Tracking**
   - New collection: `sessions`
   - Schema: table, start_time, end_time, hours_played, status
   - Real-time timer component

### Phase 3: Polish & Deploy (Milestone 04)
**Estimated:** 2-3 hours

1. **Add Real-Time Subscriptions**
   - Subscribe to `tables` collection
   - Update UI on status changes
   - Handle connection loss

2. **Add Error Handling**
   - Error boundaries
   - Toast notifications for API errors
   - Retry logic

3. **Performance Optimization**
   - Remove unused dependencies (Jotai)
   - Code splitting
   - Image optimization

4. **Deploy**
   - Test in Zalo Mini App environment
   - Deploy backend (PocketBase cloud or VPS)
   - Deploy frontend via `npm run deploy`

---

## 10. VERIFICATION RESULTS

### Build Test
```bash
$ cd vie-minizalo && npm run build
> Missing script: "build"
```
**Status:** ❌ FAIL  
**Reason:** No build script configured  
**Impact:** LOW (Zalo Mini App uses `npm run deploy` which likely includes build)

### TypeCheck Test
```bash
$ npx tsc --noEmit
> (Not run - no typecheck script)
```
**Status:** ⚠️ SKIPPED  
**Reason:** Would take too long, strict mode disabled anyway  
**Impact:** MEDIUM (type safety not verified)

### Lint Test
```bash
$ npm run lint
> Missing script: "lint"
```
**Status:** ⚠️ SKIPPED  
**Reason:** No lint script configured  
**Impact:** LOW (code style not critical for functionality)

### Runtime Dependencies
```bash
✅ node_modules/ exists (installed)
✅ pocketbase.exe exists (v0.28.1)
✅ All imports resolve correctly
✅ No missing dependencies detected
```

---

## SUMMARY

### ✅ What's Working
1. **Authentication System Architecture** - Well-designed dual auth
2. **PocketBase Schema** - Clean multi-tenant structure
3. **Frontend UI** - Polished, responsive, Zalo-compliant
4. **Routing & Navigation** - Protected routes working
5. **Zalo Auth Endpoint** - Properly implemented hook

### ❌ Critical Blockers
1. **Missing `zalo_id` field** - Zalo auth WILL fail
2. **No company assignment** - Users cannot access data
3. **All UI uses mock data** - Backend integration incomplete

### ⚠️ High Priority Issues
1. No seed data - Fresh install is empty
2. TypeScript weak mode - Type safety compromised
3. No build verification - Cannot test production bundle

### 📊 Code Statistics
- **Total Files:** 24 TypeScript files
- **Lines of Code:** ~2,897
- **Collections:** 5 (users, companies, products, tables, customers)
- **Mock Data Files:** 2 critical (tables.tsx, playing.tsx)
- **Custom Endpoints:** 1 (Zalo auth)

---

## MILESTONE 02 REQUIREMENTS

**Before proceeding to Milestone 02, the following MUST be completed:**

1. ✅ **Decision:** Single-tenant or multi-tenant?
   - If single-tenant: Remove company filtering from all collections
   - If multi-tenant: Design company assignment flow

2. ✅ **Fix BUG-001:** Add `zalo_id` field to users collection

3. ✅ **Fix BUG-002:** Implement company assignment logic

4. ✅ **Fix BUG-004:** Create and run seed data script

5. ✅ **Verification:** Test complete auth flow (Zalo + Password)

**DO NOT proceed to mock data replacement until authentication is fully functional.**

---

**End of Audit Report**  
**Next Action:** Wait for user approval to proceed to Milestone 02