# Innogate - Agentic Research

An authenticated AI application with Auth0 authentication, React Router frontend, and Fastify + LangChain backend streaming OpenAI responses.

## Architecture

- **Frontend**: React 19 + React Router 7 + Tailwind CSS + Auth0
- **Backend**: Fastify + LangChain + OpenAI (OpenRouter streaming)
- **Authentication**: Auth0 (SPA with refresh tokens)

## Setup Instructions

### 1. Frontend Setup

#### Install Dependencies
```powershell
cd frontend
npm install
```

#### Configure Auth0
Create a `.env` file in the `frontend/` directory:
```
VITE_AUTH0_DOMAIN=your-tenant.auth0.com
VITE_AUTH0_CLIENT_ID=your-client-id
```

**Auth0 Application Settings:**
- Application Type: Single Page Application
- Allowed Callback URLs: `http://localhost:5173`
- Allowed Logout URLs: `http://localhost:5173`
- Allowed Web Origins: `http://localhost:5173`
- Enable "Refresh Token Rotation" (recommended for security)

#### Run Frontend
```powershell
npm run dev
```

Frontend will be available at http://localhost:5173

### 2. Backend Setup

#### Install Dependencies
```powershell
cd ..\server
npm install
```

#### Run Backend
```powershell
npm run dev
```

Backend API will be available at http://localhost:3001

### 3. Usage

1. Start the backend server (from `server/` directory):
   ```powershell
   npm run dev
   ```

2. Start the frontend (from `frontend/` directory):
   ```powershell
   npm run dev
   ```

3. Open http://localhost:5173 in your browser

4. Click "Log in / Sign up" to authenticate with Auth0

5. Start chatting with the AI assistant!

## Features

- ✅ Auth0 authentication with persistent sessions (survives page refresh)
- ✅ Protected chat interface (login required)
- ✅ Real-time streaming AI responses using LangChain + OpenRouter
- ✅ Server-Sent Events (SSE) for token-by-token streaming
- ✅ Responsive UI with Tailwind CSS
- ✅ Dark mode support

## API Endpoints

### Backend (Port 3001)

- `POST /chat/stream` - Streaming chat endpoint
  - Request body: `{ "message": "your message" }`
  - Response: SSE stream with tokens
  - Example SSE events:
    ```
    data: {"token":"Hello"}
    data: {"token":" world"}
    data: {"done":true}
    ```

- `GET /health` - Health check endpoint

## Tech Stack

### Frontend
- React 19.1.1
- React Router 7.9.2
- Auth0 React SDK 2.0.0
- Tailwind CSS 4.1.13
- TypeScript 5.9.2
- Vite 7.1.7

### Backend
- Fastify 5.2.0
- LangChain 0.3.36
- @langchain/openai 0.3.14
- TypeScript 5.7.2
- tsx (for dev hot-reload)

## Environment Variables

### Frontend (.env in frontend/)
```
VITE_AUTH0_DOMAIN=
VITE_AUTH0_CLIENT_ID=
VITE_AUTH0_AUDIENCE=
```

### Backend (.env in server/)
```
AUTH0_DOMAIN=
AUTH0_AUDIENCE=
DATABASE_URL=

# Azure OpenAI Configuration for Embeddings
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_API_INSTANCE_NAME=
AZURE_OPENAI_API_EMBEDDINGS_DEPLOYMENT_NAME=
AZURE_OPENAI_API_VERSION=

OPENROUTER_KEY=

# Auth0 FGA (Fine-Grained Authorization)
FGA_STORE_ID=
FGA_CLIENT_ID=
FGA_CLIENT_SECRET=
FGA_API_URL=https://api.us1.fga.dev
FGA_API_AUDIENCE=https://api.us1.fga.dev/
FGA_API_TOKEN_ISSUER=auth.fga.dev
FGA_MODEL_ID=
```

## Development

### Frontend Commands
- `npm run dev` - Start dev server with hot reload
- `npm run build` - Build for production
- `npm run typecheck` - Run TypeScript type checking

### Backend Commands
- `npm run dev` - Start dev server with hot reload (tsx watch)
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run compiled JavaScript (production)

## Security Notes

- Auth0 is configured with `cacheLocation: "localstorage"` and `useRefreshTokens: true` for persistent sessions
- Enable "Refresh Token Rotation" in Auth0 dashboard for enhanced security
- Never commit `.env` files to version control
- Use environment-specific origins/callbacks in production
- Consider rate limiting on the backend API in production

## Troubleshooting

### "Nothing happens on clicking login button"
- Ensure Auth0 env vars are set correctly in `.env`
- Check that the Auth0 application is configured as a Single Page Application
- Verify Allowed Callback URLs include your frontend URL
- Check browser console for errors

### "User logged out after page refresh"
- Ensure `cacheLocation: "localstorage"` and `useRefreshTokens: true` are set in `AuthProvider.tsx`
- Enable "Refresh Token Rotation" in Auth0 dashboard

### "Chat not streaming responses"
- Ensure backend is running on port 3001
- Verify OpenRouter key has available credits
- Check browser network tab for SSE connection errors
