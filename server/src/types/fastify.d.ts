import "@auth0/auth0-fastify-api";

declare module "fastify" {
  interface FastifyRequest {
    auth?: {
      payload?: {
        [key: string]: any;
      };
    };
    user?: {
      email?: string;
      [key: string]: any;
    };
  }

  interface FastifyInstance {
    requireAuth(): void;
  }
}
