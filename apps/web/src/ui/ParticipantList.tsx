import type { VoiceState } from "../control/types";

export function ParticipantList(props: { participants: VoiceState[] }) {
    return (
        <div className="panel">
            <div className="panelHeader">Teilnehmer</div>
            <div className="list">
                {props.participants.map((p) => (
                    <div key={p.userId} className="row">
                        <div className="name">{p.displayName}</div>
                        <div className="icons">
                            {p.muted ? "🔇" : "🎤"}
                            {p.deafened ? " 🔕" : ""}
                            {p.speaking ? " 🎙️" : ""}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
