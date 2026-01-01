import WebSocket from "ws";

type Member = { userId: string; email: string; role: string };
type Channel = { id: string; name: string; type: "text" | "voice" };

type VoiceUserState = {
    userId: string;
    muted: boolean;
    deafened: boolean;
    speaking: boolean;
};

const API_URL = process.env.API_URL ?? "http://localhost:3000";
const WS_URL = process.env.WS_URL ?? "ws://localhost:3000/ws";
const TOKEN = process.env.TOKEN;
const WORKSPACE_ID = process.env.WORKSPACE_ID;

if (!TOKEN) throw new Error("Missing env TOKEN");
if (!WORKSPACE_ID) throw new Error("Missing env WORKSPACE_ID");

async function apiGet<T>(path: string): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, {
        headers: { authorization: `Bearer ${TOKEN}` },
    });
    if (!res.ok) throw new Error(`${path} failed: ${res.status} ${await res.text()}`);
    return (await res.json()) as T;
}

function clear() {
    process.stdout.write("\x1Bc");
}

function flags(u: VoiceUserState) {
    const parts: string[] = [];
    parts.push(u.speaking ? "🎙️" : "  ");
    if (u.muted) parts.push("🔇");
    if (u.deafened) parts.push("🔕");
    return parts.length ? ` ${parts.join(" ")}` : "";
}

function render(
    channels: Channel[],
    membersById: Map<string, string>,
    voiceState: Map<string, VoiceUserState[]>
) {
    clear();
    console.log(`Workspace: ${WORKSPACE_ID}`);
    console.log("");

    const voiceChannels = channels.filter((c) => c.type === "voice");

    if (voiceChannels.length === 0) {
        console.log("No voice channels found.");
        return;
    }

    for (const ch of voiceChannels) {
        const usersArr = voiceState.get(ch.id) ?? [];
        console.log(`🔊 ${ch.name}  (${usersArr.length})`);

        if (usersArr.length === 0) {
            console.log("   (empty)");
        } else {
            // stable sort: speaking first, then email
            const sorted = usersArr.slice().sort((a, b) => {
                if (a.speaking !== b.speaking) return a.speaking ? -1 : 1;
                const ea = membersById.get(a.userId) ?? a.userId;
                const eb = membersById.get(b.userId) ?? b.userId;
                return ea.localeCompare(eb);
            });

            for (const u of sorted) {
                const label = membersById.get(u.userId) ?? u.userId;
                console.log(`   🟢 ${label}${flags(u)}`);
            }
        }
        console.log("");
    }
}

async function main() {
    // 1) Load members + channels
    const membersRes = await apiGet<{ items: Member[] }>(`/workspaces/${WORKSPACE_ID}/members`);
    const wsRes = await apiGet<{ channels: Channel[] }>(`/workspaces/${WORKSPACE_ID}`);

    const membersById = new Map<string, string>();
    for (const m of membersRes.items) membersById.set(m.userId, m.email);

    const channels = wsRes.channels;

    // state: channelId -> users[]
    const voiceState = new Map<string, VoiceUserState[]>();

    // 2) Optional initial voice snapshot via REST (if endpoint exists)
    try {
        const voiceRes = await apiGet<{ items: { channelId: string; users: string[] }[] }>(
            `/workspaces/${WORKSPACE_ID}/voice-state`
        );

        // voice-state endpoint (older) returns users: string[]
        // convert into VoiceUserState[] with defaults
        for (const s of voiceRes.items) {
            voiceState.set(
                s.channelId,
                (s.users ?? []).map((userId) => ({ userId, muted: false, deafened: false, speaking: false }))
            );
        }
    } catch {
        // ok if endpoint doesn't exist or returns new format
    }

    render(channels, membersById, voiceState);

    // 3) WS subscribe workspace -> receive VOICE:* events
    const ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(TOKEN!)}`);

    ws.on("open", () => {
        ws.send(JSON.stringify({ type: "WS:SUBSCRIBE", payload: { workspaceId: WORKSPACE_ID } }));
    });

    ws.on("message", (data) => {
        let msg: any;
        try {
            msg = JSON.parse(data.toString());
        } catch {
            return;
        }

        // New format (from realtime.ts): users: { userId, muted, deafened, speaking }[]
        if (msg.type === "VOICE:STATE") {
            const { workspaceId, channelId, users } = msg.payload ?? {};
            if (workspaceId !== WORKSPACE_ID) return;

            if (Array.isArray(users) && users.length > 0 && typeof users[0] === "object") {
                voiceState.set(channelId, users as VoiceUserState[]);
            } else {
                // fallback if some older server sends string[]
                voiceState.set(
                    channelId,
                    (users ?? []).map((userId: string) => ({
                        userId,
                        muted: false,
                        deafened: false,
                        speaking: false,
                    }))
                );
            }

            render(channels, membersById, voiceState);
            return;
        }

        // Optional JOINED/LEFT handling (server also sends STATE, but keep this robust)
        if (msg.type === "VOICE:JOINED") {
            const { workspaceId, channelId, userId } = msg.payload ?? {};
            if (workspaceId !== WORKSPACE_ID) return;

            const arr = voiceState.get(channelId) ?? [];
            if (!arr.some((u) => u.userId === userId)) {
                arr.push({ userId, muted: false, deafened: false, speaking: false });
                voiceState.set(channelId, arr);
                render(channels, membersById, voiceState);
            }
            return;
        }

        if (msg.type === "VOICE:LEFT") {
            const { workspaceId, channelId, userId } = msg.payload ?? {};
            if (workspaceId !== WORKSPACE_ID) return;

            const arr = voiceState.get(channelId) ?? [];
            const next = arr.filter((u) => u.userId !== userId);
            voiceState.set(channelId, next);
            render(channels, membersById, voiceState);
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
