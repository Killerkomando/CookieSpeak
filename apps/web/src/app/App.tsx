import { useVoiceStore } from "../control/VoiceStore";
import { LiveKitConnector } from "../voice/LiveKitConnector";
import { ChannelSidebar } from "../ui/ChannelSidebar";
import { ParticipantList } from "../ui/ParticipantList";
import { BottomBar } from "../ui/BottomBar";
import "./layout.css";

export function App() {
    const { state, actions, me } = useVoiceStore();

    const inVoice = !!state.currentChannelId && !!state.livekit;
    const muted = me?.muted ?? false;
    const deafened = me?.deafened ?? false;

    return (
        <LiveKitConnector
            url={state.livekit?.url}
            token={state.livekit?.token}
            connect={inVoice}
        >
            <div className="layout">
                <ChannelSidebar
                    channels={state.channels}
                    currentChannelId={state.currentChannelId}
                    onJoin={actions.join}
                />

                <div className="main">
                    <div className="title">
                        {state.currentChannelId ? `Channel: ${state.currentChannelId}` : "Nicht verbunden"}
                    </div>
                    <ParticipantList participants={state.participants} />
                </div>

                <BottomBar
                    inVoice={inVoice}
                    muted={muted}
                    deafened={deafened}
                    onToggleMute={() => actions.setMute(!muted)}
                    onToggleDeafen={() => actions.setDeafen(!deafened)}
                    onLeave={actions.leave}
                />
            </div>
        </LiveKitConnector>
    );
}
