---
title: "Building InnoGate: An Ethical Research Paper Platform with AI-Powered RAG and Auth0 FGA"
published: false
description: "A comprehensive guide to building a secure research paper sharing platform with AI agents, fine-grained authorization, and semantic search using Auth0 FGA and OpenAlex API"
tags: auth0, ai, rag, security
cover_image: https://dev-to-uploads.s3.amazonaws.com/uploads/articles/...
---

*This is a submission for the [Auth0 for AI Agents Challenge](https://dev.to/challenges/auth0-2025-10-08)*

## What I Built

**InnoGate** is an ethical research paper sharing and discovery platform that combines Auth0's Fine-Grained Authorization (FGA) with AI-powered Retrieval Augmented Generation (RAG) to create a secure, intelligent research assistant. The platform addresses two critical challenges in academic research:

### The Problem
1. **Piracy and Ethical Sourcing**: Researchers often resort to platforms like Sci-Hub due to paywalls, creating ethical and legal concerns
2. **Information Overload**: With millions of research papers published annually, finding and synthesizing relevant information is overwhelming

### The Solution
InnoGate provides:
- 🔬 **Ethical Research Access**: Integration with OpenAlex API for legitimate, open-access research papers
- 🤖 **AI-Powered Research Assistant**: Chat with your research papers using RAG technology
- 🔐 **Fine-Grained Access Control**: Share papers securely with colleagues using Auth0 FGA
- 🎯 **Smart Suggestions**: AI automatically suggests relevant papers based on your queries
- 🔍 **Researcher Discovery**: Find and follow researchers by ORCID ID

### Tech Stack
- **Backend**: Fastify, PostgreSQL, Drizzle ORM
- **Frontend**: React 19, React Router 7, Tailwind CSS
- **AI/ML**: LangChain, Azure OpenAI (embeddings), OpenRouter (chat)
- **Auth**: Auth0 (JWT), Auth0 FGA (fine-grained authorization)
- **APIs**: OpenAlex (research papers)

## Demo

🔗 **Repository**: [GitHub - InnoGate](https://github.com/yourusername/innogate)

### Screenshots

![InnoGate Dashboard](https://placeholder-for-dashboard-screenshot.png)
*Dashboard showing linked researchers and their publications*

![AI Chat Interface](https://placeholder-for-chat-screenshot.png)
*AI agent suggesting relevant papers and providing context-aware answers*

![PDF Sharing](https://placeholder-for-sharing-screenshot.png)
*Secure PDF sharing with fine-grained access control*

### Key Features Demo

**1. Researcher Discovery & PDF Management**

Users can search researchers by ORCID ID and automatically 
link their publications with metadata

- Search by ORCID: e.g. 0000-0002-1825-0097
- Auto-fetch papers from OpenAlex API
- Upload full PDFs with researcher metadata


**2. AI-Powered Suggestions**
- Type a research question
- AI automatically suggests relevant papers (with relevance scores)
- One-click to load papers into RAG context

**3. Secure PDF Sharing**
- Share papers with colleagues via email
- Recipients automatically linked to researcher
- Fine-grained permissions via Auth0 FGA

## How I Used Auth0 for AI Agents

Auth0 is the backbone of InnoGate's security architecture, implementing both authentication and fine-grained authorization.

### 1. Authentication with Auth0 Provider

**Frontend Setup:**
```typescript
// innogate/app/root.tsx
import { Auth0Provider } from "@auth0/auth0-react";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Auth0Provider
      domain={import.meta.env.VITE_AUTH0_DOMAIN}
      clientId={import.meta.env.VITE_AUTH0_CLIENT_ID}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: import.meta.env.VITE_AUTH0_AUDIENCE,
        scope: "openid profile email"
      }}
      cacheLocation="localstorage"
    >
      {children}
    </Auth0Provider>
  );
}
```

**Backend JWT Verification:**
```typescript
// server/src/index.ts
import Auth0 from "@auth0/auth0-fastify-api";

await fastify.register(Auth0, {
  domain: process.env.AUTH0_DOMAIN,
  audience: process.env.AUTH0_AUDIENCE,
});

// All routes protected with JWT
fastify.post("/api/pdfs/upload", {
  preHandler: fastify.requireAuth(),
}, async (request, reply) => {
  const userEmail = (request.user as any)?.['https://innogate.app/email'];
  // ... handle upload
});
```

**Custom Claims in Auth0:**
```javascript
function addEmailClaim(user, context, callback) {
  const namespace = 'https://innogate.app/';
  context.accessToken[namespace + 'email'] = user.email;
  callback(null, user, context);
}
```

---

### 2. Fine-Grained Authorization with Auth0 FGA

This is where InnoGate's security shines. Auth0 FGA provides document-level access control that's both powerful and flexible.

#### The FGA Authorization Model

The heart of FGA is the authorization model. Here's InnoGate's model:

```typescript
model
  schema 1.1

type user

type doc
  relations
    define owner: [user]
    define viewer: [user]
    define can_view: owner or viewer
```

**What this means:**

- `type user`: Represents authenticated users
- `type doc`: Represents research papers/PDFs
- `owner`: Direct relation - users who uploaded the document
- `viewer`: Direct relation - users granted read access
- `can_view`: **Computed relation** - authorization check that returns true if user is owner OR viewer

This model elegantly handles the core requirements:
- Document owners have full control
- Shared users get viewer access
- Authorization checks use the `can_view` computed relation

#### FGA Client Configuration

```typescript
// server/src/lib/fga.ts
import { OpenFgaClient, CredentialsMethod } from "@openfga/sdk";

export function getFGAClient() {
  return new OpenFgaClient({
    apiUrl: process.env.FGA_API_URL,           // https://api.us1.fga.dev
    storeId: process.env.FGA_STORE_ID,         // Your FGA store ID
    credentials: {
      method: CredentialsMethod.ClientCredentials,
      config: {
        clientId: process.env.FGA_CLIENT_ID,
        clientSecret: process.env.FGA_CLIENT_SECRET,
        apiTokenIssuer: process.env.FGA_API_URL,
        apiAudience: process.env.FGA_API_AUDIENCE,
      },
    },
  });
}
```

**Environment Variables:**
```env
FGA_STORE_ID=01K8H70QJ0QN09G29PRGAM8F47
FGA_CLIENT_ID=8ktYwI0vTYUzkr7Y4R55IS5Y9Gfiw0E3
FGA_CLIENT_SECRET=at5VLX5U2r8zL50LJ49D2mlMdKKzBwLiOVv3NxQRM8Qox...
FGA_API_URL=https://api.us1.fga.dev
FGA_API_AUDIENCE=https://api.us1.fga.dev/
```

#### Core FGA Operations

**Granting Access (Creating Tuples):**

```typescript
// server/src/lib/fga.ts
export async function grantDocumentAccess(
  userEmail: string,
  documentId: string,
  relation: "owner" | "viewer"
) {
  const fgaClient = getFGAClient();
  
  console.log(`[FGA] Granting ${relation} access to doc:${documentId}`);

  const result = await fgaClient.write({
    writes: [{
      user: `user:${userEmail}`,
      relation,
      object: `doc:${documentId}`,
    }],
  });

  console.log(`[FGA] Successfully granted access:`, result);
  return result;
}
```

**When a PDF is uploaded, two tuples are created:**
```typescript
// User is both owner and viewer
await grantDocumentAccess(userEmail, pdfId, "owner");
await grantDocumentAccess(userEmail, pdfId, "viewer");
```

**Checking Access (Authorization):**

```typescript
export async function canUserViewDocument(
  userEmail: string,
  documentId: string
): Promise<boolean> {
  const fgaClient = getFGAClient();

  try {
    const { allowed } = await fgaClient.check({
      user: `user:${userEmail}`,
      relation: "viewer",
      object: `doc:${documentId}`,
    });

    return allowed || false;
  } catch (error) {
    console.error("FGA check error:", error);
    return false;
  }
}
```

**Batch Checking (Performance Optimization):**

```typescript
export async function batchCheckDocumentAccess(
  userEmail: string,
  documentIds: string[]
): Promise<Record<string, boolean>> {
  const fgaClient = getFGAClient();
  const results: Record<string, boolean> = {};

  console.log(`[FGA] Batch checking ${documentIds.length} documents`);

  const checks = documentIds.map(docId => ({
    user: `user:${userEmail}`,
    relation: "viewer",
    object: `doc:${docId}`,
  }));

  // Parallel FGA checks for performance
  const responses = await Promise.all(
    checks.map(check => fgaClient.check(check))
  );

  documentIds.forEach((docId, index) => {
    results[docId] = responses[index].allowed || false;
  });

  return results;
}
```

#### Real-World FGA Integration

**Use Case 1: PDF Upload**

```typescript
// server/src/routes/pdfs.ts
fastify.post("/api/pdfs/upload", {
  preHandler: fastify.requireAuth(),
}, async (request, reply) => {
  const { workId, workTitle, orcidId, researcherName } = request.query;
  const userEmail = (request.user as any)?.['https://innogate.app/email'];

  // 1. Save PDF to database
  const [uploaded] = await db.insert(uploadedPdfs)
    .values({
      ownerId: user.id,
      workId,
      fileName: uniqueFileName,
      originalName: data.filename,
      workTitle,
      orcidId,
      researcherName,
    })
    .returning();

  // 2. Create FGA tuples (this is the magic!)
  if (process.env.FGA_STORE_ID) {
    try {
      // Grant both owner and viewer relations
      await grantDocumentAccess(userEmail, uploaded.id, "owner");
      await grantDocumentAccess(userEmail, uploaded.id, "viewer");
      
      fastify.log.info(`✅ FGA access granted for ${uploaded.id}`);
    } catch (fgaError) {
      fastify.log.error(fgaError, "Failed to grant FGA access");
      // Graceful degradation: Upload succeeds even if FGA fails
    }
  }

  return reply.send({ id: uploaded.id, workId: uploaded.workId });
});
```

**Use Case 2: Accepting Share Requests**

```typescript
// server/src/routes/pdfs.ts
fastify.post("/api/pdfs/share-requests/:id/accept", {
  preHandler: fastify.requireAuth(),
}, async (request, reply) => {
  const { id } = request.params;
  const userEmail = (request.user as any)?.['https://innogate.app/email'];

  const shareRequest = await db.query.pdfShareRequests.findFirst({
    where: and(
      eq(pdfShareRequests.id, id),
      eq(pdfShareRequests.toUserId, user.id)
    ),
    with: { pdf: true },
  });

  // 1. Grant database access
  await db.insert(pdfAccess)
    .values({
      pdfId: shareRequest.pdfId,
      userId: user.id,
    });

  // 2. Create FGA tuple for shared access
  if (process.env.FGA_STORE_ID) {
    try {
      await grantDocumentAccess(userEmail, shareRequest.pdfId, "viewer");
      fastify.log.info(`✅ FGA viewer access granted to ${userEmail}`);
    } catch (fgaError) {
      fastify.log.error(fgaError, "Failed to grant FGA access");
    }
  }

  // 3. Delete the share request (no longer needed)
  await db.delete(pdfShareRequests).where(eq(pdfShareRequests.id, id));

  return reply.send({ message: "Share request accepted" });
});
```

**Use Case 3: AI PDF Suggestions with FGA**

This is where FGA truly shines - protecting AI-powered features:

```typescript
// server/src/routes/pdf-suggestions.ts
fastify.post("/api/pdf-suggestions/suggest", {
  preHandler: fastify.requireAuth(),
}, async (request, reply) => {
  const { query } = request.body;
  const userEmail = (request.user as any)?.['https://innogate.app/email'];

  // Step 1: Get PDFs from database (first layer of security)
  const accessiblePdfs = await db
    .select({
      id: uploadedPdfs.id,
      workTitle: uploadedPdfs.workTitle,
      originalName: uploadedPdfs.originalName,
      researcherName: uploadedPdfs.researcherName,
      ownerId: uploadedPdfs.ownerId,
    })
    .from(uploadedPdfs)
    .leftJoin(pdfAccess, eq(pdfAccess.pdfId, uploadedPdfs.id))
    .where(
      or(
        eq(uploadedPdfs.ownerId, user.id),      // User owns it
        eq(pdfAccess.userId, user.id)           // User has access
      )
    );

  // Step 2: Verify with FGA (second layer of security - defense in depth!)
  let authorizedPdfIds = accessiblePdfs.map(pdf => pdf.id);
  
  if (process.env.FGA_STORE_ID) {
    const pdfIds = accessiblePdfs.map(pdf => pdf.id);
    
    // Batch check all PDFs in parallel
    const accessResults = await batchCheckDocumentAccess(userEmail, pdfIds);
    
    // Filter to only FGA-authorized PDFs
    authorizedPdfIds = pdfIds.filter(id => accessResults[id]);
    
    console.log(`[FGA] User authorized for ${authorizedPdfIds.length}/${pdfIds.length} PDFs`);
  }

  // Filter PDFs to only authorized ones
  const authorizedPdfs = accessiblePdfs.filter(pdf => 
    authorizedPdfIds.includes(pdf.id)
  );

  if (authorizedPdfs.length === 0) {
    return reply.send({
      suggestions: [],
      message: "No authorized PDFs available",
    });
  }

  // Step 3: Create embeddings for semantic search
  const embeddings = new AzureOpenAIEmbeddings({
    azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY,
    azureOpenAIApiInstanceName: process.env.AZURE_OPENAI_API_INSTANCE_NAME,
    azureOpenAIApiDeploymentName: process.env.AZURE_OPENAI_API_EMBEDDINGS_DEPLOYMENT_NAME,
    azureOpenAIApiVersion: process.env.AZURE_OPENAI_API_VERSION,
  });

  const queryEmbedding = await embeddings.embedQuery(query);

  // Step 4: Create embeddings for PDF titles and researchers
  const pdfTexts = authorizedPdfs.map(pdf => {
    const title = pdf.workTitle || pdf.originalName;
    const researcher = pdf.researcherName || "";
    return `${title} ${researcher}`.trim();
  });

  const pdfEmbeddings = await embeddings.embedDocuments(pdfTexts);

  // Step 5: Calculate cosine similarity
  const similarities = pdfEmbeddings.map((pdfEmbed, index) => ({
    pdf: authorizedPdfs[index],
    similarity: cosineSimilarity(queryEmbedding, pdfEmbed),
  }));

  // Step 6: Return top 5 suggestions
  const topSuggestions = similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5)
    .filter(s => s.similarity > 0.3)
    .map(s => ({
      id: s.pdf.id,
      workTitle: s.pdf.workTitle,
      originalName: s.pdf.originalName,
      researcherName: s.pdf.researcherName,
      isOwner: s.pdf.ownerId === user.id,
      relevanceScore: Math.round(s.similarity * 100),
    }));

  return reply.send({
    suggestions: topSuggestions,
    totalAccessiblePdfs: authorizedPdfs.length,
  });
});

// Cosine similarity helper
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

**Key Insight:** Notice the **defense-in-depth** approach:
1. Database query filters by ownership/access
2. FGA batch check validates each document
3. Only authorized PDFs get embedded and suggested
4. AI never sees documents the user shouldn't access

#### FGA Best Practices from InnoGate

**1. Always Log FGA Operations**
```typescript
console.log(`[FGA] Granting ${relation} access to doc:${documentId}`);
console.log(`[FGA] Batch checking ${documentIds.length} documents`);
```
This is essential for debugging authorization issues.

**2. Implement Graceful Degradation**
```typescript
if (process.env.FGA_STORE_ID) {
  try {
    await grantDocumentAccess(...);
  } catch (fgaError) {
    fastify.log.error(fgaError, "FGA failed");
    // Don't fail the entire operation
  }
}
```
If FGA is unavailable, fall back to database-only authorization.

**3. Use Batch Operations for Performance**
```typescript
// ❌ Bad: Sequential checks (slow)
for (const docId of documentIds) {
  await canUserViewDocument(email, docId);
}

// ✅ Good: Parallel batch check (fast)
const results = await batchCheckDocumentAccess(email, documentIds);
```

**4. Create Both Owner and Viewer Tuples**
```typescript
// When uploading, grant both relations
await grantDocumentAccess(email, docId, "owner");
await grantDocumentAccess(email, docId, "viewer");
```
This allows the `can_view` computed relation to work correctly.

**5. Delete Tuples When Revoking Access**
```typescript
export async function revokeDocumentAccess(
  userEmail: string,
  documentId: string,
  relation: "owner" | "viewer"
) {
  const fgaClient = getFGAClient();
  
  await fgaClient.write({
    deletes: [{
      user: `user:${userEmail}`,
      relation,
      object: `doc:${documentId}`,
    }],
  });
}
```

---

### 3. RAG Implementation with Vector Stores

```typescript
// server/src/routes/pdf-rag.ts
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { AzureOpenAIEmbeddings } from "@langchain/openai";

const vectorStores = new Map<string, MemoryVectorStore>();

fastify.post("/api/pdf-rag/load", {
  preHandler: fastify.requireAuth(),
}, async (request, reply) => {
  const { pdfId } = request.body;
  const userEmail = (request.user as any)?.['https://innogate.app/email'];
  
  // FGA authorization check before loading
  const hasAccess = await canUserViewDocument(userEmail, pdfId);
  if (!hasAccess) {
    return reply.code(403).send({ error: "Access denied" });
  }

  // Load and embed PDF
  const documents = await loadPDF(pdfPath);
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  const splits = await textSplitter.splitDocuments(documents);

  const embeddings = new AzureOpenAIEmbeddings({...config});
  const vectorStore = await MemoryVectorStore.fromDocuments(splits, embeddings);

  vectorStores.set(pdfId, vectorStore);
  return reply.send({ success: true });
});
```

## Lessons Learned and Takeaways

### 1. **Fine-Grained Authorization is Complex but Essential**

Auth0 FGA proved invaluable because:
- **Separation of Concerns**: Authorization logic lives in FGA, not scattered across code
- **Relationship-Based Access**: The model naturally expresses owner/viewer relationships
- **Scalability**: Adding new relations (e.g., `editor`, `commenter`) is trivial
- **Audit Trail**: Every access decision is logged

**Challenge**: Understanding FGA's tuple-based model took time.

**Lesson**: Start with the simplest model and iterate. The `define can_view: owner or viewer` syntax is powerful.

### 2. **Double Defense Wins**

InnoGate implements multiple security layers:
1. JWT Authentication (Auth0)
2. Database constraints
3. FGA authorization checks
4. Application validation

**Lesson**: FGA can be used to either replace database based authorization or bolster it by adding another layer of checks. In case database is somehow compromised Auth0 FGA will ensure that no data leaks.

### 3. **Batch Operations are Critical**

Checking 50 PDFs sequentially would take seconds. Batch checking takes milliseconds.

```typescript
// Parallel FGA checks
const responses = await Promise.all(
  checks.map(check => fgaClient.check(check))
);
```

**Lesson**: Always use batch operations for performance.
