import { useMemo, useRef, useState } from "react";
import { Room, RoomEvent } from "livekit-client";

type JoinResponse = {
    sessionId: string;
    joinInfo: {
        provider: "livekit";
        url: string;
        room: string;
        token: string;
    };
};

export default function App() {
    const [apiUrl, setApiUrl] = useState("http://localhost:3000");
    const [bearerToken, setBearerToken] = useState("");
    const [voiceChannelId, setVoiceChannelId] = useState("");

    const [status, setStatus] = useState<string>("idle");
    const [connected, setConnected] = useState(false);

    const room = useMemo(() => new Room(), []);
    const audioElRef = useRef<HTMLAudioElement | null>(null);

    async function join() {
        setStatus("joining...");
        setConnected(false);

        const res = await fetch(`${apiUrl}/voice/join`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                authorization: `Bearer ${bearerToken}`,
            },
            body: JSON.stringify({ channelId: voiceChannelId }),
        });

        if (!res.ok) {
            const text = await res.text();
            setStatus(`API error ${res.status}: ${text}`);
            return;
        }

        const data = (await res.json()) as JoinResponse;

        // wire remote audio
        room.on(RoomEvent.TrackSubscribed, (track) => {
            if (track.kind === "audio") {
                const el = track.attach();
                // play through a single <audio> element
                if (audioElRef.current) {
                    audioElRef.current.srcObject = (el as any).srcObject ?? null;
                    audioElRef.current.play().catch(() => {});
                } else {
                    // fallback: attach to body
                    document.body.appendChild(el);
                }
            }
        });

        room.on(RoomEvent.Disconnected, () => {
            setConnected(false);
            setStatus("disconnected");
        });

        try {
            await room.connect(data.joinInfo.url, data.joinInfo.token);
            await room.localParticipant.setMicrophoneEnabled(true);
            setConnected(true);
            setStatus(`connected to room: ${data.joinInfo.room}`);
        } catch (e: any) {
            setStatus(`LiveKit connect failed: ${e?.message ?? String(e)}`);
        }
    }

    async function leave() {
        try {
            await room.disconnect();
        } finally {
            setConnected(false);
            setStatus("left");
        }
    }

    return (
        <div style={{ fontFamily: "system-ui", padding: 24, maxWidth: 720 }}>
            <h1>LiveKit Web Test</h1>

            <div style={{ display: "grid", gap: 12 }}>
                <label>
                    API URL
                    <input
                        value={apiUrl}
                        onChange={(e) => setApiUrl(e.target.value)}
                        style={{ width: "100%", padding: 8 }}
                        placeholder="http://localhost:3000"
                    />
                </label>

                <label>
                    Bearer Token (User JWT)
                    <input
                        value={bearerToken}
                        onChange={(e) => setBearerToken(e.target.value)}
                        style={{ width: "100%", padding: 8 }}
                        placeholder="eyJhbGciOi..."
                    />
                </label>

                <label>
                    Voice Channel ID
                    <input
                        value={voiceChannelId}
                        onChange={(e) => setVoiceChannelId(e.target.value)}
                        style={{ width: "100%", padding: 8 }}
                        placeholder="cmjv..."
                    />
                </label>

                <div style={{ display: "flex", gap: 12 }}>
                    <button
                        onClick={join}
                        disabled={!bearerToken || !voiceChannelId || connected}
                        style={{ padding: "10px 14px" }}
                    >
                        Join + Mic On
                    </button>

                    <button onClick={leave} disabled={!connected} style={{ padding: "10px 14px" }}>
                        Leave
                    </button>
                </div>

                <div>
                    <strong>Status:</strong> {status}
                </div>

                {/* Remote audio output */}
                <audio ref={audioElRef} autoPlay />
            </div>

            <p style={{ marginTop: 18, opacity: 0.7 }}>
                Tipp: In einem zweiten Browser/Incognito mit anderem User-Token joinen, dann solltest du Audio hören.
            </p>
        </div>
    );
}
