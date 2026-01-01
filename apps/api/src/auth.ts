import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { RegisterBody, LoginBody } from "@tsa/shared";
import { prisma } from "./prisma.js";

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/register", async (req, reply) => {
    const body = RegisterBody.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) return reply.code(409).send({ error: "email_taken" });

    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await prisma.user.create({ data: { email: body.email, passwordHash } });

    const token = app.jwt.sign({ sub: user.id });
    return reply.send({ token, user: { id: user.id, email: user.email } });
  });

  app.post("/auth/login", async (req, reply) => {
    const body = LoginBody.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user) return reply.code(401).send({ error: "invalid_credentials" });

    const ok = await bcrypt.compare(body.password, user.passwordHash);
    if (!ok) return reply.code(401).send({ error: "invalid_credentials" });

    const token = app.jwt.sign({ sub: user.id });
    return reply.send({ token, user: { id: user.id, email: user.email } });
  });
}
