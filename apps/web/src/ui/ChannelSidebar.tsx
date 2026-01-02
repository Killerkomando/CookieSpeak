import type { VoiceChannel } from "../control/types";

export function ChannelSidebar(props: {
    channels: VoiceChannel[];
    currentChannelId?: string;
    onJoin: (id: string) => void;
}) {
    return (
        <div className="sidebar">
            <div className="sidebarHeader">Voice</div>
            {props.channels.map((c) => {
                const active = c.id === props.currentChannelId;
                return (
                    <button
                        key={c.id}
                        className={`channel ${active ? "active" : ""}`}
                        onClick={() => props.onJoin(c.id)}
                    >
                        🔊 {c.name}
                    </button>
                );
            })}
        </div>
    );
}
