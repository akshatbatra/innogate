import { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";

export async function authRoutes(fastify: FastifyInstance) {
  // POST /api/auth/init - Initialize user in database on first login
  fastify.post(
    "/api/auth/init",
    {
      preHandler: fastify.requireAuth(),
    },
    async (request, reply) => {
      const userEmail = (request.user as any)?.['https://innogate.app/email'] as string | undefined;
      const auth0Sub = (request.user as any)?.sub as string | undefined;

      if (!userEmail) {
        return reply.code(401).send({ message: "Unauthorized - email not found in token" });
      }

      if (!auth0Sub) {
        return reply.code(401).send({ message: "Unauthorized - Auth0 subject not found" });
      }

      try {
        // Check if user already exists
        let user = await db.query.users.findFirst({
          where: eq(users.email, userEmail),
        });

        if (user) {
          // User already exists, return their info
          return reply.send({
            id: user.id,
            email: user.email,
            createdAt: user.createdAt,
            isNewUser: false,
          });
        }

        // Create new user
        const [newUser] = await db
          .insert(users)
          .values({
            email: userEmail,
            auth0Sub: auth0Sub,
          })
          .returning();

        return reply.send({
          id: newUser.id,
          email: newUser.email,
          createdAt: newUser.createdAt,
          isNewUser: true,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ message: "Failed to initialize user" });
      }
    }
  );

  // GET /api/auth/me - Get current user info
  fastify.get(
    "/api/auth/me",
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
          return reply.code(404).send({ message: "User not found - call /api/auth/init first" });
        }

        return reply.send({
          id: user.id,
          email: user.email,
          createdAt: user.createdAt,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ message: "Failed to fetch user info" });
      }
    }
  );
}
