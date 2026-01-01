import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AccessToken } from "livekit-server-sdk";
import { prisma } from "./prisma.js";

const JoinVoiceBody = z.object({
    channelId: z.string().min(8),
});

export async function voiceRoutes(app: FastifyInstance) {
    app.addHook("onRequest", app.authenticate);

    // GET /workspaces/:id/voice-state
    app.get("/workspaces/:id/voice-state", async (req, reply) => {
        const { id: workspaceId } = req.params as { id: string };
        const userId = (req.user as any).sub as string;

        const member = await prisma.membership.findUnique({
            where: { userId_workspaceId: { userId, workspaceId } },
        });
        if (!member) return reply.code(403).send({ error: "not_a_member" });

        const sessions = await prisma.voiceSession.findMany({
            where: { workspaceId },
            select: {
                channelId: true,
                participants: { select: { userId: true } },
            },
        });

        return reply.send({
            items: sessions.map((s) => ({
                channelId: s.channelId,
                users: s.participants.map((p) => p.userId),
            })),
        });
    });

    // POST /voice/join  { channelId }
    app.post("/voice/join", async (req, reply) => {
        const body = JoinVoiceBody.parse(req.body);
        const userId = (req.user as any).sub as string;

        const channel = await prisma.channel.findUnique({ where: { id: body.channelId } });
        if (!channel) return reply.code(404).send({ error: "channel_not_found" });
        if (channel.type !== "voice") return reply.code(400).send({ error: "not_a_voice_channel" });

        const membership = await prisma.membership.findUnique({
            where: { userId_workspaceId: { userId, workspaceId: channel.workspaceId } },
        });
        if (!membership) return reply.code(403).send({ error: "not_a_member" });

        // Create or get session (1 session per voice channel)
        const session = await prisma.voiceSession.upsert({
            where: { channelId: channel.id },
            update: {},
            create: { channelId: channel.id, workspaceId: channel.workspaceId },
        });

        // Upsert participant
        await prisma.voiceParticipant.upsert({
            where: { sessionId_userId: { sessionId: session.id, userId } },
            update: {},
            create: { sessionId: session.id, userId },
        });

        // LiveKit config
        const LIVEKIT_URL = process.env.LIVEKIT_URL;
        const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
        const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

        if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
            return reply.code(500).send({ error: "livekit_not_configured" });
        }

        // Stable, unique room name per voice channel
        const room = `ws_${channel.workspaceId}_ch_${channel.id}`;

        // Create LiveKit JWT
        const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
            identity: userId,
            // some versions accept number seconds; others accept string like "2h".
            // using seconds is the most compatible:
            ttl: 2 * 60 * 60,
        });

        at.addGrant({
            room,
            roomJoin: true,
            canPublish: true,
            canSubscribe: true,
        });

        const token = await at.toJwt();

        return reply.send({
            sessionId: session.id,
            joinInfo: {
                provider: "livekit",
                url: LIVEKIT_URL,
                room,
                token,
            },
        });
    });

    // POST /voice/leave
    // MVP: user leaves all voice sessions
    app.post("/voice/leave", async (req, reply) => {
        const userId = (req.user as any).sub as string;

        await prisma.voiceParticipant.deleteMany({ where: { userId } });
        return reply.send({ ok: true });
    });
}
