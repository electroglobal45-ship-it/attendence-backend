# 🔐 Backend Security Guide — Production Deployment

> **Specific to:** Express 5 · Supabase · Socket.IO · AES-256-GCM Vault · Google Drive OAuth  
> **Stack:** Node.js / TypeScript · Render (hosting)  
> **Last updated:** June 2026

---

## 1. 🔴 CRITICAL — SSL Verification Disabled in `server.ts`

### ⚠️ Current state (DANGEROUS if leaks to production)

In [`src/server.ts`](./src/server.ts):

```ts
if (process.env.NODE_ENV === 'development') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
}
```

This disables TLS certificate verification — meaning Node.js will accept **any** certificate, including fake ones. If this ever runs in production (e.g., `NODE_ENV` is not set), all outgoing HTTPS calls (Supabase, Google APIs) are vulnerable to man-in-the-middle attacks.

### ✅ What to verify

On **Render**, make sure the environment variable is set:
```
NODE_ENV=production
```

This is the guard that keeps the `NODE_TLS_REJECT_UNAUTHORIZED = '0'` line from running. Without it, that flag is applied globally to all HTTPS connections your server makes.

> **Never** remove the `if (process.env.NODE_ENV === 'development')` guard.

---

## 2. 🔴 CRITICAL — Rate Limiting Is Disabled

### ⚠️ Current state

In [`src/app.ts`](./src/app.ts):

```ts
// Rate limiting disabled for internal use
// const limiter = rateLimit({ ... })
// app.use('/api', limiter)
```

Without rate limiting, the following attacks are trivially easy:
- **Brute-force login** — unlimited password attempts on `/api/v1/auth/login`
- **Token enumeration** — unlimited refresh-token requests
- **API abuse** — spamming any endpoint at high volume

### ✅ What to enable for production

Uncomment and configure rate limiting in `app.ts`. Use a tiered approach — stricter on auth, looser on general API:

```ts
import rateLimit from 'express-rate-limit'

// Strict rate limit for auth routes — 10 attempts per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// General API rate limit — 300 requests per 15 minutes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// Apply in app.ts — BEFORE route definitions
app.use('/api/v1/auth/login', authLimiter)
app.use('/api/v1/auth/refresh', authLimiter)
app.use('/api', apiLimiter)
```

> **Note:** `express-rate-limit` is already in your `package.json` — just needs to be turned on.

---

## 3. 🔴 CRITICAL — CORS Is Single-Origin But Socket.IO Uses a Different Env Var

### ⚠️ Current mismatch

`app.ts` reads `CORS_ORIGIN`:
```ts
origin: process.env.CORS_ORIGIN || 'http://localhost:3000'
```

`socket-server.ts` reads `FRONTEND_URL`:
```ts
origin: process.env.FRONTEND_URL || 'http://localhost:3000'
```

These are **two different variables**. If you only set `CORS_ORIGIN` on Render and forget `FRONTEND_URL`, Socket.IO will fall back to `http://localhost:3000` — meaning WebSocket connections from your production frontend will be rejected with a CORS error.

### ✅ Fix

On **Render**, set **both**:
```
CORS_ORIGIN=https://your-app.vercel.app
FRONTEND_URL=https://your-app.vercel.app
```

Or better — consolidate in code. In `socket-server.ts`, change:
```ts
// Change this:
origin: process.env.FRONTEND_URL || 'http://localhost:3000',

// To this (uses the same var as app.ts):
origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
```

Then you only need to set one variable.

---

## 4. 🟠 IMPORTANT — Morgan Logging Leaks Internal Paths in Production

### ⚠️ Current state

In `app.ts`:
```ts
app.use(morgan('dev'))
```

`morgan('dev')` logs colorised request details including full URL paths to stdout. On **Render**, this appears in public-viewable logs and includes:
- All endpoint paths
- Response status codes and timing
- Query parameters (which may contain IDs or filter data)

### ✅ Fix

Switch to `combined` format in production (industry-standard Apache Combined Log Format):

```ts
// In app.ts
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))
```

`combined` logs are still useful for debugging but avoid the coloured verbose output of `dev` mode. Never use `dev` in production.

---

## 5. 🟠 IMPORTANT — Health Endpoint Leaks Environment Info

### ⚠️ Current state

In `app.ts`:
```ts
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV   // ← exposed
  })
})
```

Exposing `NODE_ENV` gives attackers a confirmation signal — they know which code paths are active (e.g., the SSL bypass or stack traces in errors).

### ✅ Fix

Remove internal details from the public health check:

```ts
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
  })
})
```

---

## 6. 🟠 IMPORTANT — Body Size Limit Is Too Large

### ⚠️ Current state

```ts
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
```

A 10 MB JSON body limit is extremely generous for most of your API endpoints (login, attendance, tasks). This can be exploited for:
- **Memory exhaustion** — sending 10 MB payloads to crash or slow the server
- **ReDoS** — large payloads combined with regex-heavy validation

### ✅ Fix

Use a small default limit and only increase it where needed (file uploads):

```ts
// Default: 50KB for JSON APIs
app.use(express.json({ limit: '50kb' }))
app.use(express.urlencoded({ extended: true, limit: '50kb' }))

// For file upload routes only, use multer with its own size limit
// (already set via MAX_FILE_SIZE env var in your multer config)
```

The only routes that need large bodies are file uploads (Drive), and those already go through `multer` with `MAX_FILE_SIZE=5242880` — not through `express.json()`.

---

## 7. 🟠 IMPORTANT — Vault Routes Missing `requireAdmin` Guard

### ⚠️ Current state

In [`src/modules/vault/vault.routes.ts`](./src/modules/vault/vault.routes.ts):

```ts
// Create a vault entry (admin or employee)
router.post('/', (req, res) => vaultController.createEntry(req, res))

// Delete vault entry (admin or owner employee)
router.delete('/:id', (req, res) => vaultController.deleteEntry(req, res))

// Update vault entry (admin or owner employee)
router.put('/:id', (req, res) => vaultController.updateEntry(req, res))
```

These three routes have `authenticate` (from `router.use(authenticate)`) but **no role guard**. Any authenticated employee can create, update, or delete vault entries — including entries they don't own. The comments say "admin or owner employee" but that ownership check is **not enforced at the route level**.

### ✅ Fix

For `POST /` (create) — only admins should create vault entries (they assign to employees):
```ts
router.post('/', requireAdmin, (req, res) => vaultController.createEntry(req, res))
```

For `DELETE /:id` and `PUT /:id` — either enforce `requireAdmin` at the route level, or verify ownership inside the controller/service. If ownership is already checked in the service layer, add a comment confirming it. Otherwise:
```ts
router.delete('/:id', requireAdmin, (req, res) => vaultController.deleteEntry(req, res))
router.put('/:id', requireAdmin, (req, res) => vaultController.updateEntry(req, res))
```

---

## 8. 🟠 IMPORTANT — Drive OAuth Callback Has No CSRF State Validation

### ⚠️ Current state

In [`src/modules/drive/drive.routes.ts`](./src/modules/drive/drive.routes.ts):

```ts
// OAuth callback (handle Google redirect)
router.get('/auth/callback', driveController.handleCallback.bind(driveController))
```

This route has **no `authenticate` middleware** and accepts any `state` + `code` combination from Google. The `state` parameter is used to identify the user, but if it's just the user ID (a UUID), an attacker who knows a user's UUID could construct a malicious OAuth callback.

### ✅ Fix

The backend should:
1. When generating the OAuth URL, create a random `state` token (e.g., `crypto.randomUUID()`) and store it (in Supabase) mapped to the userId + expiry.
2. When the callback arrives, look up the `state` token in Supabase and verify it's valid and not expired before exchanging the code.

Check what `state` value is currently being passed in `drive.controller.ts` → `getAuthUrl()` and verify this is not just the raw userId.

---

## 9. 🟡 MEDIUM — Scratch/Test Files Should Not Be Deployed

### ⚠️ Current state

In `src/`:
```
src/scratch_db_query.ts
src/test-attachment-upload.ts
src/test-db.ts
src/test-update-labels.ts
src/test_exec_sql.ts
```

These files exist in the source tree. When your TypeScript compiles (`npm run build`), they may be included in `dist/` and deployed to Render.

### ✅ Fix

Add them to `.gitignore` **or** add them to `tsconfig.json`'s `exclude` list:

```json
// tsconfig.json
{
  "exclude": [
    "node_modules",
    "dist",
    "src/scratch_db_query.ts",
    "src/test-*.ts",
    "src/test_*.ts"
  ]
}
```

Even better — move them to a `/scratch` folder outside `src/` that is already `.gitignore`d.

---

## 10. 🟡 MEDIUM — Error Handler Exposes Stack Traces Check

### ✅ Current state (good, but verify)

In [`src/middleware/error.middleware.ts`](./src/middleware/error.middleware.ts):

```ts
res.status(statusCode).json({
  error: message,
  ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
})
```

This is correctly gated on `NODE_ENV === 'development'`. Stack traces are NOT sent in production — as long as `NODE_ENV=production` is set on Render (see Section 1).

> ✅ No code change needed — just ensure `NODE_ENV=production` on Render.

---

## 11. 🟡 MEDIUM — Supabase `supabaseAdmin` Used Everywhere

### ⚠️ Current state

Throughout your services, `supabaseAdmin` (service role — bypasses all RLS) is used for nearly every DB call. This is fine for operations that genuinely need it, but creates a large attack surface:
- Any bug in your controller/service logic could expose data from any user because RLS won't save you
- Your security perimeter is entirely the Node.js application layer

### ✅ Mitigation (you're already doing this — just verify)

- All routes are protected by `authenticate` middleware ✅
- Role checks (`requireAdmin`, `requireAdminOrHR`, etc.) are applied ✅
- The Vault service double-checks ownership on `revealPassword` before returning the plaintext ✅

**What to add:** Make sure every service method that fetches data for a specific user has a `.eq('user_id', userId)` or similar filter — do not rely solely on role checks at the route level.

---

## 12. ✅ What's Already Secure (No Changes Needed)

| Item | Status | Details |
|---|---|---|
| `helmet()` applied | ✅ Good | All security headers set globally |
| AES-256-GCM encryption | ✅ Strong | Correct algorithm, random IV per encryption, GCM auth tag |
| bcrypt with pepper | ✅ Strong | 12 rounds + server-side pepper on vault passwords |
| `ENCRYPTION_KEY` validated | ✅ Good | Throws at startup if key is missing or wrong length |
| `VAULT_PEPPER` validated | ✅ Good | Throws at startup if missing |
| Socket.IO auth middleware | ✅ Good | JWT verified before any socket events can fire |
| `is_active` check on login | ✅ Good | Inactive users are blocked at `getUserFromToken` |
| CORS is not wildcard | ✅ Good | Scoped to `CORS_ORIGIN` env var |
| Error stack hidden in prod | ✅ Good | Gated on `NODE_ENV` |
| `supabaseAdmin` not exposed | ✅ Good | Service key never sent to client |

---

## 13. Render Dashboard — Required Environment Variables

Set all of these in **Render → Service → Environment**:

```
NODE_ENV=production
PORT=5000

SUPABASE_URL=https://...supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...

GOOGLE_CLIENT_ID=726878...
GOOGLE_CLIENT_SECRET=GOCSPX-...
GOOGLE_REDIRECT_URI=https://attendence-backend-k951.onrender.com/api/v1/drive/auth/callback

CORS_ORIGIN=https://your-app.vercel.app
FRONTEND_URL=https://your-app.vercel.app

ENCRYPTION_KEY=<64-char hex>
VAULT_PEPPER=<64-char hex>

MAX_FILE_SIZE=5242880
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/jpg,application/pdf
```

> **Do NOT commit `.env` to git.** Verify `.gitignore` contains `.env`.

---

## 14. Pre-Deployment Checklist

Work through this before every production deployment:

- [ ] `NODE_ENV=production` set on Render
- [ ] `CORS_ORIGIN` and `FRONTEND_URL` both point to Vercel URL
- [ ] `GOOGLE_REDIRECT_URI` points to Render URL
- [ ] Rate limiting re-enabled (Section 2)
- [ ] `morgan('dev')` changed to `morgan('combined')` in production (Section 4)
- [ ] Health endpoint no longer returns `environment` field (Section 5)
- [ ] Body size limit reduced to `50kb` (Section 6)
- [ ] Vault `POST /`, `DELETE /:id`, `PUT /:id` routes have role guards (Section 7)
- [ ] Drive OAuth callback has CSRF state validation (Section 8)
- [ ] Test files excluded from `tsconfig.json` (Section 9)
- [ ] `.env` is in `.gitignore` and not pushed to GitHub

---

## 15. Priority Order

| Priority | Section | Item | Effort |
|---|---|---|---|
| 🔴 P0 | #1 | Verify `NODE_ENV=production` on Render | 2 min |
| 🔴 P0 | #2 | Re-enable rate limiting | 15 min |
| 🔴 P0 | #3 | Set `FRONTEND_URL` + `CORS_ORIGIN` on Render | 2 min |
| 🟠 P1 | #4 | Switch morgan to `combined` in production | 5 min |
| 🟠 P1 | #5 | Remove `environment` from health endpoint | 2 min |
| 🟠 P1 | #6 | Reduce body size limit to 50kb | 5 min |
| 🟠 P1 | #7 | Add `requireAdmin` to vault create/update/delete routes | 5 min |
| 🟠 P1 | #8 | Add CSRF state validation to Drive OAuth | 30 min |
| 🟡 P2 | #9 | Exclude test files from tsconfig / gitignore | 5 min |
