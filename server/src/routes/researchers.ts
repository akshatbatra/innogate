import { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import { db } from "../db/index.js";
import { users, linkedResearchers } from "../db/schema.js";

export async function researcherRoutes(fastify: FastifyInstance) {
  // GET /api/researchers - Get all linked researchers for a user
  fastify.get(
    "/api/researchers",
    {
      preHandler: fastify.requireAuth(),
    },
    async (request, reply) => {
      const userEmail = (request.user as any)?.['https://innogate.app/email'] as string | undefined;

      if (!userEmail) {
        return reply.code(401).send({ message: "Unauthorized" });
      }

      try {
        // Find or create user
        let user = await db.query.users.findFirst({
          where: eq(users.email, userEmail),
        });

        if (!user) {
          return reply.send([]);
        }

        // Get linked researchers for this user
        const researchers = await db.query.linkedResearchers.findMany({
          where: eq(linkedResearchers.userId, user.id),
          orderBy: (linkedResearchers, { desc }) => [
            desc(linkedResearchers.createdAt),
          ],
        });

        return reply.send(
          researchers.map((r) => ({
            id: r.id,
            orcidId: r.orcidId,
            researcherName: r.researcherName,
            createdAt: r.createdAt,
          }))
        );
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ message: "Failed to fetch researchers" });
      }
    }
  );

  // POST /api/researchers/link - Link a researcher to a user
  fastify.post<{
    Body: {
      orcidId: string;
      researcherName?: string;
    };
  }>(
    "/api/researchers/link",
    {
      preHandler: fastify.requireAuth(),
    },
    async (request, reply) => {
      const { orcidId, researcherName } = request.body;
      const userEmail = (request.user as any)?.['https://innogate.app/email'] as string | undefined;

      if (!orcidId) {
        return reply.code(400).send({ message: "ORCID ID is required" });
      }

      if (!userEmail) {
        return reply.code(401).send({ message: "Unauthorized" });
      }

      try {
        // Find user
        let user = await db.query.users.findFirst({
          where: eq(users.email, userEmail),
        });

        if (!user) {
          return reply.code(404).send({ message: "User not found - please log in again" });
        }

        // Check if researcher is already linked
        const existing = await db.query.linkedResearchers.findFirst({
          where: and(
            eq(linkedResearchers.userId, user.id),
            eq(linkedResearchers.orcidId, orcidId)
          ),
        });

        if (existing) {
          return reply.code(409).send({ message: "Researcher already linked" });
        }

        // Link the researcher
        const [linked] = await db
          .insert(linkedResearchers)
          .values({
            userId: user.id,
            orcidId,
            researcherName: researcherName || null,
          })
          .returning();

        return reply.send({
          id: linked.id,
          orcidId: linked.orcidId,
          researcherName: linked.researcherName,
          createdAt: linked.createdAt,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ message: "Failed to link researcher" });
      }
    }
  );

  // DELETE /api/researchers/:id - Unlink a researcher
  fastify.delete<{
    Params: { id: string };
  }>(
    "/api/researchers/:id",
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
        // Verify the user owns this researcher link
        const user = await db.query.users.findFirst({
          where: eq(users.email, userEmail),
        });

        if (!user) {
          return reply.code(404).send({ message: "User not found" });
        }

        // Verify the researcher link belongs to this user
        const researcher = await db.query.linkedResearchers.findFirst({
          where: and(
            eq(linkedResearchers.id, id),
            eq(linkedResearchers.userId, user.id)
          ),
        });

        if (!researcher) {
          return reply.code(404).send({ message: "Researcher not found or access denied" });
        }

        await db.delete(linkedResearchers).where(eq(linkedResearchers.id, id));
        return reply.send({ message: "Researcher unlinked successfully" });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ message: "Failed to unlink researcher" });
      }
    }
  );
}
