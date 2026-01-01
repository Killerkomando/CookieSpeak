import WebSocket from "ws";

const WS_URL = process.env.WS_URL ?? "ws://localhost:3000/ws";
const TOKEN_A = process.env.TOKEN;
const WORKSPACE_ID = process.env.WORKSPACE_ID;

if (!TOKEN_A) throw new Error("Missing env TOKEN");
if (!WORKSPACE_ID) throw new Error("Missing env WORKSPACE_ID");

const ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(TOKEN_A)}`);

ws.on("open", () => {
    console.log("WS connected");

    ws.send(
        JSON.stringify({
            type: "WS:SUBSCRIBE",
            payload: { workspaceId: WORKSPACE_ID },
        })
    );
});

ws.on("message", (data) => {
    console.log("<= ", data.toString());
    try {
        const msg = JSON.parse(data.toString());
        // wir filtern fürs bessere Lesen:
        if (msg?.type?.startsWith("PRESENCE:") || msg?.type?.startsWith("WS:")) {
            console.log("<= ", msg);
        }
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
