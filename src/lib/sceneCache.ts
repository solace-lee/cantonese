import { isValidGeneratedScene, normalizeSceneSpec } from './sceneSpec'
import type { SceneSpec, SceneTheme } from './sceneSpec'

// Cache keys contain only a non-reversible scene signature, never raw dialogue.
const DATABASE_NAME = 'canto-scene-cache'
const STORE_NAME = 'scenes'
const DATABASE_VERSION = 2
export const SCENE_CACHE_LIMIT = 50
export const SCENE_CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

type CacheRecord = {
  spec: SceneSpec
  savedAt: number
  lastAccess: number
}

const memory = new Map<string, CacheRecord>()

function remember(key: string, record: CacheRecord): void {
  memory.delete(key)
  memory.set(key, record)
  if (memory.size > SCENE_CACHE_LIMIT) {
    const oldest = memory.keys().next().value
    if (oldest !== undefined) memory.delete(oldest)
  }
}

function readRecord(value: unknown): CacheRecord | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  if (!raw.spec || typeof raw.savedAt !== 'number' || typeof raw.lastAccess !== 'number') return null
  return {
    spec: normalizeSceneSpec(raw.spec),
    savedAt: raw.savedAt,
    lastAccess: raw.lastAccess,
  }
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  return new Promise((resolve) => {
    let settled = false
    const finish = (database: IDBDatabase | null) => {
      if (settled) {
        database?.close()
        return
      }
      settled = true
      resolve(database)
    }
    try {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME)
        } else if (request.transaction) {
          request.transaction.objectStore(STORE_NAME).clear()
        }
      }
      request.onsuccess = () => finish(request.result)
      request.onerror = () => finish(null)
      request.onblocked = () => finish(null)
    } catch {
      finish(null)
    }
  })
}

/** Read a cached scene and refresh its LRU timestamp. */
export async function getCachedScene(key: string, expectedTheme?: SceneTheme): Promise<SceneSpec | null> {
  if (!key) return null
  const storedInMemory = memory.get(key)
  if (storedInMemory) {
    if (Date.now() - storedInMemory.savedAt > SCENE_CACHE_MAX_AGE_MS) {
      memory.delete(key)
      return null
    }
    if (expectedTheme && storedInMemory.spec.theme !== expectedTheme) return null
    storedInMemory.lastAccess = Date.now()
    return normalizeSceneSpec(storedInMemory.spec)
  }

  const database = await openDatabase()
  if (!database) return null
  return new Promise((resolve) => {
    let result: SceneSpec | null = null
    let nextRecord: CacheRecord | null = null
    try {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(key)
      request.onsuccess = () => {
        const record = readRecord(request.result)
        if (!record) return
        if (Date.now() - record.savedAt > SCENE_CACHE_MAX_AGE_MS) {
          store.delete(key)
          return
        }
        if (expectedTheme && (record.spec.theme !== expectedTheme || !isValidGeneratedScene(record.spec, expectedTheme))) {
          store.delete(key)
          return
        }
        nextRecord = { ...record, lastAccess: Date.now() }
        result = record.spec
        store.put(nextRecord, key)
      }
      transaction.oncomplete = () => {
        database.close()
        if (nextRecord) remember(key, nextRecord)
        resolve(result)
      }
      transaction.onerror = transaction.onabort = () => {
        database.close()
        resolve(null)
      }
    } catch {
      database.close()
      resolve(null)
    }
  })
}

async function trimDatabase(database: IDBDatabase): Promise<void> {
  await new Promise<void>((resolve) => {
    try {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const records: Array<{ key: IDBValidKey; lastAccess: number }> = []
      const cursorRequest = store.openCursor()
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result
        if (!cursor) {
          records.sort((a, b) => a.lastAccess - b.lastAccess)
          records.slice(0, Math.max(0, records.length - SCENE_CACHE_LIMIT)).forEach((record) => store.delete(record.key))
          return
        }
        const record = readRecord(cursor.value)
        records.push({ key: cursor.key, lastAccess: record?.lastAccess ?? 0 })
        cursor.continue()
      }
      transaction.oncomplete = transaction.onerror = transaction.onabort = () => {
        database.close()
        resolve()
      }
    } catch {
      database.close()
      resolve()
    }
  })
}

/** Normalize before storage; retain an in-memory copy when IndexedDB fails. */
export async function setCachedScene(key: string, input: unknown): Promise<void> {
  if (!key) return
  const spec = normalizeSceneSpec(input)
  const now = Date.now()
  const record = { spec, savedAt: now, lastAccess: now }
  remember(key, record)
  const database = await openDatabase()
  if (!database) return
  await new Promise<void>((resolve) => {
    try {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).put(record, key)
      transaction.oncomplete = () => resolve()
      transaction.onerror = transaction.onabort = () => resolve()
    } catch {
      resolve()
    }
  })
  await trimDatabase(database)
}

/** Remove all generated scenes from memory and IndexedDB. */
export async function clearSceneCache(): Promise<void> {
  memory.clear()
  const database = await openDatabase()
  if (!database) return
  await new Promise<void>((resolve) => {
    try {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).clear()
      transaction.oncomplete = transaction.onerror = transaction.onabort = () => {
        database.close()
        resolve()
      }
    } catch {
      database.close()
      resolve()
    }
  })
}
