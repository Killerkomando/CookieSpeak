export type MediaProvider = "livekit" | "mediasoup";

export type MediaPermission = {
  canJoin: boolean;
  canSpeak: boolean;
  canStream: boolean;
  isModerator: boolean;
};

export type CreateSessionInput = {
  workspaceId: string;
  channelId: string;
};

export type JoinSessionInput = {
  sessionId: string;
  userId: string;
  permissions: MediaPermission;
};

export type JoinInfo =
  | { provider: "livekit"; url: string; token: string }
  | { provider: "mediasoup"; signalingUrl: string; sessionToken: string };

export interface MediaProviderAdapter {
  createSession(input: CreateSessionInput): Promise<{ sessionId: string }>;
  joinSession(input: JoinSessionInput): Promise<JoinInfo>;
  endSession(sessionId: string): Promise<void>;
  mute(sessionId: string, targetUserId: string, mute: boolean): Promise<void>;
}

export interface MediaEngine {
  connect(joinInfo: JoinInfo): Promise<void>;
  disconnect(): Promise<void>;
  setMicEnabled(enabled: boolean): Promise<void>;
  setDeafened(enabled: boolean): Promise<void>;
}
