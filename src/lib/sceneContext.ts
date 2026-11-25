import { SCENE_ELEMENT_TYPES } from './sceneSpec'
import type { SceneElementType, SceneTheme } from './sceneSpec'

export { SCENE_ELEMENT_TYPES }

export const SCENE_BRIEF_LIMIT = 80

export const DEFAULT_SCENE_BRIEFS: Record<SceneTheme, string> = {
  sky: '阳光照在草地上，白云和小鸟在天空中',
  playground: '孩子们在球场边踢球，周围有球门和长椅',
  pond: '池塘里有小鸭，岸边开着花',
  playroom: '温暖的玩具房里放着积木和玩偶',
}

export function sanitizeSceneBrief(value: unknown, theme: SceneTheme): string {
  if (typeof value !== 'string') return DEFAULT_SCENE_BRIEFS[theme]
  const brief = value
    .normalize('NFKC')
    .replace(/https?:\/\/\S+|www\.\S+/gi, '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '')
    .replace(/(?:\+?\d[\s-]?){8,}/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/[<>{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, SCENE_BRIEF_LIMIT)
  return brief || DEFAULT_SCENE_BRIEFS[theme]
}

export function sanitizeSceneTags(value: unknown, theme: SceneTheme): SceneElementType[] {
  const allowed = new Set(SCENE_ELEMENT_TYPES)
  const candidates = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : []
  const tags = candidates
    .map((item) => typeof item === 'string' ? item.trim().toLowerCase() : '')
    .filter((item): item is SceneElementType => allowed.has(item as SceneElementType))
  const unique = [...new Set(tags)].slice(0, 8)
  if (unique.length) return unique
  return theme === 'playground'
    ? ['goal', 'ball']
    : theme === 'pond'
      ? ['pond', 'duck']
      : theme === 'playroom'
        ? ['toy', 'blocks']
        : ['cloud', 'tree']
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function sceneCacheSignature(theme: SceneTheme, brief: string, tags: SceneElementType[]): string {
  const normalized = `${brief.normalize('NFKC').trim()}|${[...tags].sort().join(',')}`
  return `${theme}-${tags.length}-${stableHash(normalized)}`
}
