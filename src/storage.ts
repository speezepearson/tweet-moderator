import { PersistentCache } from './types';

/**
 * Typed schema for chrome.storage.local
 * This ensures we only reference storage keys that actually exist
 */
export interface LocalStorageSchema {
  tweetToxicityCache: PersistentCache;
}

/**
 * Typed schema for chrome.storage.sync
 */
export interface SyncStorageSchema {
  tweetPrefix: string;
  anthropicApiKey: string;
}

/**
 * Type-safe wrapper for chrome.storage.local.get
 * Prevents typos and ensures correct types for values
 */
export async function getLocalStorage<K extends keyof LocalStorageSchema>(
  keys: K[]
): Promise<Partial<Pick<LocalStorageSchema, K>>>;
export async function getLocalStorage<K extends keyof LocalStorageSchema>(
  key: K
): Promise<Partial<Pick<LocalStorageSchema, K>>>;
export async function getLocalStorage<K extends keyof LocalStorageSchema>(
  keysOrKey: K | K[]
): Promise<Partial<Pick<LocalStorageSchema, K>>> {
  const keys = Array.isArray(keysOrKey) ? keysOrKey : [keysOrKey];
  return chrome.storage.local.get(keys) as Promise<Partial<Pick<LocalStorageSchema, K>>>;
}

/**
 * Type-safe wrapper for chrome.storage.local.set
 * Prevents typos and ensures correct types for values
 */
export async function setLocalStorage<K extends keyof LocalStorageSchema>(
  items: Partial<Pick<LocalStorageSchema, K>>
): Promise<void> {
  return chrome.storage.local.set(items);
}

/**
 * Type-safe wrapper for chrome.storage.local.remove
 */
export async function removeLocalStorage<K extends keyof LocalStorageSchema>(
  keys: K | K[]
): Promise<void> {
  return chrome.storage.local.remove(keys as string | string[]);
}

/**
 * Type-safe wrapper for chrome.storage.sync.get
 */
export async function getSyncStorage<K extends keyof SyncStorageSchema>(
  keys: K[]
): Promise<Partial<Pick<SyncStorageSchema, K>>>;
export async function getSyncStorage<K extends keyof SyncStorageSchema>(
  key: K
): Promise<Partial<Pick<SyncStorageSchema, K>>>;
export async function getSyncStorage<K extends keyof SyncStorageSchema>(
  keysOrKey: K | K[]
): Promise<Partial<Pick<SyncStorageSchema, K>>> {
  const keys = Array.isArray(keysOrKey) ? keysOrKey : [keysOrKey];
  return chrome.storage.sync.get(keys) as Promise<Partial<Pick<SyncStorageSchema, K>>>;
}

/**
 * Type-safe wrapper for chrome.storage.sync.set
 */
export async function setSyncStorage<K extends keyof SyncStorageSchema>(
  items: Partial<Pick<SyncStorageSchema, K>>
): Promise<void> {
  return chrome.storage.sync.set(items);
}
