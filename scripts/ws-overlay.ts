import WebSocket from "ws";

type Member = { userId: string; email: string; role: string };

const API_URL = process.env.API_URL ?? "http://localhost:3000";
const WS_URL = process.env.WS_URL ?? "ws://localhost:3000/ws";
const TOKEN = process.env.TOKEN;
const WORKSPACE_ID = process.env.WORKSPACE_ID;

if (!TOKEN) throw new Error("Missing env TOKEN");
if (!WORKSPACE_ID) throw new Error("Missing env WORKSPACE_ID");

async function fetchMembers(): Promise<Member[]> {
    const res = await fetch(`${API_URL}/workspaces/${WORKSPACE_ID}/members`, {
        headers: { authorization: `Bearer ${TOKEN}` },
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`GET members failed: ${res.status} ${text}`);
    }
    const json = await res.json();
    return json.items as Member[];
}

function printOverlay(members: Member[], onlineSet: Set<string>) {
    const rows = members
        .slice()
        .sort((a, b) => a.email.localeCompare(b.email))
        .map((m) => {
            const online = onlineSet.has(m.userId);
            return `${online ? "🟢" : "⚫"} ${m.email}  (${m.role})`;
        });

    console.clear();
    console.log(`Workspace: ${WORKSPACE_ID}`);
    console.log(`Online: ${onlineSet.size}/${members.length}`);
    console.log(rows.join("\n"));
}

async function main() {
    const members = await fetchMembers();
    const onlineSet = new Set<string>();

    const ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(TOKEN!)}`);

    ws.on("open", () => {
        ws.send(
            JSON.stringify({
                type: "WS:SUBSCRIBE",
                payload: { workspaceId: WORKSPACE_ID },
            })
        );
    });

    ws.on("message", (data) => {
        let msg: any;
        try {
            msg = JSON.parse(data.toString());
        } catch {
            return;
        }

        if (msg.type === "PRESENCE:SNAPSHOT") {
            // payload: { workspaceId, onlineUserIds }
            onlineSet.clear();
            for (const id of msg.payload.onlineUserIds ?? []) onlineSet.add(id);
            printOverlay(members, onlineSet);
            return;
        }

        if (msg.type === "PRESENCE:UPDATE") {
            // payload: { workspaceId, userId, status }
            if (msg.payload.workspaceId !== WORKSPACE_ID) return;

            const { userId, status } = msg.payload;
            if (status === "offline") onlineSet.delete(userId);
            else onlineSet.add(userId); // online/away/dnd zählen als "online"

            printOverlay(members, onlineSet);
            return;
        }
    });

    ws.on("close", (code, reason) => {
        console.log("WS closed", code, reason.toString());
    });

    ws.on("error", (err) => {
        console.error("WS error", err);
    });
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
