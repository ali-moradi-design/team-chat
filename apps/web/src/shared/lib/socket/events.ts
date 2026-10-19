/** Canonical Socket.IO event names shared by client code. */
export const SocketEvents = {
  AuthOk: 'auth:ok',
  Error: 'error',
  RoomList: 'room:list',
  RoomCreate: 'room:create',
  RoomJoin: 'room:join',
  RoomLeave: 'room:leave',
  RoomJoined: 'room:joined',
  RoomLeft: 'room:left',
  MessageSend: 'message:send',
  MessageNew: 'message:new',
  MessageHistory: 'message:history',
  TypingStart: 'typing:start',
  TypingStop: 'typing:stop',
  PresenceUpdate: 'presence:update',
} as const;

export type SocketEventName = (typeof SocketEvents)[keyof typeof SocketEvents];
