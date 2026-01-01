import type { FastifyInstance } from "fastify";
import type WebSocket from "ws";
import { WsClientEvent, type WsServerEvent } from "@tsa/shared";
import { prisma } from "./prisma.js";

type Conn = {
    ws: WebSocket;
    userId: string;
    workspaceId?: string;
    channelId?: string;
};

const connections = new Set<Conn>();

function send(ws: WebSocket, evt: WsServerEvent) {
    ws.send(JSON.stringify(evt));
}

function broadcast(filter: (c: Conn) => boolean, evt: WsServerEvent) {
    for (const c of connections) {
        if (filter(c)) send(c.ws, evt);
    }
}

async function isMember(userId: string, workspaceId: string) {
    const m = await prisma.membership.findUnique({
        where: { userId_workspaceId: { userId, workspaceId } },
    });
    return Boolean(m);
}

function getOnlineUserIds(workspaceId: string): string[] {
    const ids = new Set<string>();
    for (const c of connections) {
        if (c.workspaceId === workspaceId) ids.add(c.userId);
    }
    return Array.from(ids);
}

// speaking state is transient; do not store in DB
const speakingBySessionUser = new Map<string, boolean>();
const speakKey = (sessionId: string, userId: string) => `${sessionId}:${userId}`;

async function broadcastVoiceState(opts: {
    workspaceId: string;
    channelId: string;
    sessionId: string;
}) {
    const parts = await prisma.voiceParticipant.findMany({
        where: { sessionId: opts.sessionId },
        select: { userId: true, muted: true, deafened: true },
    });

    const users = parts.map((p) => ({
        userId: p.userId,
        muted: p.muted,
        deafened: p.deafened,
        speaking: speakingBySessionUser.get(speakKey(opts.sessionId, p.userId)) ?? false,
    }));

    broadcast(
        (c) => c.workspaceId === opts.workspaceId,
        {
            type: "VOICE:STATE",
            payload: { workspaceId: opts.workspaceId, channelId: opts.channelId, users },
        } as any
    );
}

export async function realtimeRoutes(app: FastifyInstance) {
    app.get("/ws", { websocket: true }, async (ws, req) => {
        const { token } = (req.query as any) ?? {};
        if (!token) {
            ws.close(1008, "missing_token");
            return;
        }

        let userId = "";
        try {
            const decoded = app.jwt.verify(token) as any;
            userId = decoded.sub as string;
            if (!userId) throw new Error("missing_sub");
        } catch {
            ws.close(1008, "invalid_token");
            return;
        }

        const entry: Conn = { ws, userId };
        connections.add(entry);

        ws.on("message", async (raw) => {
            let data: any;
            try {
                data = JSON.parse(raw.toString());
            } catch {
                return;
            }

            const parsed = WsClientEvent.safeParse(data);
            if (!parsed.success) return;
            const evt = parsed.data;

            // ---- WS:SUBSCRIBE ----
            if (evt.type === "WS:SUBSCRIBE") {
                const { workspaceId, channelId } = evt.payload;

                if (!workspaceId && !channelId) {
                    ws.close(1008, "missing_workspace_or_channel");
                    return;
                }

                // workspace subscribe
                if (workspaceId) {
                    const ok = await isMember(userId, workspaceId);
                    if (!ok) {
                        ws.close(1008, "not_a_member");
                        return;
                    }
                    entry.workspaceId = workspaceId;
                    entry.channelId = undefined;
                }

                // channel subscribe (also sets workspace)
                if (channelId) {
                    const ch = await prisma.channel.findUnique({ where: { id: channelId } });
                    if (!ch) {
                        ws.close(1008, "channel_not_found");
                        return;
                    }

                    const ok = await isMember(userId, ch.workspaceId);
                    if (!ok) {
                        ws.close(1008, "not_a_member");
                        return;
                    }

                    entry.workspaceId = ch.workspaceId;
                    entry.channelId = channelId;
                }

                // ACK
                send(ws, {
                    type: "WS:SUBSCRIBED",
                    payload: { workspaceId: entry.workspaceId, channelId: entry.channelId },
                } as any);

                // Presence snapshot + online broadcast
                if (entry.workspaceId) {
                    const wid = entry.workspaceId;

                    send(ws, {
                        type: "PRESENCE:SNAPSHOT",
                        payload: { workspaceId: wid, onlineUserIds: getOnlineUserIds(wid) },
                    } as any);

                    broadcast(
                        (c) => c.workspaceId === wid,
                        {
                            type: "PRESENCE:UPDATE",
                            payload: { workspaceId: wid, userId, status: "online" },
                        } as any
                    );
                }

                return;
            }

            // ---- CHAT:SEND ----
            if (evt.type === "CHAT:SEND") {
                const { channelId, content } = evt.payload;

                const channel = await prisma.channel.findUnique({ where: { id: channelId } });
                if (!channel) return;

                const ok = await isMember(userId, channel.workspaceId);
                if (!ok) return;

                const msg = await prisma.message.create({
                    data: { channelId, userId, content },
                });

                const serverEvt: WsServerEvent = {
                    type: "CHAT:MESSAGE_NEW",
                    payload: {
                        id: msg.id,
                        channelId: msg.channelId,
                        userId: msg.userId,
                        content: msg.content,
                        createdAt: msg.createdAt.toISOString(),
                    },
                };

                // broadcast only to users subscribed to this channel
                broadcast((c) => c.channelId === channelId, serverEvt);
                return;
            }

            // ---- VOICE:JOIN ----
            if (evt.type === "VOICE:JOIN") {
                const { channelId } = evt.payload;

                const channel = await prisma.channel.findUnique({ where: { id: channelId } });
                if (!channel || channel.type !== "voice") return;

                const ok = await isMember(userId, channel.workspaceId);
                if (!ok) return;

                const session = await prisma.voiceSession.upsert({
                    where: { channelId },
                    update: {},
                    create: { channelId, workspaceId: channel.workspaceId },
                });

                await prisma.voiceParticipant.upsert({
                    where: { sessionId_userId: { sessionId: session.id, userId } },
                    update: {},
                    create: { sessionId: session.id, userId },
                });

                broadcast(
                    (c) => c.workspaceId === channel.workspaceId,
                    {
                        type: "VOICE:JOINED",
                        payload: { workspaceId: channel.workspaceId, channelId, userId },
                    } as any
                );

                await broadcastVoiceState({
                    workspaceId: channel.workspaceId,
                    channelId,
                    sessionId: session.id,
                });

                return;
            }

            // ---- VOICE:LEAVE ----
            if (evt.type === "VOICE:LEAVE") {
                const parts = await prisma.voiceParticipant.findMany({
                    where: { userId },
                    select: {
                        sessionId: true,
                        session: { select: { channelId: true, workspaceId: true } },
                    },
                });

                await prisma.voiceParticipant.deleteMany({ where: { userId } });

                // cleanup speaking state
                for (const key of Array.from(speakingBySessionUser.keys())) {
                    if (key.endsWith(`:${userId}`)) speakingBySessionUser.delete(key);
                }

                for (const p of parts) {
                    broadcast(
                        (c) => c.workspaceId === p.session.workspaceId,
                        {
                            type: "VOICE:LEFT",
                            payload: { workspaceId: p.session.workspaceId, channelId: p.session.channelId, userId },
                        } as any
                    );

                    await broadcastVoiceState({
                        workspaceId: p.session.workspaceId,
                        channelId: p.session.channelId,
                        sessionId: p.sessionId,
                    });
                }

                return;
            }

            // ---- VOICE:SET_STATE (muted/deafened) ----
            if (evt.type === "VOICE:SET_STATE") {
                const { channelId, muted, deafened } = evt.payload;

                const channel = await prisma.channel.findUnique({ where: { id: channelId } });
                if (!channel || channel.type !== "voice") return;

                const ok = await isMember(userId, channel.workspaceId);
                if (!ok) return;

                const session = await prisma.voiceSession.findUnique({ where: { channelId } });
                if (!session) return;

                const existing = await prisma.voiceParticipant.findUnique({
                    where: { sessionId_userId: { sessionId: session.id, userId } },
                });
                if (!existing) return;

                await prisma.voiceParticipant.update({
                    where: { sessionId_userId: { sessionId: session.id, userId } },
                    data: {
                        ...(muted !== undefined ? { muted } : {}),
                        ...(deafened !== undefined ? { deafened } : {}),
                    },
                });

                await broadcastVoiceState({
                    workspaceId: channel.workspaceId,
                    channelId,
                    sessionId: session.id,
                });

                return;
            }

            // ---- VOICE:SPEAKING (transient) ----
            if (evt.type === "VOICE:SPEAKING") {
                const { channelId, speaking } = evt.payload;

                const channel = await prisma.channel.findUnique({ where: { id: channelId } });
                if (!channel || channel.type !== "voice") return;

                const ok = await isMember(userId, channel.workspaceId);
                if (!ok) return;

                const session = await prisma.voiceSession.findUnique({ where: { channelId } });
                if (!session) return;

                const existing = await prisma.voiceParticipant.findUnique({
                    where: { sessionId_userId: { sessionId: session.id, userId } },
                });
                if (!existing) return;

                speakingBySessionUser.set(speakKey(session.id, userId), speaking);

                await broadcastVoiceState({
                    workspaceId: channel.workspaceId,
                    channelId,
                    sessionId: session.id,
                });

                return;
            }
        });

        ws.on("close", () => {
            connections.delete(entry);

            if (entry.workspaceId) {
                const wid = entry.workspaceId;

                broadcast(
                    (c) => c.workspaceId === wid,
                    {
                        type: "PRESENCE:UPDATE",
                        payload: { workspaceId: wid, userId, status: "offline" },
                    } as any
                );
            }
        });

        ws.on("error", () => {
            // close handler cleans up
        });
    });
}
