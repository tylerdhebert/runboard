import type { ServerWebSocket } from "bun";

export type WsClient = ServerWebSocket<unknown>;

const clients = new Set<WsClient>();

export const wsManager = {
  add(ws: WsClient) { clients.add(ws); },
  remove(ws: WsClient) { clients.delete(ws); },
  broadcast(event: string, data: unknown) {
    const msg = JSON.stringify({ event, data });
    for (const ws of clients) {
      try { ws.send(msg); } catch {}
    }
  },
  get size() { return clients.size; },
};
