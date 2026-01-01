import WebSocket from "ws";

const WS_URL = process.env.WS_URL ?? "ws://localhost:3000/ws";
const TOKEN = process.env.TOKEN;
const WORKSPACE_ID = process.env.WORKSPACE_ID;

// optional
const TEXT_CHANNEL_ID = process.env.TEXT_CHANNEL_ID;
const VOICE_CHANNEL_ID = process.env.VOICE_CHANNEL_ID;

// optional toggles
const USE_JOIN_REQUEST = process.env.USE_JOIN_REQUEST === "1"; // falls euer Server VOICE:JOIN_REQUEST erwartet

if (!TOKEN) throw new Error("Missing env TOKEN");
if (!WORKSPACE_ID) throw new Error("Missing env WORKSPACE_ID");

const ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(TOKEN)}`);

ws.on("open", () => {
    console.log("WS connected");

    // 1) Workspace subscribe (Presence + Voice Events workspace-scoped)
    ws.send(
        JSON.stringify({
            type: "WS:SUBSCRIBE",
            payload: { workspaceId: WORKSPACE_ID },
        })
    );

    // 2) Optional: Text-Channel subscribe + send a few messages
    if (TEXT_CHANNEL_ID) {
        ws.send(JSON.stringify({ type: "WS:SUBSCRIBE", payload: { channelId: TEXT_CHANNEL_ID } }));

        for (let i = 1; i <= 3; i++) {
            ws.send(
                JSON.stringify({
                    type: "CHAT:SEND",
                    payload: { channelId: TEXT_CHANNEL_ID, content: `Hello from ws-test #${i}` },
                })
            );
        }
    }

    // 3) Optional: Voice join
    if (VOICE_CHANNEL_ID) {
        const joinType = USE_JOIN_REQUEST ? "VOICE:JOIN_REQUEST" : "VOICE:JOIN";
        console.log(`=> ${joinType}(${VOICE_CHANNEL_ID})`);

        ws.send(
            JSON.stringify({
                type: joinType,
                payload: { channelId: VOICE_CHANNEL_ID },
            })
        );

        // Leave after 10s
        setTimeout(() => {
            console.log("=> VOICE:LEAVE");
            ws.send(JSON.stringify({ type: "VOICE:LEAVE", payload: {} }));
        }, 10_000);
    }
});

ws.on("message", (data) => {
    try {
        const msg = JSON.parse(data.toString());
        console.log("<= ", msg);
    } catch {
        console.log("<= (non-json)", data.toString());
    }
});

ws.on("close", (code, reason) => {
    console.log("WS closed", code, reason.toString());
});

ws.on("error", (err) => {
    console.error("WS error", err);
});
