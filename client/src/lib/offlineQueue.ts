import { api, ApiError } from "../api/client.js";

/** Sets logged without a connection wait here (localStorage) and are sent once the network is
 * back. Each carries a clientId, so a request that actually got through before the connection
 * dropped is recognised by the server and never stored twice. */
export interface QueuedSet {
  clientId: string;
  sessionId: string;
  payload: Record<string, unknown>;
  queuedAt: number;
}

const KEY = "fittrack-offline-sets";
const listeners = new Set<() => void>();

function read(): QueuedSet[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function write(queue: QueuedSet[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(queue));
  } catch {
    // storage full/blocked — the set is lost, but logging must never crash the workout
  }
  listeners.forEach((l) => l());
}

export function getQueuedSets(sessionId?: string): QueuedSet[] {
  return read().filter((q) => !sessionId || q.sessionId === sessionId);
}

export function enqueueSet(sessionId: string, payload: Record<string, unknown>, clientId: string) {
  write([...read(), { clientId, sessionId, payload, queuedAt: Date.now() }]);
}

/** A failed fetch or a timeout (no connection) — as opposed to the server answering with an error. */
export function isNetworkError(err: unknown): boolean {
  return !(err instanceof ApiError);
}

export function subscribeQueue(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let flushing = false;

/** Sends queued sets in order. Stops at the first connection problem (try again later);
 * drops a set the server rejects for good (e.g. its workout was deleted). */
export async function flushQueue(): Promise<number> {
  if (flushing) return 0;
  flushing = true;
  let sent = 0;
  try {
    for (const item of read()) {
      try {
        await api.post(`/workouts/${item.sessionId}/sets`, { ...item.payload, clientId: item.clientId }, { signal: AbortSignal.timeout(15_000) });
        write(read().filter((q) => q.clientId !== item.clientId));
        sent++;
      } catch (err) {
        if (isNetworkError(err) || (err instanceof ApiError && err.status === 401)) break;
        write(read().filter((q) => q.clientId !== item.clientId));
      }
    }
  } finally {
    flushing = false;
  }
  return sent;
}
