# Auth Integration Testing Checklist

**Status:** Pre-Integration  
**Date:** September 23, 2026

---

## Phase 1: Setup Verification

- [ ] Auth HTML deployed: `client/public/auth.html` exists
- [ ] Auth service file: `src/services/authService.ts` exists
- [ ] Auth hook file: `src/hooks/useAuth.ts` exists
- [ ] ProtectedRoute file: `src/components/ProtectedRoute.tsx` exists
- [ ] App.tsx updated with AuthProvider
- [ ] Dev server running: `pnpm dev`
- [ ] No TypeScript errors: `pnpm type-check` passes

---

## Phase 2: Endpoint Testing

### 2.1 Server Health Check

```bash
# Test if dev server is running
curl http://localhost:5173/health 2>&1

# Expected: 200 OK or health status
```

- [ ] Dev server responds to requests

### 2.2 Auth Endpoint

```bash
# Test OPTIONS (CORS preflight)
curl -X OPTIONS http://localhost:5173/auth -v

# Expected: 200 or 204 with CORS headers
```

- [ ] `/auth` endpoint responds to OPTIONS
- [ ] CORS headers present (`Access-Control-Allow-Origin`)
- [ ] `Access-Control-Allow-Methods` includes POST

### 2.3 Endpoint Connectivity via Browser

1. Open browser DevTools: F12
2. Go to Console tab
3. Run:
   ```javascript
   fetch('http://localhost:5173/auth', { method: 'OPTIONS' })
     .then(r => console.log('Status:', r.status, r.statusText))
     .catch(e => console.error('Error:', e.message))
   ```

- [ ] Response logged (no CORS errors)
- [ ] No "blocked by CORS policy" message

---

## Phase 3: Login Flow Testing

### 3.1 Manual Login Test

1. Navigate to `http://localhost:5173/auth.html`
2. You should see:
   - [ ] Login form rendered
   - [ ] "R3 / NATIVE" header visible
   - [ ] Username/credential input field
   - [ ] Password input field
   - [ ] SUBMIT button

### 3.2 Test with Valid Credentials

1. Enter: `ernesto` (or known valid username)
2. Enter: `test123456` (or correct password)
3. Click **SUBMIT**
4. Expected behavior:
   - [ ] Form disables (shows loading state)
   - [ ] No error message appears
   - [ ] Page redirects to `/instrument` (or configured route)
   - [ ] URL bar shows new route

### 3.3 Test with Invalid Credentials

1. Enter: `invalid_user`
2. Enter: `wrongpassword`
3. Click **SUBMIT**
4. Expected behavior:
   - [ ] Error message appears
   - [ ] Message indicates auth failure
   - [ ] User stays on `/auth` page
   - [ ] Can retry login

---

## Phase 4: Token Storage Verification

### 4.1 Check localStorage After Login

1. Successfully login (Phase 3.2)
2. Open DevTools: F12
3. Go to **Application** → **Local Storage** → `http://localhost:5173`
4. Verify these keys exist:

- [ ] `r3_token` exists
- [ ] `r3_token` value is not empty
- [ ] `r3_token` contains 3 parts (format: `xxx.yyy.zzz`)
- [ ] `r3_token_expiry` exists (timestamp in ms)
- [ ] `r3_refresh_token` exists (if applicable)

### 4.2 Decode Token Payload

1. Copy value of `r3_token`
2. Go to https://jwt.io
3. Paste token in "Encoded" section
4. Verify payload contains:
   - [ ] `user` object with `id` and `username`
   - [ ] `exp` field (expiration time)
   - [ ] Signature validates (or shows "Signature Verified")

### 4.3 Check Expiry Calculation

1. Get `r3_token_expiry` value from localStorage
2. Convert to date: `new Date(parseInt(value))`
3. Verify:
   - [ ] Expiry is in the future
   - [ ] Expiry matches `exp` in JWT payload

---

## Phase 5: Protected Routes Testing

### 5.1 Access Protected Route When Authenticated

1. Login successfully (Phase 3.2)
2. Navigate to protected route: `http://localhost:5173/instrument`
3. Expected:
   - [ ] Page loads without redirect
   - [ ] Content is displayed
   - [ ] No redirect to `/auth`

### 5.2 Access Protected Route When Not Authenticated

1. Open new browser window (not logged in)
2. Navigate directly to: `http://localhost:5173/instrument`
3. Expected:
   - [ ] Immediately redirects to `/auth`
   - [ ] URL shows `/auth` route
   - [ ] Login page displayed

### 5.3 Try to Access with Cleared Tokens

1. Go to **Application** → **Local Storage**
2. Delete `r3_token` key (right-click → Delete)
3. Refresh page
4. Expected:
   - [ ] Page redirects to `/auth`
   - [ ] Protected content not accessible

---

## Phase 6: Token Refresh Testing

### 6.1 Setup for Refresh Test

1. Successfully login
2. Note the original token value (copy first 20 chars): `r3_token` = `eyJ...`

### 6.2 Wait for Token to Expire (or Force Refresh)

Option A (actual expiry — may take hours):
- Skip to end of testing

Option B (force expiry for testing):
1. Open DevTools Console
2. Run:
   ```javascript
   // Set expiry to 1 second from now
   localStorage.setItem('r3_token_expiry', (Date.now() + 1000).toString());
   ```
3. Wait 2 seconds
4. Try to make an authenticated request (e.g., fetch to protected API endpoint)

### 6.3 Verify Refresh

After expiry:
- [ ] Old token value != new token value
- [ ] New token stored in `r3_token`
- [ ] New expiry time in `r3_token_expiry`
- [ ] Request succeeds after refresh
- [ ] No redirect to `/auth`

---

## Phase 7: Logout Testing

### 7.1 Test Logout Functionality

1. Login successfully (Phase 3.2)
2. Verify tokens in localStorage
3. Click logout button (or call `AuthService.logout()`)
4. Expected:
   - [ ] `r3_token` removed from localStorage
   - [ ] `r3_refresh_token` removed
   - [ ] `r3_token_expiry` removed
   - [ ] Redirects to `/auth` (if using logout component)

### 7.2 Verify Logout Persistence

1. Refresh page after logout
2. Expected:
   - [ ] Still on `/auth` page
   - [ ] No tokens in localStorage
   - [ ] Cannot access protected routes

---

## Phase 8: Auth Debugger Testing

### 8.1 Enable Debugger Component

1. Add to your app:
   ```typescript
   import { AuthDebugger } from './components/AuthDebugger';
   
   <AuthDebugger /> {/* Add near root of app */}
   ```
2. Look for 🐛 button in bottom-right corner

- [ ] Debug panel appears
- [ ] Can click to open/close

### 8.2 Run All Tests in Debugger

1. Click 🐛 button
2. Click "▶ Run All Tests"
3. Review results:

- [ ] ✓ Endpoint Connectivity: PASS
- [ ] ✓ localStorage: PASS
- [ ] ✓ Token Validity: PASS (or FAIL if expired is expected)
- [ ] ✓ Login Flow: PASS
- [ ] ✓ Token Refresh: PASS (if refresh token available)

### 8.3 Test Individual Components

From debugger, test:

- [ ] Click "Endpoint" button — shows connectivity status
- [ ] Click "Token" button — shows token validity
- [ ] Click "Clear" button — clears results
- [ ] Enter test credentials and test login manually

---

## Phase 9: Error Handling Testing

### 9.1 Network Error Handling

1. Disconnect internet (or use DevTools throttling)
2. Try to login
3. Expected:
   - [ ] Error message appears
   - [ ] Says "offline" or "network error"
   - [ ] Can retry when connection restored

### 9.2 Invalid Response Handling

1. (Dev only) Mock an invalid server response
2. Try to login
3. Expected:
   - [ ] Error message displayed
   - [ ] Tells user what failed
   - [ ] Can retry

### 9.3 CORS Error Handling

1. (Dev only) Set `REACT_APP_API_URL` to wrong domain
2. Try to login
3. Expected:
   - [ ] CORS error visible in browser console
   - [ ] Error message shown to user
   - [ ] Indicates cross-origin issue

---

## Phase 10: Browser DevTools Network Inspection

### 10.1 Login Request

1. Open DevTools: F12
2. Go to **Network** tab
3. Login with valid credentials
4. Find POST request to `/auth`
5. Verify:

- [ ] Request URL: `POST http://localhost:5173/auth`
- [ ] Request Headers include:
  - [ ] `Content-Type: application/json`
  - [ ] Body: `{"credential":"...","password":"..."}`
- [ ] Response Status: 200
- [ ] Response body includes:
  - [ ] `token`
  - [ ] `user` object
  - [ ] `expiresIn` (optional)
  - [ ] `refreshToken` (optional)

### 10.2 Refresh Request (if applicable)

1. Force token expiry (see Phase 6)
2. Make a request to protected endpoint
3. Find POST request to `/auth/refresh`
4. Verify:

- [ ] Request URL: `POST http://localhost:5173/auth/refresh`
- [ ] Request body: `{"refreshToken":"..."}`
- [ ] Response Status: 200
- [ ] Response includes new token

---

## Phase 11: React Rendering Verification

### 11.1 Check useAuth Hook

1. Add debug component to verify hook works:
   ```typescript
   function DebugAuth() {
     const { user, isAuthenticated, token } = useAuthContext();
     return (
       <div>
         {isAuthenticated ? (
           <p>Logged in as: {user?.username}</p>
         ) : (
           <p>Not authenticated</p>
         )}
       </div>
     );
   }
   ```

- [ ] Component renders without errors
- [ ] Shows correct auth status
- [ ] Updates after login
- [ ] Updates after logout

### 11.2 Check ProtectedRoute

1. Verify protected route behavior:
   - [ ] Authenticated user can access
   - [ ] Unauthenticated user redirected
   - [ ] Redirect happens without console errors

---

## Phase 12: Full Integration Test

### 12.1 Complete User Journey

1. Start on homepage (`/`)
2. Navigate to protected route
3. Get redirected to `/auth`
4. Enter credentials and login
5. Get redirected back to protected route
6. See content
7. Logout
8. Try to access protected route again
9. Get redirected to `/auth`

Verify at each step:
- [ ] Navigation works correctly
- [ ] No console errors
- [ ] No TypeScript warnings
- [ ] Page layout/styling correct
- [ ] Auth flows as expected

---

## Phase 13: Performance Testing

### 13.1 Check Bundle Size

```bash
# Should still be reasonable
du -h client/dist/
```

- [ ] Build completes without errors
- [ ] Bundle size is acceptable

### 13.2 Check Login Performance

1. Open DevTools: F12
2. Go to **Performance** tab
3. Click Record
4. Login
5. Stop recording
6. Check:

- [ ] Total time < 2 seconds
- [ ] No long tasks (red bars)
- [ ] Smooth rendering

---

## Phase 14: Cross-Browser Testing

Test on:

- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari (if available)
- [ ] Edge (if available)

Verify:
- [ ] Login works on all browsers
- [ ] localStorage works
- [ ] No console errors
- [ ] Styling looks correct

---

## Phase 15: Production Readiness

### 15.1 Environment Variables

- [ ] `REACT_APP_API_URL` set correctly
- [ ] No hardcoded localhost URLs in production build
- [ ] Environment variables validated at startup

### 15.2 Error Logging

- [ ] Auth errors logged for monitoring
- [ ] No sensitive data in logs (tokens, passwords)
- [ ] Error format consistent

### 15.3 Documentation

- [ ] INTEGRATION_GUIDE.md reviewed
- [ ] API endpoint documentation up to date
- [ ] Team aware of auth flow

---

## Sign-Off

- [ ] All tests passed
- [ ] No critical issues remaining
- [ ] Code reviewed
- [ ] Ready for deployment

**Tester Name:** ________________  
**Date:** ________________  
**Sign-Off:** ________________

---

## Notes

Use this section for observations, issues, or additional testing notes:

```
[Your notes here]
```

---

**Test Complete!** 🎉
