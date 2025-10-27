import { OpenFgaClient, CredentialsMethod } from "@openfga/sdk";

// Initialize OpenFGA client
export function getFGAClient() {
  return new OpenFgaClient({
    apiUrl: process.env.FGA_API_URL!,
    storeId: process.env.FGA_STORE_ID!,
    authorizationModelId: process.env.FGA_MODEL_ID!,
    credentials: {
      method: CredentialsMethod.ClientCredentials,
      config: {
        clientId: process.env.FGA_CLIENT_ID!,
        clientSecret: process.env.FGA_CLIENT_SECRET!,
        apiTokenIssuer: process.env.FGA_API_TOKEN_ISSUER!,
        apiAudience: process.env.FGA_API_AUDIENCE!,
      },
    },
  });
}

// Check if user can view a document
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

// Grant user access to a document
export async function grantDocumentAccess(
  userEmail: string,
  documentId: string,
  relation: "owner" | "viewer" = "viewer"
) {
  const fgaClient = getFGAClient();

  console.log(`[FGA] Granting ${relation} access to doc:${documentId} for user:${userEmail}`);

  try {
    const result = await fgaClient.write({
      writes: [
        {
          user: `user:${userEmail}`,
          relation,
          object: `doc:${documentId}`,
        }
      ]},
      {
        authorizationModelId: process.env.FGA_MODEL_ID!
      }
    );
    console.log(`[FGA] Successfully granted access:`, result);
    return result;
  } catch (error) {
    console.error(`[FGA] Failed to grant access:`, error);
    throw error;
  }
}

// Revoke user access to a document
export async function revokeDocumentAccess(
  userEmail: string,
  documentId: string,
  relation: "owner" | "viewer" = "viewer"
) {
  const fgaClient = getFGAClient();

  await fgaClient.write({
    deletes: [
      {
        user: `user:${userEmail}`,
        relation,
        object: `doc:${documentId}`,
      },
    ],
  });
}

// Get all documents a user can view
export async function getUserAccessibleDocuments(
  userEmail: string
): Promise<string[]> {
  const fgaClient = getFGAClient();

  try {
    const response = await fgaClient.listObjects({
      user: `user:${userEmail}`,
      relation: "viewer",
      type: "doc",
    });

    // Extract document IDs from the response
    return response.objects?.map((obj) => obj.replace("doc:", "")) || [];
  } catch (error) {
    console.error("FGA listObjects error:", error);
    return [];
  }
}

// Batch check multiple documents
export async function batchCheckDocumentAccess(
  userEmail: string,
  documentIds: string[]
): Promise<Record<string, boolean>> {
  const fgaClient = getFGAClient();
  const results: Record<string, boolean> = {};

  console.log(`[FGA] Batch checking access for user:${userEmail}, documents:`, documentIds);

  try {
    const checks = documentIds.map((docId) => ({
      user: `user:${userEmail}`,
      relation: "viewer",
      object: `doc:${docId}`,
    }));

    // Perform batch check
    const responses = await Promise.all(
      checks.map((check) => fgaClient.check(check))
    );

    documentIds.forEach((docId, index) => {
      results[docId] = responses[index].allowed || false;
      console.log(`[FGA] doc:${docId} - allowed: ${results[docId]}`);
    });
  } catch (error) {
    console.error("[FGA] Batch check error:", error);
    // Return all false on error
    documentIds.forEach((docId) => {
      results[docId] = false;
    });
  }

  return results;
}
