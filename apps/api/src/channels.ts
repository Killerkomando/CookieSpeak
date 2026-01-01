import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "./prisma.js";

export async function channelRoutes(app: FastifyInstance) {
  app.addHook("onRequest", app.authenticate);

  // GET /channels/:id/messages?cursor=<messageId>&limit=50
  app.get("/channels/:id/messages", async (req, reply) => {
    const { id } = req.params as any;
    const { cursor, limit } = (req.query as any) ?? {};
    const userId = (req.user as any).sub as string;

    const take = Math.min(Math.max(Number(limit ?? 50), 1), 100);

    const channel = await prisma.channel.findUnique({ where: { id } });
    if (!channel) return reply.code(404).send({ error: "channel_not_found" });

    // auth: user must be member of the workspace
    const membership = await prisma.membership.findUnique({
      where: { userId_workspaceId: { userId, workspaceId: channel.workspaceId } },
    });
    if (!membership) return reply.code(403).send({ error: "not_a_member" });

    const messages = await prisma.message.findMany({
      where: { channelId: id },
      orderBy: { createdAt: "desc" },
      take: cursor ? take + 1 : take,
      ...(cursor
        ? { cursor: { id: String(cursor) }, skip: 1 } // skip cursor itself
        : {}),
      select: { id: true, channelId: true, userId: true, content: true, createdAt: true },
    });

    // return in ascending order for UI
    const items = messages.reverse();

    // nextCursor: the oldest message id in this page (for fetching older)
    const nextCursor = messages.length ? messages[messages.length - 1]!.id : null;

    return reply.send({
      items: items.map((m) => ({
        ...m,
        createdAt: m.createdAt.toISOString(),
      })),
      nextCursor,
    });
  });

  // POST /workspaces/:id/channels  { name, type: "text" | "voice" }
  app.post("/workspaces/:id/channels", async (req, reply) => {
      const { id: workspaceId } = req.params as { id: string };
      const userId = (req.user as any).sub as string;

      const Body = z.object({
          name: z.string().min(1).max(64),
          type: z.enum(["text", "voice"]),
      });

      const body = Body.parse(req.body);

      // requester must be member of workspace
      const member = await prisma.membership.findUnique({
          where: { userId_workspaceId: { userId, workspaceId } },
      });
      if (!member) return reply.code(403).send({ error: "not_a_member" });

      const channel = await prisma.channel.create({
          data: {
              workspaceId,
              name: body.name,
              type: body.type,
          },
      });

      return reply.send({ channel });
  });
}
