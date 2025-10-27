# Auth0 FGA (Fine-Grained Authorization) Setup for RAG

This application implements fine-grained access control using Auth0 FGA for Retrieval Augmented Generation (RAG).

## Features

1. **AI-Powered PDF Suggestions**: As users type their questions, the system automatically suggests relevant PDFs based on semantic similarity
2. **Fine-Grained Access Control**: Only PDFs the user has permission to access are shown and can be queried
3. **Automatic Permission Management**: When PDFs are uploaded or shared, FGA tuples are automatically created

## Setup Steps

### 1. Create Auth0 FGA Store

1. Go to [Auth0 FGA Dashboard](https://dashboard.fga.dev/)
2. Create a new store
3. Go to Settings → Authorized Clients → Create Client
4. Grant permissions: Read and Query
5. Note down:
   - Store ID
   - Client ID
   - Client Secret
   - API URL
   - API Audience

### 2. Configure FGA Model

In the FGA Dashboard, go to Model Explorer and add this authorization model:

```
model
  schema 1.1

type user

type doc
  relations
    define owner: [user]
    define viewer: [user, user:*]
    define can_view: owner or viewer
```

This model defines:
- **owner**: Users who own the document (can do everything)
- **viewer**: Users who can view the document
- **can_view**: Computed relation - true if user is owner OR viewer

### 3. Update Environment Variables

Add these to `server/.env`:

```env
# Auth0 FGA (Fine-Grained Authorization)
FGA_STORE_ID=your-fga-store-id
FGA_CLIENT_ID=your-fga-client-id
FGA_CLIENT_SECRET=your-fga-client-secret
FGA_API_URL=https://api.us1.fga.dev
FGA_API_AUDIENCE=https://api.us1.fga.dev/
```

### 4. How It Works

#### PDF Upload
When a user uploads a PDF:
1. PDF is saved to database and disk
2. FGA tuples are created:
   - `user:<email>` → `owner` → `doc:<pdfId>`
   - `user:<email>` → `viewer` → `doc:<pdfId>`

#### PDF Sharing
When a share request is accepted:
1. Database records access in `pdf_access` table
2. FGA tuple is created:
   - `user:<email>` → `viewer` → `doc:<pdfId>`

#### AI Suggestions
When user types a question:
1. System waits 800ms after typing stops (debounce)
2. Fetches all accessible PDFs from database
3. Validates access via FGA batch check
4. Creates embeddings for:
   - User's question
   - All PDF titles + researcher names
5. Calculates cosine similarity
6. Returns top 5 PDFs with similarity > 30%
7. Displays suggestions with relevance scores

#### RAG Queries
When querying a loaded PDF:
1. System verifies FGA permission
2. Loads vector store for the PDF
3. Performs similarity search in the document
4. Returns context to LLM for answer generation

## API Endpoints

### Get PDF Suggestions
```
POST /api/pdf-suggestions/suggest
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "query": "What are the latest developments in quantum computing?"
}

Response:
{
  "suggestions": [
    {
      "id": "pdf-id",
      "workTitle": "Quantum Computing Advances",
      "researcherName": "Dr. Smith",
      "relevanceScore": 85,
      "isOwner": true
    }
  ],
  "totalAccessiblePdfs": 10
}
```

## FGA Helper Functions

Located in `server/src/lib/fga.ts`:

- `canUserViewDocument(email, docId)` - Check if user can view a document
- `grantDocumentAccess(email, docId, relation)` - Grant access (owner/viewer)
- `revokeDocumentAccess(email, docId, relation)` - Revoke access
- `getUserAccessibleDocuments(email)` - Get all accessible doc IDs
- `batchCheckDocumentAccess(email, docIds[])` - Batch check multiple documents

## Benefits

1. **Security**: Fine-grained control over document access
2. **UX**: Intelligent suggestions save time finding relevant PDFs
3. **Scalability**: FGA handles complex permission scenarios
4. **Compliance**: Audit trail of all access decisions
5. **Flexibility**: Easy to add new relations (editor, commenter, etc.)

## Optional: Running Without FGA

The system gracefully handles missing FGA configuration:
- If `FGA_STORE_ID` is not set, FGA checks are skipped
- Falls back to database-only authorization
- All features work, but without the fine-grained control

## Monitoring

FGA access checks are logged:
```
✅ FGA access granted for document abc-123 to user@example.com
⚠️  FGA check failed for document xyz-789
```

Check server logs to monitor authorization decisions.
