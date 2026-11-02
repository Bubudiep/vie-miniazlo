# Zalo Token Format Fix

## Issue Discovered

Từ console logs:
```
[Zalo Auth] Token result: "05anIeaAmqu5Mp53ZGZ0HWDHCKcD7yyyLpfcJhuHqa99FIPEXXEE7tyzU42sCEX4..."
[Zalo Auth] Got access token: NO
```

**Problem:** `getAccessToken()` trả về **plain string** thay vì object có property `accessToken`.

## Root Cause

Zalo SDK `getAccessToken()` có thể trả về 2 formats:
1. **Object**: `{ accessToken: "..." }` (old API)
2. **String**: `"token_string"` (new API hoặc environment-specific)

Code cũ chỉ handle format 1 → Fail khi SDK trả format 2.

## Fix Applied

**File:** `vie-minizalo/src/api/zaloAuth.ts`

```typescript
// OLD CODE (fails with string response)
const { accessToken } = await getAccessToken({});

// NEW CODE (handles both formats)
const tokenResult = await getAccessToken({});

let accessToken: string | undefined;

if (typeof tokenResult === 'string') {
  // Token returned as plain string
  accessToken = tokenResult;
} else if (tokenResult && typeof tokenResult === 'object') {
  // Token returned as object with accessToken property
  accessToken = (tokenResult as any).accessToken;
}
```

## Expected Result After Fix

Console logs should show:
```
[Zalo Auth] Starting authentication...
[Zalo Auth] Requesting user authorization...
[Zalo Auth] Authorization result: {scope.userInfo: true, scope.userPhonenumber: true}
[Zalo Auth] Getting access token...
[Zalo Auth] Token result: "05anIeaAmqu5..."
[Zalo Auth] Token format: plain string
[Zalo Auth] Got access token: YES  ← FIXED!
[Zalo Auth] Token length: 272
[Zalo Auth] Sending to PocketBase: http://...
[Zalo Auth] Response status: 200
[Zalo Auth] Success! User: zalo_xxxxx
```

## About "extend-mini-app-index-jumped: v4"

Đây là **warning** từ Zalo về routing/navigation, không ảnh hưởng login flow:
- Xảy ra khi app navigate giữa các pages
- Không block authentication
- Có thể ignore nếu app vẫn hoạt động bình thường

Nếu muốn fix:
1. Check routing config trong app
2. Đảm bảo không có duplicate navigation calls
3. Use Zalo's navigation APIs (`zmp-sdk`) thay vì `react-router`

## Deploy Instructions

```bash
cd vie-minizalo
npm run deploy
```

Test lại trong Zalo app và check console logs.

## Testing Checklist

- [x] `getAccessToken()` returns token
- [x] Code handles string format
- [x] Code handles object format
- [ ] Backend receives token successfully
- [ ] User created in PocketBase
- [ ] User can access app after login

## Next Issue to Fix (If Occurs)

Nếu sau khi có token vẫn lỗi, check:

1. **Backend connectivity**
   ```
   [Zalo Auth] Sending to PocketBase: http://127.0.0.1:8390/api/zalo/auth
   [Zalo Auth] Response status: ???
   ```
   
   - If status 0: Backend không accessible (CORS, network)
   - If status 400: Token invalid hoặc Zalo API issue
   - If status 500: Backend error

2. **PocketBase URL**
   - Local: `http://127.0.0.1:8390` chỉ work nếu test trong browser
   - Production: Cần deploy backend hoặc dùng ngrok

## Files Changed

1. ✅ `vie-minizalo/src/api/zaloAuth.ts` - Handle both token formats
2. ✅ `vie-minizalo/app-config.json` - Added permissions
3. ✅ Documentation created

---

**Status:** READY TO TEST
**Last Updated:** 2026-10-13
