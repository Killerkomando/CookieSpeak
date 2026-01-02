import { useEffect, useMemo, useState } from "react";
import type { ControlState, ServerToClient, VoiceState } from "./types";
import { createControlWs } from "./ws";

const initial: ControlState = { channels: [], participants: [] };

export function useVoiceStore() {
    const [state, setState] = useState<ControlState>(initial);

    const token = useMemo(() => {
        // MVP: Token z.B. aus localStorage. Später: Login / JWT flow.
        const t = localStorage.getItem("cookiespeak_token") ?? "DEV_TOKEN";
        console.log(t);
        return t;
    }, []);

    const apiWs = import.meta.env.VITE_API_WS as string;

    const [ctrl, setCtrl] = useState<ReturnType<typeof createControlWs> | null>(null);

    useEffect(() => {
        const c = createControlWs({
            url: apiWs,
            token,
            onMessage: (msg) => handle(msg),
            onOpen: () => {
                console.log("[WS] open");
                // MVP: subscribe zu channels + voice
                c.send({ t: "subscribe", topics: ["channels", "voice"] });
            },
        });
        setCtrl(c);
        return () => c.ws.close();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiWs, token]);

    const handle = (msg: ServerToClient) => {
        setState((s) => {
            switch (msg.t) {
                case "channels:list":
                    return { ...s, channels: msg.channels };
                case "voice:joined":
                    return {
                        ...s,
                        currentChannelId: msg.channelId,
                        livekit: { url: msg.livekitUrl, token: msg.token },
                        participants: msg.participants,
                    };
                case "voice:left":
                    return { ...s, currentChannelId: undefined, livekit: undefined, participants: [] };
                case "voice:participants":
                    return { ...s, participants: msg.participants };
                case "voice:stateUpdate": {
                    const participants = s.participants.map((p) =>
                        p.userId === msg.userId
                            ? {
                                ...p,
                                muted: msg.muted ?? p.muted,
                                deafened: msg.deafened ?? p.deafened,
                                speaking: msg.speaking ?? p.speaking,
                            }
                            : p,
                    );
                    return { ...s, participants };
                }
                default:
                    return s;
            }
        });
    };

    const actions = {
        join: (channelId: string) => ctrl?.send({ t: "voice:join", channelId }),
        leave: () => ctrl?.send({ t: "voice:leave" }),
        setMute: (muted: boolean) => ctrl?.send({ t: "voice:setMute", muted }),
        setDeafen: (deafened: boolean) => ctrl?.send({ t: "voice:setDeafen", deafened }),
    };

    // Hilfswerte für “mein” State (MVP: erster participant == ich wäre falsch; später userId aus JWT)
    const me: VoiceState | undefined = state.participants[0];

    return { state, actions, me };
}
