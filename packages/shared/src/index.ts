import { z } from "zod";

/** IDs */
export const Id = z.string().min(8);

/** Auth */
export const RegisterBody = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
});
export type RegisterBody = z.infer<typeof RegisterBody>;

export const LoginBody = RegisterBody;
export type LoginBody = z.infer<typeof LoginBody>;

/** Workspaces */
export const CreateWorkspaceBody = z.object({
  name: z.string().min(2).max(64),
});
export type CreateWorkspaceBody = z.infer<typeof CreateWorkspaceBody>;

/** Channels */
export const ChannelType = z.enum(["text", "voice"]);
export type ChannelType = z.infer<typeof ChannelType>;

export const CreateChannelBody = z.object({
  workspaceId: Id,
  name: z.string().min(1).max(64),
  type: ChannelType,
});
export type CreateChannelBody = z.infer<typeof CreateChannelBody>;

/** Chat messages */
export const SendMessageBody = z.object({
  channelId: Id,
  content: z.string().min(1).max(4000),
});
export type SendMessageBody = z.infer<typeof SendMessageBody>;

/** Realtime WS events (neutral, provider-agnostisch) */
export const WsClientEvent = z.discriminatedUnion("type", [
  // subscribe to workspace/channel for scoped events
  z.object({
    type: z.literal("WS:SUBSCRIBE"),
    payload: z.object({
      workspaceId: Id.optional(),
      channelId: Id.optional(),
    }),
  }),

  z.object({ type: z.literal("CHAT:SEND"), payload: SendMessageBody }),

  z.object({
    type: z.literal("VOICE:JOIN"),
    payload: z.object({ channelId: Id }),
  }),
  z.object({
      type: z.literal("VOICE:LEAVE"),
      payload: z.object({}),
  }),

  z.object({
    type: z.literal("PRESENCE:SET_STATUS"),
    payload: z.object({ status: z.enum(["online", "away", "dnd"]) }),
  }),
]);
export type WsClientEvent = z.infer<typeof WsClientEvent>;

export const WsServerEvent = z.discriminatedUnion("type", [
  // acknowledge subscribe
  z.object({
    type: z.literal("WS:SUBSCRIBED"),
    payload: z.object({
      workspaceId: Id.optional(),
      channelId: Id.optional(),
    }),
  }),

  z.object({
    type: z.literal("CHAT:MESSAGE_NEW"),
    payload: z.object({
      id: Id,
      channelId: Id,
      userId: Id,
      content: z.string(),
      createdAt: z.string(),
    }),
  }),

  z.object({ type: z.literal("VOICE:JOIN_INFO"), payload: z.any() }),

    z.object({
        type: z.literal("PRESENCE:SNAPSHOT"),
        payload: z.object({
            workspaceId: Id,
            onlineUserIds: z.array(Id),
        }),
    }),


    z.object({
        type: z.literal("PRESENCE:UPDATE"),
        payload: z.object({
            workspaceId: Id,
            userId: Id,
            status: z.enum(["online", "offline", "away", "dnd"]),
        }),
    }),

    z.object({
        type: z.literal("VOICE:JOINED"),
        payload: z.object({
            workspaceId: Id,
            channelId: Id,
            userId: Id,
        }),
    }),
    z.object({
        type: z.literal("VOICE:LEFT"),
        payload: z.object({
            workspaceId: Id,
            channelId: Id,
            userId: Id,
        }),
    }),
    z.object({
        type: z.literal("VOICE:STATE"),
        payload: z.object({
            workspaceId: Id,
            channelId: Id,
            users: z.array(
                z.object({
                    userId: Id,
                    muted: z.boolean(),
                    deafened: z.boolean(),
                    speaking: z.boolean(),
                })
            ),
        }),
    }),
    z.object({
        type: z.literal("VOICE:SET_STATE"),
        payload: z.object({
            channelId: Id,
            muted: z.boolean().optional(),
            deafened: z.boolean().optional(),
        }),
    }),
    z.object({
        type: z.literal("VOICE:SPEAKING"),
        payload: z.object({
            channelId: Id,
            speaking: z.boolean(),
        }),
    }),


]);
export type WsServerEvent = z.infer<typeof WsServerEvent>;
