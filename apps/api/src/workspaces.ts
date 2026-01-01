import type { FastifyInstance } from "fastify";
import { CreateWorkspaceBody, CreateChannelBody } from "@tsa/shared";
import { prisma } from "./prisma.js";

export async function workspaceRoutes(app: FastifyInstance) {
  app.addHook("onRequest", app.authenticate);

  app.post("/workspaces", async (req, reply) => {
    const body = CreateWorkspaceBody.parse(req.body);
    const userId = (req.user as any).sub as string;

    const ws = await prisma.workspace.create({
      data: {
        name: body.name,
        ownerId: userId,
        members: { create: { userId, role: "owner" } },
      },
    });

    await prisma.channel.createMany({
      data: [
        { workspaceId: ws.id, name: "general", type: "text" },
        { workspaceId: ws.id, name: "Lobby", type: "voice" },
      ],
    });

    return reply.send({ workspace: ws });
  });

  app.get("/workspaces/:id", async (req, reply) => {
    const { id } = req.params as any;
    const userId = (req.user as any).sub as string;

    const member = await prisma.membership.findUnique({
      where: { userId_workspaceId: { userId, workspaceId: id } },
    });
    if (!member) return reply.code(403).send({ error: "not_a_member" });

    const workspace = await prisma.workspace.findUnique({ where: { id } });
    const channels = await prisma.channel.findMany({
      where: { workspaceId: id },
      orderBy: { createdAt: "asc" },
    });

    return reply.send({ workspace, channels });
  });

  app.post("/channels", async (req, reply) => {
    const body = CreateChannelBody.parse(req.body);
    const userId = (req.user as any).sub as string;

    const member = await prisma.membership.findUnique({
      where: { userId_workspaceId: { userId, workspaceId: body.workspaceId } },
    });
    if (!member) return reply.code(403).send({ error: "not_a_member" });

    const channel = await prisma.channel.create({
      data: { workspaceId: body.workspaceId, name: body.name, type: body.type },
    });

    return reply.send({ channel });
  });
}
