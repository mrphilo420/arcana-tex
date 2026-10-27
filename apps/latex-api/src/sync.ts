import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Hono } from "hono";
import type { UpgradeWebSocket, WSContext } from "hono/ws";

interface SyncSnapshot {
  projectId: string;
  projectName: string;
  files: unknown[];
  mainFileId: string | null;
  compiler: string;
  comments?: unknown[];
  updatedAt: number;
}

interface PersistedRoom {
  token: string;
  snapshot: SyncSnapshot | null;
  updatedAt: number;
}

interface SyncClient {
  id: string;
  name: string;
  ws: WSContext;
}

interface SyncRoom {
  id: string;
  token: string;
  snapshot: SyncSnapshot | null;
  clients: Map<WSContext, SyncClient>;
  saveTimer: ReturnType<typeof setTimeout> | null;
}

const MAX_SNAPSHOT_BYTES = 25 * 1024 * 1024;
const SYNC_DIR =
  process.env.SYNC_DATA_DIR || join(process.cwd(), ".open-prism-sync");

const rooms = new Map<string, SyncRoom>();

function roomFile(roomId: string): string {
  return join(SYNC_DIR, `${roomId}.json`);
}

function validRoomId(roomId: string): boolean {
  return /^[a-zA-Z0-9-]{8,80}$/.test(roomId);
}

function validToken(token: string | null | undefined): token is string {
  return Boolean(token && /^[a-zA-Z0-9-]{8,120}$/.test(token));
}

function sendJson(ws: WSContext, message: unknown): void {
  if (ws.readyState !== 1) return;
  ws.send(JSON.stringify(message));
}

function broadcast(
  room: SyncRoom,
  message: unknown,
  exclude?: WSContext,
): void {
  const payload = JSON.stringify(message);
  for (const [ws] of room.clients) {
    if (ws !== exclude && ws.readyState === 1) {
      ws.send(payload);
    }
  }
}

function peerList(room: SyncRoom) {
  return Array.from(room.clients.values()).map((client) => ({
    id: client.id,
    name: client.name,
  }));
}

function schedulePersist(room: SyncRoom): void {
  if (room.saveTimer) clearTimeout(room.saveTimer);

  room.saveTimer = setTimeout(async () => {
    room.saveTimer = null;

    try {
      await mkdir(SYNC_DIR, { recursive: true });
      const payload: PersistedRoom = {
        token: room.token,
        snapshot: room.snapshot,
        updatedAt: Date.now(),
      };
      const temporary = `${roomFile(room.id)}.${randomUUID()}.tmp`;
      await writeFile(temporary, JSON.stringify(payload), "utf-8");
      await rename(temporary, roomFile(room.id));
    } catch (error) {
      console.error(`Failed to persist sync room ${room.id}`, error);
    }
  }, 300);
}

async function loadRoom(roomId: string): Promise<SyncRoom | null> {
  const cached = rooms.get(roomId);
  if (cached) return cached;

  try {
    const raw = await readFile(roomFile(roomId), "utf-8");
    const persisted = JSON.parse(raw) as PersistedRoom;
    if (!validToken(persisted.token)) return null;

    const room: SyncRoom = {
      id: roomId,
      token: persisted.token,
      snapshot:
        persisted.snapshot?.projectId === roomId ? persisted.snapshot : null,
      clients: new Map(),
      saveTimer: null,
    };
    rooms.set(roomId, room);
    return room;
  } catch {
    return null;
  }
}

async function getOrCreateRoom(
  roomId: string,
  token: string | null,
): Promise<{ room: SyncRoom } | { error: string }> {
  if (!validRoomId(roomId)) {
    return { error: "Invalid project ID" };
  }

  const existing = await loadRoom(roomId);

  if (existing) {
    if (token !== existing.token) {
      return { error: "Invalid sync token" };
    }
    return { room: existing };
  }

  if (!validToken(token)) {
    return { error: "Missing sync token" };
  }

  const room: SyncRoom = {
    id: roomId,
    token,
    snapshot: null,
    clients: new Map(),
    saveTimer: null,
  };
  rooms.set(roomId, room);
  return { room };
}

export function registerSyncRoutes(
  app: Hono,
  upgradeWebSocket: UpgradeWebSocket,
): void {
  app.get("/sync/projects/:id", async (c) => {
    const roomId = c.req.param("id");
    const token = c.req.query("token");

    if (!validRoomId(roomId)) {
      return c.json({ error: "Invalid project ID" }, 400);
    }

    const room = await loadRoom(roomId);
    if (!room) return c.json({ error: "Sync room not found" }, 404);
    if (token !== room.token) {
      return c.json({ error: "Invalid sync token" }, 403);
    }
    if (!room.snapshot) {
      return c.json({ error: "No snapshot has been synced yet" }, 404);
    }

    return c.json({ snapshot: room.snapshot });
  });

  app.put("/sync/projects/:id", async (c) => {
    const roomId = c.req.param("id");
    const body = (await c.req.json()) as {
      token?: string;
      snapshot?: SyncSnapshot;
    };

    if (!validRoomId(roomId) || !body.snapshot) {
      return c.json({ error: "Invalid sync payload" }, 400);
    }

    const result = await getOrCreateRoom(roomId, body.token ?? null);
    if ("error" in result) {
      return c.json({ error: result.error }, 403);
    }

    if (body.snapshot.projectId !== roomId) {
      return c.json({ error: "Snapshot project ID mismatch" }, 400);
    }

    result.room.snapshot = body.snapshot;
    schedulePersist(result.room);
    broadcast(result.room, {
      type: "snapshot",
      snapshot: result.room.snapshot,
    });

    return c.json({ ok: true });
  });

  app.delete("/sync/projects/:id", async (c) => {
    const roomId = c.req.param("id");
    const token = c.req.query("token");
    const room = rooms.get(roomId) ?? (await loadRoom(roomId));

    if (!room) return c.json({ ok: true });
    if (token !== room.token) {
      return c.json({ error: "Invalid sync token" }, 403);
    }

    if (room.saveTimer) clearTimeout(room.saveTimer);
    rooms.delete(roomId);
    await rm(roomFile(roomId), { force: true });

    for (const [ws] of room.clients) {
      ws.close(1008, "The sync session was deleted");
    }

    return c.json({ ok: true });
  });

  app.get(
    "/sync/ws/:id",
    upgradeWebSocket(async (c) => {
      const roomId = c.req.param("id");
      const token = c.req.query("token") ?? null;
      const result = await getOrCreateRoom(roomId, token);

      if ("error" in result) {
        return {
          onOpen(_event, ws) {
            ws.close(1008, result.error);
          },
        };
      }

      const room = result.room;
      const client: SyncClient = {
        id: randomUUID(),
        name: "Guest",
        ws: null as unknown as WSContext,
      };

      return {
        onOpen(_event, ws) {
          client.ws = ws;
          room.clients.set(ws, client);

          sendJson(ws, {
            type: "joined",
            clientId: client.id,
            token: room.token,
            peers: peerList(room),
            snapshot: room.snapshot,
          });
          broadcast(room, { type: "presence", peers: peerList(room) });
        },

        onMessage(event, ws) {
          if (typeof event.data !== "string") return;
          if (event.data.length > MAX_SNAPSHOT_BYTES) return;

          let message: {
            type?: string;
            name?: string;
            snapshot?: SyncSnapshot;
          };

          try {
            message = JSON.parse(event.data);
          } catch {
            return;
          }

          if (message.type === "presence") {
            const name = message.name?.trim().slice(0, 40);
            if (name) client.name = name;
            broadcast(room, { type: "presence", peers: peerList(room) });
            return;
          }

          if (message.type === "snapshot" && message.snapshot) {
            if (message.snapshot.projectId !== roomId) return;
            if (!Array.isArray(message.snapshot.files)) return;

            room.snapshot = {
              ...message.snapshot,
              updatedAt: Date.now(),
            };
            schedulePersist(room);
            broadcast(room, { type: "snapshot", snapshot: room.snapshot }, ws);
            return;
          }

          if (message.type === "ping") {
            sendJson(ws, { type: "pong" });
          }
        },

        onClose(_event, ws) {
          room.clients.delete(ws);
          broadcast(room, { type: "presence", peers: peerList(room) });
          schedulePersist(room);
        },
      };
    }),
  );
}
