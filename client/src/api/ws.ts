/**
 * Shared WebSocket singleton. All components subscribe to events through
 * this module instead of opening their own connections.
 */

type Handler = (event: string, data: unknown) => void;

const subscribers = new Set<Handler>();
let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  ws = new WebSocket(`ws://${window.location.host}/ws`);

  ws.onmessage = (e) => {
    try {
      const { event, data } = JSON.parse(e.data);
      for (const handler of subscribers) handler(event, data);
    } catch {}
  };

  ws.onclose = () => {
    ws = null;
    // Reconnect after 2s if there are still subscribers
    if (subscribers.size > 0) {
      reconnectTimer = setTimeout(connect, 2000);
    }
  };

  ws.onerror = () => {
    ws?.close();
  };
}

export function subscribeWS(handler: Handler): () => void {
  subscribers.add(handler);
  connect();
  return () => {
    subscribers.delete(handler);
    if (subscribers.size === 0) {
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      ws?.close();
      ws = null;
    }
  };
}
