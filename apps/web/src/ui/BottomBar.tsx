export function BottomBar(props: {
    inVoice: boolean;
    muted: boolean;
    deafened: boolean;
    onToggleMute: () => void;
    onToggleDeafen: () => void;
    onLeave: () => void;
}) {
    return (
        <div className="bottomBar">
            <button disabled={!props.inVoice} onClick={props.onToggleMute}>
                {props.muted ? "Unmute" : "Mute"}
            </button>
            <button disabled={!props.inVoice} onClick={props.onToggleDeafen}>
                {props.deafened ? "Undeafen" : "Deafen"}
            </button>
            <button disabled={!props.inVoice} onClick={props.onLeave}>
                Leave
            </button>
        </div>
    );
}
