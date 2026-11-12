import { normalizeSceneSpec } from './sceneSpec'
import type { SceneSpec } from './sceneSpec'

// The cache stores scene data only. Callers should use a non-sensitive scene
// identifier as the key, rather than putting a child's dialogue in the key.
const DATABASE_NAME = 'canto-scene-cache'
const STORE_NAME = 'scenes'
const memory = new Map<string, SceneSpec>()
const MEMORY_LIMIT = 50

function remember(key: string, spec: SceneSpec): void {
  memory.delete(key)
  memory.set(key, spec)
  if (memory.size > MEMORY_LIMIT) {
    const oldest = memory.keys().next().value
    if (oldest !== undefined) memory.delete(oldest)
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
      const request = indexedDB.open(DATABASE_NAME, 1)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME)
      }
      request.onsuccess = () => finish(request.result)
      request.onerror = () => finish(null)
      request.onblocked = () => finish(null)
    } catch {
      finish(null)
    }
  })
}

/** Read a cached scene. Missing, invalid or unavailable storage returns null. */
export async function getCachedScene(key: string): Promise<SceneSpec | null> {
  if (!key) return null
  const storedInMemory = memory.get(key)
  if (storedInMemory) return normalizeSceneSpec(storedInMemory)
  const database = await openDatabase()
  if (!database) return null
  return new Promise((resolve) => {
    let result: SceneSpec | null = null
    try {
      const transaction = database.transaction(STORE_NAME, 'readonly')
      const request = transaction.objectStore(STORE_NAME).get(key)
      request.onsuccess = () => {
        if (request.result && typeof request.result === 'object') {
          result = normalizeSceneSpec(request.result)
        }
      }
      transaction.oncomplete = () => {
        database.close()
        if (result) remember(key, result)
        resolve(result)
      }
      transaction.onerror = transaction.onabort = () => { database.close(); resolve(null) }
    } catch {
      database.close()
      resolve(null)
    }
  })
}

/** Normalize before storage; retains an in-memory copy when IndexedDB fails. */
export async function setCachedScene(key: string, input: unknown): Promise<void> {
  if (!key) return
  const spec = normalizeSceneSpec(input)
  remember(key, spec)
  const database = await openDatabase()
  if (!database) return
  await new Promise<void>((resolve) => {
    try {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).put(spec, key)
      transaction.oncomplete = transaction.onerror = transaction.onabort = () => { database.close(); resolve() }
    } catch {
      database.close()
      resolve()
    }
  })
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
      transaction.oncomplete = transaction.onerror = transaction.onabort = () => { database.close(); resolve() }
    } catch {
      database.close()
      resolve()
    }
  })
}
