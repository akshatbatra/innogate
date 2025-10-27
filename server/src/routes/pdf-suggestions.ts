import { FastifyInstance } from "fastify";
import { AzureOpenAIEmbeddings } from "@langchain/openai";
import { db } from "../db/index.js";
import { uploadedPdfs, pdfAccess, users } from "../db/schema.js";
import { eq, or, and, inArray } from "drizzle-orm";
import { batchCheckDocumentAccess } from "../lib/fga.js";

export async function pdfSuggestionsRoutes(fastify: FastifyInstance) {
  // POST /api/pdf-suggestions/suggest - Get AI-powered PDF suggestions based on query
  fastify.post<{
    Body: { query: string };
  }>("/api/pdf-suggestions/suggest", {
    preHandler: fastify.requireAuth(),
  }, async (request, reply) => {
    const { query } = request.body;
    const userEmail = (request.user as any)?.['https://innogate.app/email'] as string | undefined;

    if (!userEmail) {
      return reply.code(401).send({ error: "User email not found in token" });
    }

    if (!query || query.trim().length === 0) {
      return reply.code(400).send({ error: "Query is required" });
    }

    try {
      // Get user from database
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, userEmail));

      if (!user) {
        return reply.code(404).send({ error: "User not found" });
      }

      // Get all PDFs the user owns or has access to
      const accessiblePdfs = await db
        .select({
          id: uploadedPdfs.id,
          workId: uploadedPdfs.workId,
          workTitle: uploadedPdfs.workTitle,
          originalName: uploadedPdfs.originalName,
          orcidId: uploadedPdfs.orcidId,
          researcherName: uploadedPdfs.researcherName,
          uploadedAt: uploadedPdfs.uploadedAt,
          ownerId: uploadedPdfs.ownerId,
        })
        .from(uploadedPdfs)
        .leftJoin(pdfAccess, eq(pdfAccess.pdfId, uploadedPdfs.id))
        .where(
          or(
            eq(uploadedPdfs.ownerId, user.id),
            eq(pdfAccess.userId, user.id)
          )
        );

      if (accessiblePdfs.length === 0) {
        return reply.send({
          suggestions: [],
          message: "No PDFs available to suggest",
        });
      }

      // Use FGA to verify access (if FGA is configured)
      let authorizedPdfIds = accessiblePdfs.map(pdf => pdf.id);
      
      if (process.env.FGA_STORE_ID) {
        const pdfIds = accessiblePdfs.map(pdf => pdf.id);
        const accessResults = await batchCheckDocumentAccess(userEmail, pdfIds);
        authorizedPdfIds = pdfIds.filter(id => accessResults[id]);
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

      // Create embeddings for the user query
      const embeddings = new AzureOpenAIEmbeddings({
        azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY,
        azureOpenAIApiInstanceName: process.env.AZURE_OPENAI_API_INSTANCE_NAME,
        azureOpenAIApiDeploymentName: process.env.AZURE_OPENAI_API_EMBEDDINGS_DEPLOYMENT_NAME,
        azureOpenAIApiVersion: process.env.AZURE_OPENAI_API_VERSION,
      });

      const queryEmbedding = await embeddings.embedQuery(query);

      // Create embeddings for PDF titles and researcher names
      const pdfTexts = authorizedPdfs.map(pdf => {
        const title = pdf.workTitle || pdf.originalName;
        const researcher = pdf.researcherName || "";
        return `${title} ${researcher}`.trim();
      });

      const pdfEmbeddings = await embeddings.embedDocuments(pdfTexts);

      // Calculate cosine similarity between query and each PDF
      const similarities = pdfEmbeddings.map((pdfEmbed, index) => {
        const similarity = cosineSimilarity(queryEmbedding, pdfEmbed);
        return {
          pdf: authorizedPdfs[index],
          similarity,
        };
      });

      // Sort by similarity (descending) and take top 5
      const topSuggestions = similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 5)
        .filter(s => s.similarity > 0.3) // Only include if similarity is above threshold
        .map(s => ({
          id: s.pdf.id,
          workId: s.pdf.workId,
          workTitle: s.pdf.workTitle,
          originalName: s.pdf.originalName,
          orcidId: s.pdf.orcidId,
          researcherName: s.pdf.researcherName,
          uploadedAt: s.pdf.uploadedAt,
          isOwner: s.pdf.ownerId === user.id,
          relevanceScore: Math.round(s.similarity * 100),
        }));

      return reply.send({
        suggestions: topSuggestions,
        query,
        totalAccessiblePdfs: authorizedPdfs.length,
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: "Failed to generate suggestions" });
    }
  });
}

// Helper function to calculate cosine similarity
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error("Vectors must have the same length");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}
