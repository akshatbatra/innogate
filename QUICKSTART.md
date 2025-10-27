# Quick Start Guide

Follow these steps to get the AI chat app running:

## Prerequisites
- Node.js 18+ installed
- Auth0 account (free tier works)
- OpenAI API key

## Step 1: Configure Auth0

1. Go to https://auth0.com and create a free account
2. Create a new application (Single Page Application)
3. Note your Domain and Client ID from the application settings
4. Add these to **Allowed Callback URLs**: `http://localhost:5173`
5. Add these to **Allowed Logout URLs**: `http://localhost:5173`
6. Add these to **Allowed Web Origins**: `http://localhost:5173`
7. (Recommended) Enable "Refresh Token Rotation" under Advanced Settings → Grant Types

## Step 2: Configure OpenAI

1. Go to https://platform.openai.com/api-keys
2. Create a new API key
3. Copy the key (starts with `sk-`)

## Step 3: Set Environment Variables

### Frontend (.env in innogate/)
Create `innogate\.env`:
```
VITE_AUTH0_DOMAIN=your-tenant.auth0.com
VITE_AUTH0_CLIENT_ID=your-client-id-from-auth0
```

### Backend (.env in server/)
Create `server\.env`:
```
OPENAI_API_KEY=sk-your-openai-api-key-here
```

## Step 4: Start the Backend

Open a PowerShell terminal:
```powershell
cd server
npm run dev
```

Keep this terminal open. You should see:
```
Server listening on http://localhost:3001
```

## Step 5: Start the Frontend

Open a NEW PowerShell terminal:
```powershell
cd innogate
npm run dev
```

You should see:
```
  VITE ready in X ms

  ➜  Local:   http://localhost:5173/
```

## Step 6: Use the App

1. Open http://localhost:5173 in your browser
2. Click "Log in / Sign up"
3. Complete Auth0 login
4. Start chatting with the AI!

## Troubleshooting

**Problem**: Login button does nothing
- Check that `.env` files exist with correct values
- Verify Auth0 callback URLs match exactly
- Check browser console for errors

**Problem**: Page refresh logs me out
- Ensure `cacheLocation: "localstorage"` is in `AuthProvider.tsx` (already done)
- Enable Refresh Token Rotation in Auth0 dashboard

**Problem**: Chat doesn't respond
- Ensure backend is running on port 3001
- Check OPENAI_API_KEY is valid and has credits
- Look for errors in the backend terminal

**Problem**: CORS errors
- Ensure backend is running before trying to chat
- Check that frontend is on port 5173 and backend on 3001

## Next Steps

- Customize the AI model in `server/src/index.ts` (change `gpt-4o-mini` to `gpt-4` for better responses)
- Add message history to maintain conversation context
- Style the chat UI to match your brand
- Add rate limiting to the backend
- Deploy to production (Vercel for frontend, Railway/Render for backend)
