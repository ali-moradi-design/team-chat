export const env = {
  socketUrl: import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:3001',
} as const;
