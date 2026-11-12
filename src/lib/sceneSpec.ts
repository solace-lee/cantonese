export type SceneTheme = 'sky' | 'playground' | 'pond' | 'playroom'

export type SceneElementType = 'cloud' | 'sun' | 'tree' | 'ball' | 'flower' | 'pond' | 'duck' | 'toy' | 'hill' | 'star'
export type SceneAnimation = 'float' | 'pulse' | 'none'
export type CharacterPose = 'wave' | 'point' | 'jump' | 'idle'
export type CharacterMood = 'happy' | 'curious' | 'excited' | 'calm'
export type CharacterMouth = 'closed' | 'a' | 'i' | 'u'

export type SceneElement = {
  type: SceneElementType
  x: number
  y: number
  scale: number
  color?: string
  opacity?: number
  zIndex?: number
  animation?: SceneAnimation
}

export type SceneSpec = {
  version: 1
  theme: SceneTheme
  label: string
  palette: string
  elements: SceneElement[]
  character: {
    pose: CharacterPose
    mood: CharacterMood
    mouth: CharacterMouth
  }
}

const allowedThemes = new Set<SceneTheme>(['sky', 'playground', 'pond', 'playroom'])
const allowedElementTypes = new Set<SceneElementType>(['cloud', 'sun', 'tree', 'ball', 'flower', 'pond', 'duck', 'toy', 'hill', 'star'])
const allowedAnimations = new Set<SceneAnimation>(['float', 'pulse', 'none'])
const allowedPoses = new Set<CharacterPose>(['wave', 'point', 'jump', 'idle'])
const allowedMoods = new Set<CharacterMood>(['happy', 'curious', 'excited', 'calm'])
const allowedMouths = new Set<CharacterMouth>(['closed', 'a', 'i', 'u'])

export function isValidGeneratedScene(input: unknown, theme: SceneTheme): boolean {
  if (!input || typeof input !== 'object') return false
  const raw = input as Record<string, unknown>
  return raw.theme === theme && Array.isArray(raw.elements) && raw.elements.slice(0, SCENE_LIMITS.maxElements).some((value: unknown) => {
    if (!value || typeof value !== 'object') return false
    const type = (value as Record<string, unknown>).type
    return typeof type === 'string' && allowedElementTypes.has(type as SceneElementType)
  })
}

export const SCENE_LIMITS = {
  maxElements: 24,
  minX: 0,
  maxX: 760,
  minY: 0,
  maxY: 420,
  minScale: 0.3,
  maxScale: 2.5,
} as const

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function safeHex(value: unknown, fallback = '#8bbda1'): string {
  if (typeof value !== 'string') return fallback
  const candidate = value.trim()
  return /^#[0-9a-fA-F]{6}$/.test(candidate) ? candidate : fallback
}

function safeLabel(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const label = value.replace(/[<>]/g, '').trim().slice(0, 24)
  return label || fallback
}

function asTheme(value: unknown, fallback: SceneTheme): SceneTheme {
  return typeof value === 'string' && allowedThemes.has(value as SceneTheme) ? value as SceneTheme : fallback
}

export function normalizeSceneSpec(input: unknown, fallback: SceneSpec = DEFAULT_SCENE_SPECS.sky): SceneSpec {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const theme = asTheme(raw.theme, fallback.theme)
  const elements = Array.isArray(raw.elements) ? raw.elements.slice(0, SCENE_LIMITS.maxElements).flatMap((value) => {
    if (!value || typeof value !== 'object') return []
    const element = value as Record<string, unknown>
    const type = element.type
    if (typeof type !== 'string' || !allowedElementTypes.has(type as SceneElementType)) return []
    const x = typeof element.x === 'number' && Number.isFinite(element.x) ? element.x : 380
    const y = typeof element.y === 'number' && Number.isFinite(element.y) ? element.y : 180
    const scale = typeof element.scale === 'number' && Number.isFinite(element.scale) ? element.scale : 1
    const opacity = typeof element.opacity === 'number' && Number.isFinite(element.opacity) ? element.opacity : 1
    const zIndex = typeof element.zIndex === 'number' && Number.isFinite(element.zIndex) ? element.zIndex : 0
    const animation = typeof element.animation === 'string' && allowedAnimations.has(element.animation as SceneAnimation) ? element.animation as SceneAnimation : 'none'
    return [{
      type: type as SceneElementType,
      x: clamp(x, SCENE_LIMITS.minX, SCENE_LIMITS.maxX),
      y: clamp(y, SCENE_LIMITS.minY, SCENE_LIMITS.maxY),
      scale: clamp(scale, SCENE_LIMITS.minScale, SCENE_LIMITS.maxScale),
      color: safeHex(element.color),
      opacity: clamp(opacity, 0.15, 1),
      zIndex: Math.round(clamp(zIndex, -5, 5)),
      animation,
    } satisfies SceneElement]
  }) : []
  const rawCharacter = (raw.character && typeof raw.character === 'object' ? raw.character : {}) as Record<string, unknown>
  const pose = typeof rawCharacter.pose === 'string' && allowedPoses.has(rawCharacter.pose as CharacterPose) ? rawCharacter.pose as CharacterPose : fallback.character.pose
  const mood = typeof rawCharacter.mood === 'string' && allowedMoods.has(rawCharacter.mood as CharacterMood) ? rawCharacter.mood as CharacterMood : fallback.character.mood
  const mouth = typeof rawCharacter.mouth === 'string' && allowedMouths.has(rawCharacter.mouth as CharacterMouth) ? rawCharacter.mouth as CharacterMouth : fallback.character.mouth
  return {
    version: 1,
    theme,
    label: safeLabel(raw.label, fallback.label),
    palette: safeLabel(raw.palette, fallback.palette),
    elements: elements.length ? elements : fallback.elements,
    character: { pose, mood, mouth },
  }
}

export function parseSceneSpec(input: unknown, fallback: SceneSpec = DEFAULT_SCENE_SPECS.sky): SceneSpec {
  return normalizeSceneSpec(input, fallback)
}

export const DEFAULT_SCENE_SPECS: Record<SceneTheme, SceneSpec> = {
  sky: {
    version: 1, theme: 'sky', label: '蓝天草地', palette: 'sunny',
    elements: [
      { type: 'sun', x: 640, y: 80, scale: 1, color: '#ffd875', opacity: 1, zIndex: 0, animation: 'pulse' },
      { type: 'cloud', x: 140, y: 100, scale: 1.2, color: '#ffffff', opacity: .8, zIndex: 0, animation: 'float' },
      { type: 'cloud', x: 520, y: 68, scale: .8, color: '#ffffff', opacity: .7, zIndex: 0, animation: 'float' },
      { type: 'tree', x: 105, y: 240, scale: 1, color: '#6ea865', opacity: 1, zIndex: 1, animation: 'none' },
      { type: 'star', x: 570, y: 285, scale: .8, color: '#fff4a1', opacity: .8, zIndex: 2, animation: 'pulse' },
    ],
    character: { pose: 'wave', mood: 'happy', mouth: 'closed' },
  },
  playground: {
    version: 1, theme: 'playground', label: '欢乐球场', palette: 'field',
    elements: [
      { type: 'sun', x: 630, y: 62, scale: .8, color: '#ffd875', opacity: 1, zIndex: 0, animation: 'pulse' },
      { type: 'cloud', x: 170, y: 68, scale: .9, color: '#ffffff', opacity: .75, zIndex: 0, animation: 'float' },
      { type: 'ball', x: 236, y: 328, scale: 1, color: '#ea7463', opacity: 1, zIndex: 2, animation: 'pulse' },
      { type: 'star', x: 480, y: 295, scale: .7, color: '#fff4a1', opacity: .8, zIndex: 2, animation: 'pulse' },
    ],
    character: { pose: 'jump', mood: 'excited', mouth: 'a' },
  },
  pond: {
    version: 1, theme: 'pond', label: '荷花池塘', palette: 'water',
    elements: [
      { type: 'tree', x: 120, y: 245, scale: 1, color: '#78ac73', opacity: 1, zIndex: 1, animation: 'none' },
      { type: 'pond', x: 402, y: 330, scale: 1, color: '#80c8c5', opacity: 1, zIndex: 0, animation: 'none' },
      { type: 'flower', x: 281, y: 328, scale: 1, color: '#f68197', opacity: 1, zIndex: 2, animation: 'float' },
      { type: 'duck', x: 610, y: 286, scale: 1, color: '#fff5d7', opacity: 1, zIndex: 2, animation: 'float' },
    ],
    character: { pose: 'point', mood: 'curious', mouth: 'i' },
  },
  playroom: {
    version: 1, theme: 'playroom', label: '玩具房间', palette: 'warm',
    elements: [
      { type: 'toy', x: 190, y: 150, scale: 1, color: '#ffd88e', opacity: 1, zIndex: 1, animation: 'none' },
      { type: 'toy', x: 600, y: 160, scale: .9, color: '#f7c7b1', opacity: 1, zIndex: 1, animation: 'none' },
      { type: 'star', x: 495, y: 90, scale: .7, color: '#f5b43f', opacity: .8, zIndex: 2, animation: 'pulse' },
    ],
    character: { pose: 'wave', mood: 'happy', mouth: 'u' },
  },
}
