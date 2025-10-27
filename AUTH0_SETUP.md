# Auth0 + JWT Backend Setup

## Quick Setup Steps

### 1. Create Auth0 API

1. Go to Auth0 Dashboard → Applications → APIs
2. Click "+ Create API"
3. Set:
   - Name: `Innogate API`
   - Identifier: `https://api.innogate.local` (can be any URL-like string)
   - Signing Algorithm: `RS256`
4. Click "Create"

### 2. Configure Environment Variables

**Frontend** (`innogate/.env`):
```
VITE_AUTH0_DOMAIN=your-tenant.auth0.com
VITE_AUTH0_CLIENT_ID=your-spa-client-id
VITE_AUTH0_AUDIENCE=https://api.innogate.local
```

**Backend** (`server/.env`):
```
OPENROUTER_KEY=your-openrouter-key
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=https://api.innogate.local
```

### 3. Test

1. Start backend: `cd server && npm run dev`
2. Start frontend: `cd innogate && npm run dev`
3. Login and send a chat message
4. Check backend logs for "✅ Auth0 JWT verification enabled"

### How It Works

- User logs in via Auth0 → gets JWT access token
- Frontend automatically includes token in API requests
- Backend verifies JWT signature using Auth0's public keys
- If token is valid, request proceeds; otherwise returns 401

### Optional: Disable Auth

To run without auth (development only), don't set `AUTH0_DOMAIN` or `AUTH0_AUDIENCE` in backend `.env`.

---

## Add Email Custom Claim

**REQUIRED:** To access user email in backend routes, add a custom claim in Auth0.

### Steps:

1. Go to Auth0 Dashboard → **Actions** → **Flows** → **Login**
2. Click **+ Custom** to create a new Action
3. Name it: "Add Email to Access Token"
4. Add this code:

```javascript
/**
* Handler that will be called during the execution of a PostLogin flow.
*
* @param {Event} event - Details about the user and the context in which they are logging in.
* @param {PostLoginAPI} api - Interface whose methods can be used to change the behavior of the login.
*/
exports.onExecutePostLogin = async (event, api) => {
  // Add email as a namespaced custom claim to the access token
  if (event.user.email) {
    api.accessToken.setCustomClaim('https://innogate.app/email', event.user.email);
  }
};
```

5. Click **Deploy**
6. Go back to the **Login** flow
7. Drag your new Action into the flow (between "Start" and "Complete")
8. Click **Apply**

### Verification

Your JWT tokens will now contain:
```json
{
  "https://innogate.app/email": "user@example.com",
  "iss": "https://your-tenant.auth0.com/",
  "sub": "auth0|...",
  ...
}
```

Backend routes access it via:
```typescript
const userEmail = (request.user as any)?.['https://innogate.app/email'] as string | undefined
```

**Note:** All Auth0 custom claims must be namespaced with a valid URL format.
