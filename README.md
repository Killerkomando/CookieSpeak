# teamspeak-alt (MVP)

## Voraussetzungen
- pnpm (Node 20+ empfohlen)
- Docker Desktop (Windows) mit WSL Integration **oder** Docker auf Linux/WSL

## Start (lokal, WSL empfohlen)
1) DB starten:
```bash
docker compose -f infra/docker-compose.yml up -d
```

2) Dependencies installieren:
```bash
pnpm install
```

3) API konfigurieren:
```bash
cp apps/api/.env.example apps/api/.env
```

4) Prisma client + Migration:
```bash
cd apps/api
pnpm prisma:generate
pnpm prisma:migrate
```

5) API starten:
```bash
pnpm dev
```

Healthcheck:
- http://localhost:3000/health

WS:
- ws://localhost:3000/ws?token=JWT_TOKEN
