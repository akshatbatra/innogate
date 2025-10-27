import { FastifyInstance } from "fastify";
import { eq, and, or } from "drizzle-orm";
import { db } from "../db/index.js";
import { users, uploadedPdfs, pdfAccess } from "../db/schema.js";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { AzureOpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { readFile } from "fs/promises";
import { join } from "path";
import { UPLOAD_DIR } from "./pdfs.js";
import 'dotenv/config';

// Import pdfjs-dist
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

// Custom PDF loader function using pdfjs-dist
async function loadPDF(filePath: string): Promise<Document[]> {
  const dataBuffer = await readFile(filePath);
  const typedArray = new Uint8Array(dataBuffer);
  
  const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
  const documents: Document[] = [];
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const text = textContent.items
      .map((item: any) => item.str)
      .join(" ");
    
    documents.push(
      new Document({
        pageContent: text,
        metadata: {
          page: i,
          totalPages: pdf.numPages,
          source: filePath,
        },
      })
    );
  }
  
  return documents;
}

// Store vector stores in memory (keyed by pdfId)
const vectorStores: Map<string, MemoryVectorStore> = new Map();

// Export function to get vector store
export function getVectorStore(pdfId: string): MemoryVectorStore | undefined {
  return vectorStores.get(pdfId);
}

export async function pdfRagRoutes(fastify: FastifyInstance) {
  // GET /api/pdf-rag/list - Get all PDFs accessible by user (owned + shared)
  fastify.get(
    "/api/pdf-rag/list",
    {
      preHandler: fastify.requireAuth(),
    },
    async (request, reply) => {
      const userEmail = (request.user as any)?.['https://innogate.app/email'] as string | undefined;

      if (!userEmail) {
        return reply.code(401).send({ message: "Unauthorized" });
      }

      try {
        const user = await db.query.users.findFirst({
          where: eq(users.email, userEmail),
        });

        if (!user) {
          return reply.send([]);
        }

        // Get PDFs owned by user
        const ownedPdfs = await db.query.uploadedPdfs.findMany({
          where: eq(uploadedPdfs.ownerId, user.id),
        });

        // Get PDFs user has access to (shared)
        const accessRecords = await db.query.pdfAccess.findMany({
          where: eq(pdfAccess.userId, user.id),
          with: {
            pdf: true,
          },
        });

        const allPdfs = [
          ...ownedPdfs.map(pdf => ({
            id: pdf.id,
            workId: pdf.workId,
            workTitle: pdf.workTitle,
            originalName: pdf.originalName,
            orcidId: pdf.orcidId,
            researcherName: pdf.researcherName,
            uploadedAt: pdf.uploadedAt,
            isOwner: true,
          })),
          ...accessRecords.map((access: any) => ({
            id: access.pdf.id,
            workId: access.pdf.workId,
            workTitle: access.pdf.workTitle,
            originalName: access.pdf.originalName,
            orcidId: access.pdf.orcidId,
            researcherName: access.pdf.researcherName,
            uploadedAt: access.pdf.uploadedAt,
            isOwner: false,
          })),
        ];

        return reply.send(allPdfs);
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ message: "Failed to fetch PDFs" });
      }
    }
  );

  // POST /api/pdf-rag/load - Load a PDF and create vector store
  fastify.post<{
    Body: { pdfId: string };
  }>(
    "/api/pdf-rag/load",
    {
      preHandler: fastify.requireAuth(),
    },
    async (request, reply) => {
      const { pdfId } = request.body;
      const userEmail = (request.user as any)?.['https://innogate.app/email'] as string | undefined;

      if (!pdfId) {
        return reply.code(400).send({ message: "PDF ID is required" });
      }

      if (!userEmail) {
        return reply.code(401).send({ message: "Unauthorized" });
      }

      try {
        const user = await db.query.users.findFirst({
          where: eq(users.email, userEmail),
        });

        if (!user) {
          return reply.code(404).send({ message: "User not found" });
        }

        const pdf = await db.query.uploadedPdfs.findFirst({
          where: eq(uploadedPdfs.id, pdfId),
        });

        if (!pdf) {
          return reply.code(404).send({ message: "PDF not found" });
        }

        // Check if user has access to this PDF
        const isOwner = pdf.ownerId === user.id;
        const hasAccess = await db.query.pdfAccess.findFirst({
          where: and(
            eq(pdfAccess.pdfId, pdfId),
            eq(pdfAccess.userId, user.id)
          ),
        });

        if (!isOwner && !hasAccess) {
          return reply.code(403).send({ message: "Access denied" });
        }

        // Check if vector store already exists
        if (vectorStores.has(pdfId)) {
          return reply.send({
            message: "PDF vector store already loaded",
            pdfId,
            workTitle: pdf.workTitle,
          });
        }

        // Load PDF and create vector store
        const pdfPath = join(UPLOAD_DIR, pdf.fileName);
        const docs = await loadPDF(pdfPath);

        // Create embeddings and vector store
        const embeddings = new AzureOpenAIEmbeddings({
          azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY,
          azureOpenAIApiInstanceName: process.env.AZURE_OPENAI_API_INSTANCE_NAME,
          azureOpenAIApiDeploymentName: process.env.AZURE_OPENAI_API_EMBEDDINGS_DEPLOYMENT_NAME,
          azureOpenAIApiVersion: process.env.AZURE_OPENAI_API_VERSION,
        });

        const vectorStore = await MemoryVectorStore.fromDocuments(
          docs,
          embeddings
        );

        // Store in memory
        vectorStores.set(pdfId, vectorStore);

        return reply.send({
          message: "PDF loaded and vector store created",
          pdfId,
          workTitle: pdf.workTitle,
          pageCount: docs.length,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ 
          message: "Failed to load PDF", 
          error: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  );

  // POST /api/pdf-rag/query - Query a loaded PDF
  fastify.post<{
    Body: { pdfId: string; query: string; k?: number };
  }>(
    "/api/pdf-rag/query",
    {
      preHandler: fastify.requireAuth(),
    },
    async (request, reply) => {
      const { pdfId, query, k = 4 } = request.body;
      const userEmail = (request.user as any)?.['https://innogate.app/email'] as string | undefined;

      if (!pdfId || !query) {
        return reply.code(400).send({ message: "PDF ID and query are required" });
      }

      if (!userEmail) {
        return reply.code(401).send({ message: "Unauthorized" });
      }

      try {
        // Check if vector store exists
        const vectorStore = vectorStores.get(pdfId);
        if (!vectorStore) {
          return reply.code(404).send({ 
            message: "PDF not loaded. Please load the PDF first using /api/pdf-rag/load" 
          });
        }

        // Perform similarity search
        const results = await vectorStore.similaritySearch(query, k);

        return reply.send({
          query,
          results: results.map(doc => ({
            content: doc.pageContent,
            metadata: doc.metadata,
          })),
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ 
          message: "Failed to query PDF",
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  );

  // DELETE /api/pdf-rag/unload/:pdfId - Unload a PDF from memory
  fastify.delete<{
    Params: { pdfId: string };
  }>(
    "/api/pdf-rag/unload/:pdfId",
    {
      preHandler: fastify.requireAuth(),
    },
    async (request, reply) => {
      const { pdfId } = request.params;

      if (vectorStores.has(pdfId)) {
        vectorStores.delete(pdfId);
        return reply.send({ message: "PDF unloaded from memory" });
      }

      return reply.code(404).send({ message: "PDF not loaded" });
    }
  );

  // GET /api/pdf-rag/loaded - Get list of loaded PDFs
  fastify.get(
    "/api/pdf-rag/loaded",
    {
      preHandler: fastify.requireAuth(),
    },
    async (request, reply) => {
      const loadedPdfIds = Array.from(vectorStores.keys());
      return reply.send({ loadedPdfIds, count: loadedPdfIds.length });
    }
  );
}
