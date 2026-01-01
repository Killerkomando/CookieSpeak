import Fastify from "fastify";
import jwt from "@fastify/jwt";
import websocket from "@fastify/websocket";
import cors from "@fastify/cors";
import { authRoutes } from "./auth.js";
import { workspaceRoutes } from "./workspaces.js";
import { realtimeRoutes } from "./realtime.js";
import { channelRoutes } from "./channels.js";
import { memberRoutes } from "./members.js";
import { voiceRoutes } from "./voice.js";


const app = Fastify({ logger: true });

app.register(jwt, { secret: process.env.JWT_SECRET ?? "dev" });

app.decorate("authenticate", async function (req: any, reply: any) {
  try {
    await req.jwtVerify();
  } catch {
    reply.code(401).send({ error: "unauthorized" });
  }
});

app.register(websocket);

await app.register(cors, {
    origin: true, // dev: alles erlauben
    credentials: true,
});

app.get("/health", async () => ({ ok: true }));

app.register(authRoutes);
app.register(workspaceRoutes);
app.register(realtimeRoutes);
app.register(channelRoutes);
app.register(memberRoutes);
app.register(voiceRoutes);

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

app.listen({ port, host });
