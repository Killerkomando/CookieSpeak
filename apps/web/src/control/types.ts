export type VoiceChannel = { id: string; name: string };

export type VoiceState = {
    userId: string;
    displayName: string;
    muted: boolean;
    deafened: boolean;
    speaking: boolean; // transient
};

export type ControlState = {
    channels: VoiceChannel[];
    currentChannelId?: string;
    participants: VoiceState[];
    // LiveKit connect info kommt vom Server nach join:
    livekit?: { url: string; token: string };
};

export type ClientToServer =
    | { t: "subscribe"; topics: string[] }
    | { t: "voice:join"; channelId: string }
    | { t: "voice:leave" }
    | { t: "voice:setMute"; muted: boolean }
    | { t: "voice:setDeafen"; deafened: boolean };

export type ServerToClient =
    | { t: "channels:list"; channels: VoiceChannel[] }
    | { t: "voice:joined"; channelId: string; livekitUrl: string; token: string; participants: VoiceState[] }
    | { t: "voice:left" }
    | { t: "voice:stateUpdate"; userId: string; muted?: boolean; deafened?: boolean; speaking?: boolean }
    | { t: "voice:participants"; participants: VoiceState[] };
