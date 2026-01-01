import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "./prisma.js";

const AddMemberBody = z.object({
    email: z.string().email(),
    role: z.string().min(1).max(32).optional(), // default "member"
});

export async function memberRoutes(app: FastifyInstance) {
    app.addHook("onRequest", app.authenticate);

    // GET /workspaces/:id/members
    app.get("/workspaces/:id/members", async (req, reply) => {
        const { id: workspaceId } = req.params as { id: string };
        const userId = (req.user as any).sub as string;

        // requester must be member
        const member = await prisma.membership.findUnique({
            where: { userId_workspaceId: { userId, workspaceId } },
        });
        if (!member) return reply.code(403).send({ error: "not_a_member" });

        const members = await prisma.membership.findMany({
            where: { workspaceId },
            select: {
                role: true,
                user: {
                    select: {
                        id: true,
                        email: true,
                        createdAt: true,
                    },
                },
            },
            orderBy: { role: "asc" },
        });

        return reply.send({
            items: members.map((m) => ({
                userId: m.user.id,
                email: m.user.email,
                role: m.role,
                createdAt: m.user.createdAt.toISOString(),
            })),
        });
    });

    // GET /workspaces/:id/me  (optional helper)
    app.get("/workspaces/:id/me", async (req, reply) => {
        const { id: workspaceId } = req.params as { id: string };
        const userId = (req.user as any).sub as string;

        const membership = await prisma.membership.findUnique({
            where: { userId_workspaceId: { userId, workspaceId } },
            select: { role: true },
        });
        if (!membership) return reply.code(403).send({ error: "not_a_member" });

        return reply.send({ workspaceId, userId, role: membership.role });
    });

    // POST /workspaces/:id/members  { email, role? }  (owner adds member)
    app.post("/workspaces/:id/members", async (req, reply) => {
        const { id: workspaceId } = req.params as { id: string };
        const body = AddMemberBody.parse(req.body);
        const requesterId = (req.user as any).sub as string;

        const ws = await prisma.workspace.findUnique({ where: { id: workspaceId } });
        if (!ws) return reply.code(404).send({ error: "workspace_not_found" });

        if (ws.ownerId !== requesterId) return reply.code(403).send({ error: "not_owner" });

        const user = await prisma.user.findUnique({ where: { email: body.email } });
        if (!user) return reply.code(404).send({ error: "user_not_found" });

        const role = body.role ?? "member";

        const membership = await prisma.membership.upsert({
            where: { userId_workspaceId: { userId: user.id, workspaceId } },
            update: { role },
            create: { userId: user.id, workspaceId, role },
        });

        return reply.send({
            membership: {
                userId: membership.userId,
                workspaceId: membership.workspaceId,
                role: membership.role,
            },
        });
    });
}
