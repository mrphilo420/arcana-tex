import { openDB, type IDBPDatabase } from "idb";
import { DB_NAME, DB_VERSION, type ArcanaTeXDB } from "./schema";

let dbPromise: Promise<IDBPDatabase<ArcanaTeXDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<ArcanaTeXDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ArcanaTeXDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("projects")) {
          db.createObjectStore("projects", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("projectMeta")) {
          db.createObjectStore("projectMeta", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("projectChats")) {
          db.createObjectStore("projectChats", { keyPath: "projectId" });
        }
        if (!db.objectStoreNames.contains("projectFolders")) {
          db.createObjectStore("projectFolders", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("projectVersions")) {
          const versions = db.createObjectStore("projectVersions", {
            keyPath: "id",
          });
          versions.createIndex("by-project", "projectId");
        }
        if (!db.objectStoreNames.contains("documentState")) {
          db.createObjectStore("documentState");
        }
        if (!db.objectStoreNames.contains("blobs")) {
          db.createObjectStore("blobs", { keyPath: "id" });
        }
      },
    });
  }

  return dbPromise;
}

let storageReady = false;
let storageReadyPromise: Promise<void> | null = null;

export function waitForStorageReady(): Promise<void> {
  if (storageReady) return Promise.resolve();

  if (!storageReadyPromise) {
    storageReadyPromise = (async () => {
      await getDB();
      storageReady = true;
    })();
  }

  return storageReadyPromise;
}

export function isStorageReady(): boolean {
  return storageReady;
}
