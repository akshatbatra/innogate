import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import Auth0 from "@auth0/auth0-fastify-api";
import 'dotenv/config';
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
import { researcherRoutes } from "./routes/researchers.js";
import { pdfRoutes, UPLOAD_DIR } from "./routes/pdfs.js";
import { authRoutes } from "./routes/auth.js";
import { pdfRagRoutes, getVectorStore } from "./routes/pdf-rag.js";
import { pdfSuggestionsRoutes } from "./routes/pdf-suggestions.js";
import { existsSync, mkdirSync } from "fs";

// Ensure upload directory exists
if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
}

const fastify = Fastify({ logger: true });

// Enable CORS for frontend
await fastify.register(cors, {
  origin: true, // Allow all origins in development (restrict in production)
  credentials: true,
});

// Register multipart for file uploads
await fastify.register(multipart, {
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
});

// Serve static files from uploads directory (with access control)
await fastify.register(fastifyStatic, {
  root: UPLOAD_DIR,
  prefix: "/uploads/",
  decorateReply: true,
});

// Auth0 configuration
const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE;

if (!AUTH0_DOMAIN) {
  console.warn("⚠️  AUTH0_DOMAIN not set - authentication will be disabled");
}

// Register Auth0 plugin if configured
if (AUTH0_DOMAIN && AUTH0_AUDIENCE) {
  await fastify.register(Auth0, {
    domain: AUTH0_DOMAIN,
    audience: AUTH0_AUDIENCE,
  });
  console.log("✅ Auth0 JWT verification enabled");
} else {
  console.warn("⚠️  Skipping Auth0 setup - domain or audience not configured");
}

// POST /chat/stream - streaming chat endpoint
fastify.post<{ 
  Body: { 
    message: string;
    history?: Array<{ role: "user" | "assistant"; content: string }>;
    pdfId?: string; // Optional PDF ID for RAG
  } 
}>("/chat/stream", {
  preHandler: fastify.requireAuth(),
}, async (request, reply) => {
  const { message, history, pdfId } = request.body;

  if (!message) {
    return reply.code(400).send({ error: "Message is required" });
  }

  // Set headers for Server-Sent Events (SSE)
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });

  try {
    const model = new ChatOpenAI({
      modelName: "openai/gpt-4.1",
      configuration: {
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: process.env.OPENROUTER_KEY
      },
      streaming: true,
      // Explicitly set to prevent Azure mode
      azureOpenAIApiKey: "",
      azureOpenAIApiInstanceName: "",
      azureOpenAIApiDeploymentName: "",
      azureOpenAIApiVersion: "",
    });

    // Build message history - convert the history array to LangChain message objects
    const messages: BaseMessage[] = [];
    
    // If pdfId is provided, perform RAG
    if (pdfId) {
      const vectorStore = getVectorStore(pdfId);
      
      if (vectorStore) {
        // Perform similarity search
        const relevantDocs = await vectorStore.similaritySearch(message, 3);
        
        // Build context from relevant documents
        const context = relevantDocs
          .map((doc, idx) => `[Context ${idx + 1}]\n${doc.pageContent}`)
          .join("\n\n");
        
        // Create system message with context
        const systemPrompt = `You are a helpful research assistant. Use the following context from the PDF to answer the user's question. If the answer cannot be found in the context, say so.

Context from PDF:
${context}

Answer the user's question based on this context.`;
        
        messages.push(new HumanMessage(systemPrompt));
      }
    }
    
    if (history && history.length > 0) {
      // Take only the last 10 messages (5 exchanges) to keep context manageable
      const recentHistory = history.slice(-10);
      
      for (const msg of recentHistory) {
        if (msg.role === "user") {
          messages.push(new HumanMessage(msg.content));
        } else if (msg.role === "assistant") {
          messages.push(new AIMessage(msg.content));
        }
      }
    }
    
    // Add current message
    messages.push(new HumanMessage(message));

    // Stream the response
    const stream = await model.stream(messages);

    for await (const chunk of stream) {
      const content = chunk.content;
      if (content) {
        // Send each token as an SSE event
        reply.raw.write(`data: ${JSON.stringify({ token: content })}\n\n`);
      }
    }

    // Send completion signal
    reply.raw.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    reply.raw.end();
  } catch (error) {
    fastify.log.error(error);
    reply.raw.write(`data: ${JSON.stringify({ error: "Stream failed" })}\n\n`);
    reply.raw.end();
  }
});

// Health check
fastify.get("/health", async () => {
  return { status: "ok" };
});

// Register auth routes
await fastify.register(authRoutes);

// Register researcher routes
await fastify.register(researcherRoutes);

// Register PDF routes
await fastify.register(pdfRoutes);

// Register PDF RAG routes
await fastify.register(pdfRagRoutes);

// Register PDF suggestions routes
await fastify.register(pdfSuggestionsRoutes);

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: 3001, host: "0.0.0.0" });
    console.log("Server listening on http://localhost:3001");
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
