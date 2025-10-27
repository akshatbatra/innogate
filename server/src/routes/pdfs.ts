import { FastifyInstance } from "fastify";
import { eq, and, or } from "drizzle-orm";
import { db } from "../db/index.js";
import { users, uploadedPdfs, pdfShareRequests, pdfAccess, linkedResearchers } from "../db/schema.js";
import { randomUUID } from "crypto";
import { createWriteStream } from "fs";
import { unlink } from "fs/promises";
import { pipeline } from "stream/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { grantDocumentAccess } from "../lib/fga.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export const UPLOAD_DIR = join(__dirname, "..", "..", "..", "uploads");

export async function pdfRoutes(fastify: FastifyInstance) {
  // GET /api/pdfs - Get PDF status for works (including shared ones)
  fastify.get<{
    Querystring: { workIds: string };
  }>(
    "/api/pdfs",
    {
      preHandler: fastify.requireAuth(),
    },
    async (request, reply) => {
      const { workIds } = request.query;
      const userEmail = (request.user as any)?.['https://innogate.app/email'] as string | undefined;

      if (!workIds) {
        return reply.code(400).send({ message: "Work IDs are required" });
      }

      if (!userEmail) {
        return reply.code(401).send({ message: "Unauthorized" });
      }

      try {
        const user = await db.query.users.findFirst({
          where: eq(users.email, userEmail),
        });

        if (!user) {
          return reply.send({});
        }

        const workIdArray = workIds.split(",");
        
        // Get PDFs owned by user
        const ownedPdfs = await db.query.uploadedPdfs.findMany({
          where: eq(uploadedPdfs.ownerId, user.id),
        });

        // Get PDFs user has access to
        const accessRecords = await db.query.pdfAccess.findMany({
          where: eq(pdfAccess.userId, user.id),
          with: {
            pdf: true,
          },
        });

        const pdfMap: Record<string, { 
          id: string; 
          originalName: string; 
          uploadedAt: Date;
          isOwner: boolean;
        }> = {};

        // Add owned PDFs
        ownedPdfs.forEach((pdf) => {
          if (workIdArray.includes(pdf.workId)) {
            pdfMap[pdf.workId] = {
              id: pdf.id,
              originalName: pdf.originalName,
              uploadedAt: pdf.uploadedAt,
              isOwner: true,
            };
          }
        });

        // Add shared PDFs
        accessRecords.forEach((access: any) => {
          if (access.pdf && workIdArray.includes(access.pdf.workId)) {
            pdfMap[access.pdf.workId] = {
              id: access.pdf.id,
              originalName: access.pdf.originalName,
              uploadedAt: access.pdf.uploadedAt,
              isOwner: false,
            };
          }
        });

        return reply.send(pdfMap);
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ message: "Failed to fetch PDFs" });
      }
    }
  );

  // POST /api/pdfs/upload - Upload a PDF for a work
  fastify.post<{
    Querystring: { workId: string; workTitle?: string; orcidId?: string; researcherName?: string };
  }>(
    "/api/pdfs/upload",
    {
      preHandler: fastify.requireAuth(),
    },
    async (request, reply) => {
      const { workId, workTitle, orcidId, researcherName } = request.query;
      const userEmail = (request.user as any)?.['https://innogate.app/email'] as string | undefined;

      if (!workId) {
        return reply.code(400).send({ message: "Work ID is required" });
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

        const data = await request.file();
        if (!data) {
          return reply.code(400).send({ message: "No file uploaded" });
        }

      // Check if PDF already exists for this user and work
      const existing = await db.query.uploadedPdfs.findFirst({
        where: and(
          eq(uploadedPdfs.ownerId, user.id),
          eq(uploadedPdfs.workId, workId)
        ),
      });        // Generate unique filename
        const fileExtension = data.filename.split(".").pop() || "pdf";
        const uniqueFileName = `${randomUUID()}.${fileExtension}`;
        const filePath = join(UPLOAD_DIR, uniqueFileName);

        // Save file to disk
        await pipeline(data.file, createWriteStream(filePath));

        if (existing) {
          // Update existing record
          const oldFilePath = join(UPLOAD_DIR, existing.fileName);
          try {
            await unlink(oldFilePath);
          } catch (err) {
            console.warn("Failed to delete old file:", err);
          }

          const [updated] = await db
            .update(uploadedPdfs)
            .set({
              fileName: uniqueFileName,
              originalName: data.filename,
              uploadedAt: new Date(),
              workTitle: workTitle || existing.workTitle,
              orcidId: orcidId || existing.orcidId,
              researcherName: researcherName || existing.researcherName,
            })
            .where(eq(uploadedPdfs.id, existing.id))
            .returning();

          return reply.send({
            id: updated.id,
            workId: updated.workId,
            originalName: updated.originalName,
            uploadedAt: updated.uploadedAt,
          });
        } else {
        // Create new record
        const [uploaded] = await db
          .insert(uploadedPdfs)
          .values({
            ownerId: user.id,
            workId,
            fileName: uniqueFileName,
            originalName: data.filename,
            workTitle: workTitle || null,
            orcidId: orcidId || null,
            researcherName: researcherName || null,
          })
          .returning();

          // Grant FGA access to owner (if FGA is configured)
          if (process.env.FGA_STORE_ID) {
            try {
              await grantDocumentAccess(userEmail, uploaded.id, "owner");
              await grantDocumentAccess(userEmail, uploaded.id, "viewer");
              fastify.log.info(`FGA access granted for document ${uploaded.id} to ${userEmail}`);
            } catch (fgaError) {
              fastify.log.error(fgaError, "Failed to grant FGA access");
              // Don't fail the upload if FGA fails
            }
          }

          return reply.send({
            id: uploaded.id,
            workId: uploaded.workId,
            originalName: uploaded.originalName,
            uploadedAt: uploaded.uploadedAt,
          });
        }
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ message: "Failed to upload PDF" });
      }
    }
  );

  // GET /api/pdfs/:id - Download a PDF (owner or shared user)
  fastify.get<{
    Params: { id: string };
  }>(
    "/api/pdfs/:id",
    {
      preHandler: fastify.requireAuth(),
    },
    async (request, reply) => {
      const { id } = request.params;
      const userEmail = (request.user as any)?.['https://innogate.app/email'] as string | undefined;

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
          where: eq(uploadedPdfs.id, id),
        });

        if (!pdf) {
          return reply.code(404).send({ message: "PDF not found" });
        }

        // Check if user is owner
        const isOwner = pdf.ownerId === user.id;

        // Check if user has access
        const hasAccess = await db.query.pdfAccess.findFirst({
          where: and(
            eq(pdfAccess.pdfId, id),
            eq(pdfAccess.userId, user.id)
          ),
        });

        if (!isOwner && !hasAccess) {
          return reply.code(403).send({ message: "Access denied" });
        }

        return reply.sendFile(pdf.fileName);
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ message: "Failed to download PDF" });
      }
    }
  );

  // DELETE /api/pdfs/:id - Delete a PDF (owner only)
  fastify.delete<{
    Params: { id: string };
  }>(
    "/api/pdfs/:id",
    {
      preHandler: fastify.requireAuth(),
    },
    async (request, reply) => {
      const { id } = request.params;
      const userEmail = (request.user as any)?.['https://innogate.app/email'] as string | undefined;

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
          where: and(
            eq(uploadedPdfs.id, id),
            eq(uploadedPdfs.ownerId, user.id)
          ),
        });

        if (!pdf) {
          return reply.code(404).send({ message: "PDF not found or access denied" });
        }

        // Delete file from disk
        const filePath = join(UPLOAD_DIR, pdf.fileName);
        try {
          await unlink(filePath);
        } catch (err) {
          console.warn("Failed to delete file:", err);
        }

        // Delete from database (cascade will handle share requests and access)
        await db.delete(uploadedPdfs).where(eq(uploadedPdfs.id, id));

        return reply.send({ message: "PDF deleted successfully" });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ message: "Failed to delete PDF" });
      }
    }
  );

  // POST /api/pdfs/:id/share - Share a PDF with another user
  fastify.post<{
    Params: { id: string };
    Body: { targetEmail: string };
  }>(
    "/api/pdfs/:id/share",
    {
      preHandler: fastify.requireAuth(),
    },
    async (request, reply) => {
      const { id } = request.params;
      const { targetEmail } = request.body;
      const userEmail = (request.user as any)?.['https://innogate.app/email'] as string | undefined;

      if (!targetEmail) {
        return reply.code(400).send({ message: "Target email is required" });
      }

      if (!userEmail) {
        return reply.code(401).send({ message: "Unauthorized" });
      }

      if (userEmail === targetEmail) {
        return reply.code(400).send({ message: "Cannot share with yourself" });
      }

      try {
        const user = await db.query.users.findFirst({
          where: eq(users.email, userEmail),
        });

        if (!user) {
          return reply.code(404).send({ message: "User not found" });
        }

        const targetUser = await db.query.users.findFirst({
          where: eq(users.email, targetEmail),
        });

        if (!targetUser) {
          return reply.code(404).send({ message: "Target user not found" });
        }

        // Check if user owns this PDF
        const pdf = await db.query.uploadedPdfs.findFirst({
          where: and(
            eq(uploadedPdfs.id, id),
            eq(uploadedPdfs.ownerId, user.id)
          ),
        });

        if (!pdf) {
          return reply.code(404).send({ message: "PDF not found or access denied" });
        }

        // Check if share request already exists
        const existingRequest = await db.query.pdfShareRequests.findFirst({
          where: and(
            eq(pdfShareRequests.pdfId, id),
            eq(pdfShareRequests.toUserId, targetUser.id)
          ),
        });

        if (existingRequest) {
          return reply.code(409).send({ message: "Share request already exists" });
        }

        // Create share request
        const [request_] = await db
          .insert(pdfShareRequests)
          .values({
            pdfId: id,
            fromUserId: user.id,
            toUserId: targetUser.id,
          })
          .returning();

        return reply.send({
          id: request_.id,
          createdAt: request_.createdAt,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ message: "Failed to share PDF" });
      }
    }
  );

  // GET /api/pdfs/share-requests - Get pending share requests for a user
  fastify.get(
    "/api/pdfs/share-requests",
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

        const requests = await db.query.pdfShareRequests.findMany({
          where: eq(pdfShareRequests.toUserId, user.id),
          with: {
            pdf: true,
            fromUser: true,
          },
        });

        return reply.send(
          requests.map((req: any) => ({
            id: req.id,
            pdfId: req.pdfId,
            workId: req.pdf.workId,
            workTitle: req.pdf.workTitle,
            orcidId: req.pdf.orcidId,
            researcherName: req.pdf.researcherName,
            originalName: req.pdf.originalName,
            fromUserEmail: req.fromUser.email,
            createdAt: req.createdAt,
          }))
        );
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ message: "Failed to fetch share requests" });
      }
    }
  );

  // POST /api/pdfs/share-requests/:id/accept - Accept a share request
  fastify.post<{
    Params: { id: string };
  }>(
    "/api/pdfs/share-requests/:id/accept",
    {
      preHandler: fastify.requireAuth(),
    },
    async (request, reply) => {
      const { id } = request.params;
      const userEmail = (request.user as any)?.['https://innogate.app/email'] as string | undefined;

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

        const shareRequest = await db.query.pdfShareRequests.findFirst({
          where: and(
            eq(pdfShareRequests.id, id),
            eq(pdfShareRequests.toUserId, user.id)
          ),
          with: {
            pdf: true,
          },
        });

        if (!shareRequest) {
          return reply.code(404).send({ message: "Share request not found" });
        }

        // Check if researcher needs to be linked
        if (shareRequest.pdf.orcidId && shareRequest.pdf.researcherName) {
          const existingLink = await db.query.linkedResearchers.findFirst({
            where: and(
              eq(linkedResearchers.userId, user.id),
              eq(linkedResearchers.orcidId, shareRequest.pdf.orcidId)
            ),
          });

          // If not already linked, link the researcher
          if (!existingLink) {
            await db
              .insert(linkedResearchers)
              .values({
                userId: user.id,
                orcidId: shareRequest.pdf.orcidId,
                researcherName: shareRequest.pdf.researcherName,
              })
              .onConflictDoNothing();
          }
        }

        // Grant access
        await db
          .insert(pdfAccess)
          .values({
            pdfId: shareRequest.pdfId,
            userId: user.id,
          })
          .onConflictDoNothing();

        // Grant FGA access (if FGA is configured)
        if (process.env.FGA_STORE_ID) {
          try {
            await grantDocumentAccess(userEmail, shareRequest.pdfId, "viewer");
            fastify.log.info(`FGA viewer access granted for document ${shareRequest.pdfId} to ${userEmail}`);
          } catch (fgaError) {
            fastify.log.error(fgaError, "Failed to grant FGA access");
            // Don't fail the accept if FGA fails
          }
        }

        // Delete the share request
        await db
          .delete(pdfShareRequests)
          .where(eq(pdfShareRequests.id, id));

        return reply.send({ message: "Share request accepted" });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ message: "Failed to accept share request" });
      }
    }
  );

  // POST /api/pdfs/share-requests/:id/reject - Reject a share request
  fastify.post<{
    Params: { id: string };
  }>(
    "/api/pdfs/share-requests/:id/reject",
    {
      preHandler: fastify.requireAuth(),
    },
    async (request, reply) => {
      const { id } = request.params;
      const userEmail = (request.user as any)?.['https://innogate.app/email'] as string | undefined;

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

        const shareRequest = await db.query.pdfShareRequests.findFirst({
          where: and(
            eq(pdfShareRequests.id, id),
            eq(pdfShareRequests.toUserId, user.id)
          ),
        });

        if (!shareRequest) {
          return reply.code(404).send({ message: "Share request not found" });
        }

        // Delete the share request
        await db
          .delete(pdfShareRequests)
          .where(eq(pdfShareRequests.id, id));

        return reply.send({ message: "Share request rejected" });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ message: "Failed to reject share request" });
      }
    }
  );
}
