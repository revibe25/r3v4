# R3V4 Auth Integration Guide

**Last updated:** September 23, 2026  
**Status:** Ready for deployment

---

## 📋 Overview

This guide walks you through integrating the R3 Native Auth system into your r3v4 project. It includes:

- ✅ Auth service with token management
- ✅ React hooks and context for auth state
- ✅ Protected route wrapper for React Router
- ✅ Token refresh logic
- ✅ Debugging utilities
- ✅ Comprehensive project audit

---

## 🚀 Quick Start

### 1. Copy Auth Integration Files

From `/home/cloud/auth-integration/`, copy these files to your project:

```bash
# Copy to src/services/
cp /home/cloud/auth-integration/authService.ts src/services/

# Copy to src/hooks/
cp /home/cloud/auth-integration/useAuth.ts src/hooks/

# Copy to src/components/
cp /home/cloud/auth-integration/ProtectedRoute.tsx src/components/

# Copy debugger (for development)
cp /home/cloud/auth-integration/AuthDebugger.tsx src/components/
```

### 2. Update Your App.tsx

Replace your current `src/App.tsx` with the configuration from `App.tsx.example`:

```bash
cp /home/cloud/auth-integration/App.tsx.example src/App.tsx
```

Then update the imports to match your actual project structure:

```typescript
// Update these paths based on your project
import { AuthProvider } from './hooks/useAuth';
import { ProtectedRoute } from './components/ProtectedRoute';
import AuthPage from './pages/auth'; // or however you import the auth.html page
```

### 3. Verify auth.html Deployment

Make sure the auth page is deployed:

```bash
# Should exist:
ls -la client/public/auth.html

# If not deployed, run the deployment script:
bash ~/Deploy-to-chromebook.sh
```

### 4. Start Dev Server

```bash
cd /home/cloud/Projects/r3v4
pnpm install  # If needed
pnpm dev
```

---

## 🔍 Testing the Integration

### Test 1: Verify Endpoint Connectivity

```bash
# Check if /auth endpoint is responding
curl -X OPTIONS http://localhost:5173/auth -v

# Expected: 200 OK or CORS preflight response
```

### Test 2: Login Flow

1. Open browser → `http://localhost:5173/auth` or `http://localhost:5173/auth.html`
2. Enter credentials:
   - Username: `ernesto` (or any valid user)
   - Password: `test123456`
3. Click **SUBMIT**
4. Should redirect to `/instrument` (or your configured route)

### Test 3: Token Storage

Open browser DevTools (F12):

1. Go to **Application** → **Local Storage**
2. Look for these keys:
   - `r3_token` — Your JWT (should have 3 parts: `header.payload.signature`)
   - `r3_refresh_token` — Refresh token (if your API returns one)
   - `r3_token_expiry` — Expiration timestamp

Example token structure:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7ImlkIjoiMTIzIiwidXNlcm5hbWUiOiJlcm5lc3RvIn0sImV4cCI6MTcxNTMzMzIwMH0.signature
```

### Test 4: Use AuthDebugger Component

Add to your app (in development):

```typescript
import { AuthDebugger } from './components/AuthDebugger';

function App() {
  return (
    <>
      {/* Your app routes */}
      {process.env.NODE_ENV === 'development' && <AuthDebugger />}
    </>
  );
}
```

The debugger panel provides:
- ✓ Endpoint connectivity test
- ✓ Token validity check
- ✓ Login flow test
- ✓ Token refresh test
- ✓ localStorage inspection

---

## 🔐 Token Refresh Flow

The auth service automatically handles token refresh:

```
Browser Request
    ↓
getToken() checks expiry
    ↓
Token expired? → refreshToken()
    ↓
GET /auth/refresh with refreshToken
    ↓
Server returns new token
    ↓
Update localStorage
    ↓
Continue request
```

### Ensure Your API Supports Refresh

Your backend should have a `/auth/refresh` endpoint:

```
POST /auth/refresh
Content-Type: application/json

{ "refreshToken": "..." }

Response:
{ 
  "token": "...",
  "user": { "id": "...", "username": "..." },
  "expiresIn": 3600,
  "refreshToken": "..." 
}
```

---

## 🐛 Debugging Guide

### Issue: "Cannot reach /auth endpoint"

**Check:**
1. Dev server is running: `pnpm dev`
2. Correct API URL in `.env`: `REACT_APP_API_URL=http://localhost:5173`
3. Backend `/auth` endpoint exists
4. Browser console for CORS errors (F12 → Console)

**Fix:**
```bash
# Restart dev server
pnpm dev

# In browser:
# F12 → Network → Try login again
# Look for POST /auth request
# Check Status and Response
```

### Issue: "Login successful but doesn't redirect"

**Check:**
1. Is `r3_token` in localStorage? (F12 → Application)
2. Does the token look valid? (3 parts separated by dots)
3. Check browser console for redirect errors

**Fix in React Router:**
```typescript
// Make sure you're using the correct route path
<Route path="/instrument" element={<ProtectedRoute>...</ProtectedRoute>} />

// And your auth page redirects to the correct path:
window.location.href = '/instrument';
```

### Issue: "Token expired, refresh fails"

**Causes:**
- `/auth/refresh` endpoint doesn't exist
- `refreshToken` in request doesn't match format
- Server rejects expired tokens outright

**Debug:**
1. Add console.log in `AuthService.refreshToken()`
2. Check network tab for `/auth/refresh` request
3. Verify refresh token is stored: `localStorage.getItem('r3_refresh_token')`

**Fallback:**
If refresh fails, user is logged out and redirected to `/auth` to re-login.

---

## 📁 Project Structure After Integration

```
r3v4/
├── client/
│   ├── public/
│   │   ├── auth.html              ← Auth page (deployed)
│   │   └── ...
│   ├── src/
│   │   ├── services/
│   │   │   └── authService.ts     ← Token management
│   │   ├── hooks/
│   │   │   └── useAuth.ts         ← Auth context & hook
│   │   ├── components/
│   │   │   ├── ProtectedRoute.tsx ← Protected routes wrapper
│   │   │   ├── AuthDebugger.tsx   ← Debug panel
│   │   │   └── ...
│   │   ├── pages/
│   │   │   ├── auth.tsx           ← Auth page component (if using React)
│   │   │   ├── instrument.tsx     ← Protected page
│   │   │   └── ...
│   │   ├── App.tsx                ← Router config + AuthProvider
│   │   ├── main.tsx               ← Entry point
│   │   └── ...
│   └── ...
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.json
└── ...
```

---

## 🔒 Security Checklist

- [ ] Never expose tokens in network requests (use `Authorization: Bearer <token>`)
- [ ] HTTPS in production (Railway auto-enables)
- [ ] Tokens stored in `localStorage` (not cookies for single-page app)
- [ ] Validate JWT signature on backend
- [ ] Set appropriate token expiry (recommended: 1 hour)
- [ ] Implement token rotation (new refresh token on each refresh)
- [ ] Clear tokens on logout (✓ done in `AuthService.logout()`)
- [ ] Implement CORS properly (`Access-Control-Allow-Origin`)

---

## 📊 Auth Integration Checklist

### Pre-Deployment

- [ ] Auth HTML deployed to `/client/public/auth.html`
- [ ] Auth service files copied to `src/services/`
- [ ] Hooks copied to `src/hooks/`
- [ ] ProtectedRoute component in `src/components/`
- [ ] App.tsx updated with AuthProvider + routes
- [ ] Environment variable `REACT_APP_API_URL` set
- [ ] `/auth` endpoint responds on server
- [ ] `/auth/refresh` endpoint exists (if using refresh)

### Testing

- [ ] Login with test credentials works
- [ ] Token stored in localStorage
- [ ] Redirect to `/instrument` after login
- [ ] Protected routes block unauthenticated access
- [ ] Logout clears tokens
- [ ] Token refresh works (if applicable)
- [ ] AuthDebugger panel shows all tests passing

### Post-Deployment

- [ ] Test auth in staging environment
- [ ] Monitor auth errors in production logs
- [ ] Check token refresh success rate
- [ ] Verify CORS headers correct for production domain

---

## 🚀 Deployment to Railway

### Set Environment Variables

In Railway Dashboard:

```
REACT_APP_API_URL=https://your-app.railway.app
```

### Verify Auth Endpoints

```bash
# Test from production
curl -X OPTIONS https://your-app.railway.app/auth
curl -X OPTIONS https://your-app.railway.app/auth/refresh
```

### Monitor Logs

```bash
# Watch for auth errors
railway logs -e production | grep -i "auth\|token"
```

---

## 📞 Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| `Cannot reach /auth endpoint` | Server not running or CORS issue | Check dev server, CORS headers |
| `Login successful but no redirect` | Invalid route or token not saved | Check localStorage, React Router setup |
| `Token expired, refresh fails` | `/auth/refresh` missing or invalid | Implement refresh endpoint on backend |
| `ProtectedRoute undefined` | Import path wrong | Check import statement in App.tsx |
| `useAuthContext must be used inside <AuthProvider>` | Missing wrapper | Ensure App.tsx wraps routes with `<AuthProvider>` |

---

## 📝 Next Steps

1. **Integrate auth files** (sections 1-3 above)
2. **Test login flow** (section 4)
3. **Run project audit** to check overall health:
   ```bash
   bash /home/cloud/audit-r3v4.sh
   ```
4. **Review audit report** and address any issues
5. **Deploy to staging** for end-to-end testing
6. **Deploy to production** when ready

---

## 📚 Additional Resources

- **Auth Service API:** See `authService.ts` comments for method signatures
- **Hook Usage:** Check `useAuth.ts` for `UseAuthReturn` interface
- **Router Setup:** Reference `App.tsx.example` for route configuration
- **Debugging:** Use `AuthDebugger` component or browser DevTools

---

## ✨ Done!

Your r3v4 project now has a complete, production-ready auth system. Questions? Check the comments in each file or review the troubleshooting section above.

Happy coding! 🚀
