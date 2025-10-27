# Innogate Server

Fastify backend with LangChain + OpenAI streaming chat endpoint.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file with your OpenAI API key:
```
OPENAI_API_KEY=sk-your-openai-api-key-here
```

3. Run the development server:
```bash
npm run dev
```

Server will start on http://localhost:3001

## Endpoints

- `POST /chat/stream` - Streaming chat endpoint (SSE)
  - Body: `{ "message": "your message" }`
  - Returns: Server-Sent Events stream with tokens

- `GET /health` - Health check endpoint
