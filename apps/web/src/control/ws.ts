import type { ClientToServer, ServerToClient } from "./types";

export function createControlWs(opts: {
    url: string;
    token: string;
    onMessage: (msg: ServerToClient) => void;
    onOpen?: () => void;
    onClose?: () => void;
}) {
    const ws = new WebSocket(`${opts.url}?token=${encodeURIComponent(opts.token)}`);

    ws.addEventListener("open", () => opts.onOpen?.());
    ws.addEventListener("close", () => opts.onClose?.());
    ws.addEventListener("message", (ev) => {
        console.log("[WS IN]", ev.data);
        try {
            const msg = JSON.parse(ev.data) as ServerToClient;
            opts.onMessage(msg);
        } catch (e) {
            console.warn("WS parse failed", e);
        }
    });

    const send = (m: ClientToServer) => ws.readyState === ws.OPEN && ws.send(JSON.stringify(m));

    return { ws, send };
}
