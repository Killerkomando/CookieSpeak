import "@livekit/components-styles";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import type { PropsWithChildren } from "react";

export function LiveKitConnector(
    props: PropsWithChildren<{ url?: string; token?: string; connect: boolean }>,
) {
    const { url, token, connect, children } = props;

    // connect=false erlaubt rendern ohne Verbindung (z.B. nicht in voice)
    return (
        <LiveKitRoom
            serverUrl={url}
            token={token}
            connect={connect && !!url && !!token}
            audio
            video={false}
            data={false}
            style={{ height: "100%", width: "100%" }}
        >
            {/* Rendert remote audio */}
            <RoomAudioRenderer />
            {children}
        </LiveKitRoom>
    );
}
