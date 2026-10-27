const SYNC_SETTINGS_PREFIX = "open-prism-sync-";
const USER_NAME_KEY = "open-prism-user-name";

export interface ProjectSyncSettings {
  token: string;
  enabled: boolean;
  sharedWithMe?: boolean;
}

export function loadProjectSyncSettings(
  projectId: string,
): ProjectSyncSettings | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(`${SYNC_SETTINGS_PREFIX}${projectId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ProjectSyncSettings>;
    if (!parsed.token || typeof parsed.enabled !== "boolean") return null;
    return {
      token: parsed.token,
      enabled: parsed.enabled,
      sharedWithMe: parsed.sharedWithMe === true,
    };
  } catch {
    return null;
  }
}

export function saveProjectSyncSettings(
  projectId: string,
  settings: ProjectSyncSettings,
): void {
  localStorage.setItem(
    `${SYNC_SETTINGS_PREFIX}${projectId}`,
    JSON.stringify(settings),
  );
}

export function enableProjectSync(projectId: string): ProjectSyncSettings {
  const existing = loadProjectSyncSettings(projectId);
  const settings: ProjectSyncSettings = {
    token: existing?.token ?? crypto.randomUUID(),
    enabled: true,
    sharedWithMe: existing?.sharedWithMe,
  };
  saveProjectSyncSettings(projectId, settings);
  return settings;
}

export function disableProjectSync(projectId: string): void {
  const existing = loadProjectSyncSettings(projectId);
  if (!existing) return;
  saveProjectSyncSettings(projectId, { ...existing, enabled: false });
}

export function clearProjectSyncSettings(projectId: string): void {
  localStorage.removeItem(`${SYNC_SETTINGS_PREFIX}${projectId}`);
}

export async function deleteSyncSnapshot(
  projectId: string,
  token: string,
): Promise<void> {
  await fetch(
    `${getSyncHttpBaseUrl()}/projects/${projectId}?token=${encodeURIComponent(token)}`,
    { method: "DELETE" },
  );
}

export function getSyncUserName(): string {
  if (typeof window === "undefined") return "Guest";

  const stored = localStorage.getItem(USER_NAME_KEY);
  if (stored) return stored;

  const name = `Guest ${Math.floor(1000 + Math.random() * 9000)}`;
  localStorage.setItem(USER_NAME_KEY, name);
  return name;
}

export function setSyncUserName(name: string): void {
  localStorage.setItem(USER_NAME_KEY, name.trim().slice(0, 40) || "Guest");
}

export function getSyncBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SYNC_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");

  if (typeof window !== "undefined") {
    const scheme = window.location.protocol === "https:" ? "wss" : "ws";
    return `${scheme}://${window.location.hostname}:3001/sync`;
  }

  return "ws://localhost:3001/sync";
}

export function getSyncHttpBaseUrl(): string {
  return getSyncBaseUrl().replace(/^ws/, "http");
}

export function getShareUrl(projectId: string, token: string): string {
  return `${window.location.origin}/project/${projectId}?sync=${encodeURIComponent(token)}`;
}

export async function fetchSyncSnapshot(
  projectId: string,
  token: string,
): Promise<unknown | null> {
  const response = await fetch(
    `${getSyncHttpBaseUrl()}/projects/${projectId}?token=${encodeURIComponent(token)}`,
  );

  if (!response.ok) return null;
  const data = (await response.json()) as { snapshot?: unknown };
  return data.snapshot ?? null;
}
