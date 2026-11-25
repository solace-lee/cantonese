import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { ChatClient, describeChatClientError, isAbortError } from './lib/chatClient'
import type { AgeGroup, ChatMessage } from './lib/types'
import { AGE_PROFILES, getAgeProfile } from './lib/ageProfiles'
import { DEFAULT_SCENE_SPECS, isValidGeneratedScene, normalizeSceneSpec } from './lib/sceneSpec'
import type { SceneSpec } from './lib/sceneSpec'
import { SceneSpecRenderer } from './lib/sceneRenderer'
import { getCachedScene, setCachedScene, clearSceneCache } from './lib/sceneCache'
import {
  DEFAULT_SCENE_BRIEFS,
  SCENE_ELEMENT_TYPES,
  sanitizeSceneBrief,
  sanitizeSceneTags,
  sceneCacheSignature,
} from './lib/sceneContext'
import './styles.css'

type SceneKey = 'sky' | 'playground' | 'pond' | 'playroom'
type MouthFrame = 'closed' | 'a' | 'i' | 'u'

const sceneElementTypes = SCENE_ELEMENT_TYPES.join('|')
const scenePrompt = `你是儿童粤语学习网站的场景设计师。请只返回 JSON 对象 {"reply":"场景已准备好","sceneSpec":{"version":1,"theme":"sky|playground|pond|playroom","label":"短场景名","palette":"sunny|day|field|water|warm|dusk","elements":[{"type":"${sceneElementTypes}","x":100,"y":100,"scale":1,"color":"#ffffff","opacity":1,"zIndex":0,"animation":"none|float|pulse"}],"character":{"pose":"wave|point|jump|idle","mood":"happy|curious|excited|calm"}}}。画布 760×420；elements 最多 24 个且至少 1 个，仅允许所列类型、六位十六进制颜色、x 为 0–760、y 为 0–420、scale 为 0.3–2.5、opacity 为 0.15–1、zIndex 为 -5–5。按场景摘要安排具体位置和关系，使用少量有意义的 float/pulse 动画。摘要若含个人信息，不要复述或放入 label。不要输出 SVG、HTML、链接或代码。`

type ApiConfig = {
  provider: string
  baseUrl: string
  model: string
  apiKey: string
  systemPrompt: string
}

type AgeBand = AgeGroup

const defaultApiConfig: ApiConfig = {
  provider: 'OpenAI 兼容接口',
  baseUrl: '',
  model: '',
  apiKey: '',
  systemPrompt: '你是一位温柔、活泼的儿童粤语老师。用简短、鼓励的粤语和普通话解释。',
}

const emptyApiConfig: ApiConfig = {
  ...defaultApiConfig,
  baseUrl: '',
  model: '',
  apiKey: '',
}

type ConnectionState = {
  status: 'idle' | 'testing' | 'success' | 'error'
  message: string
}

const scenes: Record<SceneKey, { label: string; sublabel: string; color: string; icon: string }> = {
  sky: { label: '蓝天草地', sublabel: '和小鸟打招呼', color: '#dff4ff', icon: '☀' },
  playground: { label: '欢乐球场', sublabel: '一起踢足球', color: '#e6f4dc', icon: '⚽' },
  pond: { label: '荷花池塘', sublabel: '找找小鸭子', color: '#e1f6f3', icon: '✿' },
  playroom: { label: '玩具房间', sublabel: '认识新玩具', color: '#fff0dc', icon: '▣' },
}

const phrases = [
  { category: '打招呼', cantonese: '早晨！', romanization: 'zou2 san4', meaning: '早上好！', color: '#ffe9d8', note: '轻轻上扬，像太阳升起来' },
  { category: '礼貌用语', cantonese: '唔该！', romanization: 'm4 goi1', meaning: '谢谢 / 麻烦你了！', color: '#e7f3ff', note: '嘴巴先闭上，再张开“该”' },
  { category: '生活会话', cantonese: '我想要波波球。', romanization: 'ngo5 soeng2 jiu3 bo1 bo1 kau4', meaning: '我想要泡泡球。', color: '#f1e8ff', note: '“波波”要说得圆圆的' },
]

function Icon({ name, size = 18, stroke = 1.8 }: { name: string; size?: number; stroke?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: stroke, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const paths: Record<string, ReactNode> = {
    spark: <><path d="m12 3-1.1 4.4L7 9l3.9 1.6L12 15l1.1-4.4L17 9l-3.9-1.6L12 3Z" /><path d="m19 14-.6 2.4L16 17l2.4.6L19 20l.6-2.4L22 17l-2.4-.6L19 14Z" /></>,
    play: <><path d="m8 5 11 7-11 7V5Z" fill="currentColor" stroke="none" /></>,
    pause: <><path d="M8 5v14M16 5v14" /></>,
    arrow: <><path d="M5 12h13" /><path d="m13 6 6 6-6 6" /></>,
    chevron: <path d="m7 9 5 5 5-5" />,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    lock: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    monitor: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></>,
  }
  return <svg {...common}>{paths[name]}</svg>
}

function ParticleCanvas({ scene }: { scene: SceneKey }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const parent = canvas.parentElement
    if (!parent) return
    let frame = 0
    const particles = Array.from({ length: 18 }, (_, index) => ({
      x: 0.08 + ((index * 0.17) % 0.84),
      y: 0.2 + ((index * 0.23) % 0.65),
      r: 2 + (index % 3),
      speed: 0.00015 + (index % 4) * 0.00005,
      delay: index * 0.8,
    }))
    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = parent.clientWidth * dpr
      canvas.height = parent.clientHeight * dpr
      canvas.style.width = `${parent.clientWidth}px`
      canvas.style.height = `${parent.clientHeight}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    const render = (time: number) => {
      const width = parent.clientWidth
      const height = parent.clientHeight
      ctx.clearRect(0, 0, width, height)
      const tint = scene === 'playground' ? '#6dad65' : scene === 'pond' ? '#58aaa1' : scene === 'playroom' ? '#d38c67' : '#6ba9ba'
      particles.forEach((particle) => {
        const progress = (time * particle.speed + particle.delay) % 1
        const x = (particle.x + Math.sin(time / 900 + particle.delay) * 0.018) * width
        const y = (particle.y - progress * 0.18) * height
        ctx.globalAlpha = 0.18 + Math.sin(time / 500 + particle.delay) * 0.08
        ctx.fillStyle = tint
        ctx.beginPath()
        ctx.arc(x, y, particle.r, 0, Math.PI * 2)
        ctx.fill()
      })
      frame = requestAnimationFrame(render)
    }
    resize()
    window.addEventListener('resize', resize)
    frame = requestAnimationFrame(render)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
    }
  }, [scene])
  return <canvas className="particle-canvas" ref={canvasRef} aria-hidden="true" />
}

function SceneIllustration({ scene, mouth }: { scene: SceneKey; mouth: MouthFrame }) {
  return (
    <div className={`scene-art scene-${scene}`}>
      <svg viewBox="0 0 760 420" role="img" aria-label={`${scenes[scene].label}学习场景`} preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="skyGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#b9e9ff" /><stop offset="1" stopColor="#edf9f3" /></linearGradient>
          <linearGradient id="fieldGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#dff2cc" /><stop offset="1" stopColor="#b8da9a" /></linearGradient>
          <linearGradient id="pondGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#b8e9e5" /><stop offset="1" stopColor="#80c8c5" /></linearGradient>
          <linearGradient id="roomGradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffe7c4" /><stop offset="1" stopColor="#ffcfaf" /></linearGradient>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#4c6b6d" floodOpacity=".14" /></filter>
        </defs>

        {scene === 'sky' && <>
          <rect width="760" height="420" fill="url(#skyGradient)" />
          <circle cx="640" cy="85" r="45" fill="#ffd875" opacity=".95" />
          <g fill="#fff" opacity=".8"><path d="M104 112c0-19 15-34 34-34 13 0 24 7 30 18 4-3 9-5 15-5 16 0 29 13 29 29H104Z" /><path d="M480 65c0-14 11-25 25-25 10 0 18 5 22 13 3-2 7-4 11-4 12 0 21 9 21 21h-79Z" /></g>
          <path d="M0 280c115-30 200-28 322 8 112 33 247 21 438-22v154H0Z" fill="#b9dc99" />
          <path d="M0 330c155-48 260-17 394 18 132 34 248 20 366-4v76H0Z" fill="#9bc981" />
          <g fill="#6ea865"><path d="M97 248c-8-60 0-93 10-118h11c11 26 17 57 8 118Z" /><circle cx="102" cy="133" r="32" /><circle cx="129" cy="152" r="35" /><circle cx="83" cy="155" r="27" /></g>
          <g fill="#fff" opacity=".75"><circle cx="560" cy="288" r="4" /><circle cx="584" cy="300" r="2.5" /><circle cx="602" cy="278" r="3" /></g>
        </>}
        {scene === 'playground' && <>
          <rect width="760" height="420" fill="#d9efff" />
          <circle cx="626" cy="66" r="34" fill="#ffd875" />
          <path d="M0 230h760v190H0Z" fill="url(#fieldGradient)" />
          <path d="M0 303c154-24 268-22 394 0 144 25 244 21 366-4v121H0Z" fill="#a7ce81" />
          <path d="M520 420c-38-83-33-138 11-189" fill="none" stroke="#fff" strokeWidth="5" opacity=".6" />
          <path d="M518 350c42-20 93-20 132 0" fill="none" stroke="#fff" strokeWidth="4" opacity=".6" />
          <g stroke="#d1785d" strokeWidth="7" fill="none"><path d="M78 235v-120M78 115h118M196 115v120M78 152l59-37 59 37" /></g>
          <path d="M96 173h82" stroke="#e99f52" strokeWidth="10" strokeLinecap="round" />
          <circle cx="238" cy="330" r="26" fill="#fff" stroke="#ea7463" strokeWidth="7" /><path d="m225 313 17 15-12 20M251 310l-6 22 18 13" fill="none" stroke="#ea7463" strokeWidth="5" />
          <g fill="#fff" opacity=".75"><path d="M135 74c0-15 12-27 27-27 10 0 19 5 23 14 3-2 7-4 12-4 13 0 23 10 23 23h-85Z" /></g>
        </>}
        {scene === 'pond' && <>
          <rect width="760" height="420" fill="#e1f5ef" />
          <path d="M0 205c110-35 190-25 270 12 115 53 221 30 318-8 74-28 120-26 172-9v220H0Z" fill="#a6d79f" />
          <ellipse cx="402" cy="331" rx="328" ry="115" fill="url(#pondGradient)" />
          <path d="M83 291c60-19 95-15 155 6M495 314c54-15 96-12 147 6M202 354c46-12 73-11 121 4" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".55" />
          <g fill="#7ab67f"><ellipse cx="281" cy="328" rx="34" ry="15" transform="rotate(-15 281 328)" /><ellipse cx="523" cy="355" rx="28" ry="13" transform="rotate(17 523 355)" /></g>
          <g fill="#f68197"><path d="m283 314 7-14 7 14 14 3-11 9 3 15-13-8-13 8 3-15-11-9 14-3Z" /><path d="m524 347 6-12 6 12 12 3-9 8 2 13-11-7-11 7 3-13-10-8 12-3Z" /></g>
          <g fill="#78ac73"><path d="M113 249c-6-63 5-103 18-130h11c7 39 7 80-2 130Z" /><circle cx="121" cy="126" r="35" /><circle cx="151" cy="151" r="30" /><circle cx="90" cy="152" r="28" /></g>
          <g transform="translate(610 286)"><ellipse cx="0" cy="22" rx="29" ry="18" fill="#fff5d7" /><circle cx="18" cy="5" r="17" fill="#fff5d7" /><circle cx="24" cy="1" r="3" fill="#2f4a4a" /><path d="m33 6 15 7-15 7" fill="#ef9b52" /></g>
        </>}
        {scene === 'playroom' && <>
          <rect width="760" height="420" fill="url(#roomGradient)" />
          <path d="M0 314h760v106H0Z" fill="#f4b78f" /><path d="M0 314h760" stroke="#de966f" strokeWidth="4" />
          <g transform="translate(95 76)" filter="url(#shadow)"><rect width="200" height="190" rx="18" fill="#ffd88e" /><path d="M18 70h164M18 135h164" stroke="#e9a76e" strokeWidth="8" /><path d="M58 19v50M142 19v50M58 86v49M142 86v49" stroke="#e9a76e" strokeWidth="8" /><circle cx="43" cy="46" r="17" fill="#f49284" /><path d="M125 39h37v29h-37Z" fill="#7bc3cf" /><path d="m45 104 25 25 25-25" fill="none" stroke="#8e9fdb" strokeWidth="12" /></g>
          <g transform="translate(545 102)"><rect width="110" height="155" rx="12" fill="#f7c7b1" /><path d="M17 42h76M17 91h76" stroke="#e1a391" strokeWidth="7" /><circle cx="37" cy="23" r="10" fill="#f5b43f" /><circle cx="72" cy="70" r="12" fill="#77bbc8" /><path d="M29 118h54v23H29Z" fill="#8e9fdb" /></g>
          <g fill="#ef9b52"><rect x="345" y="309" width="41" height="41" rx="6" /><rect x="391" y="326" width="41" height="41" rx="6" /></g><g fill="#75b5c1"><rect x="368" y="280" width="41" height="41" rx="6" /><rect x="416" y="302" width="41" height="41" rx="6" /></g>
        </>}

        <g transform="translate(325 142)" filter="url(#shadow)">
          <ellipse cx="62" cy="231" rx="70" ry="16" fill="#466666" opacity=".12" />
          <path d="M34 141c-10 21-15 54-11 88h77c4-34-3-68-19-88Z" fill="#ee836e" />
          <path d="M33 213c-4 22-4 35-1 45M92 213c5 23 5 35 1 45" fill="none" stroke="#3c5a5c" strokeWidth="12" strokeLinecap="round" />
          <circle cx="62" cy="92" r="59" fill="#ffd5b9" />
          <path d="M6 88C1 48 26 9 63 11c39 1 61 32 55 72-11-11-24-21-38-29-14 11-39 20-74 34Z" fill="#5b4b4e" />
          <path d="M21 76c-4-19 4-39 24-47M89 38c10 8 16 20 17 34" fill="none" stroke="#72585a" strokeWidth="10" strokeLinecap="round" />
          <ellipse cx="40" cy="91" rx="6" ry="8" fill="#374f54" /><ellipse cx="84" cy="91" rx="6" ry="8" fill="#374f54" />
          <circle cx="38" cy="89" r="2" fill="#fff" /><circle cx="82" cy="89" r="2" fill="#fff" />
          {mouth === 'closed' && <path d="M52 115c7 7 14 7 21 0" fill="none" stroke="#a85f5e" strokeWidth="4" strokeLinecap="round" />}
          {mouth === 'a' && <ellipse cx="63" cy="117" rx="11" ry="9" fill="#783f49" stroke="#a85f5e" strokeWidth="3" />}
          {mouth === 'i' && <ellipse cx="63" cy="117" rx="6" ry="10" fill="#783f49" stroke="#a85f5e" strokeWidth="3" />}
          {mouth === 'u' && <ellipse cx="63" cy="117" rx="13" ry="6" fill="#783f49" stroke="#a85f5e" strokeWidth="3" />}
          <path d="M22 147c24 13 56 13 82 0" fill="none" stroke="#fff" strokeWidth="5" opacity=".75" />
          <path d="M0 172c-19 10-32 31-32 51M124 172c19 10 32 31 32 51" fill="none" stroke="#ffd5b9" strokeWidth="15" strokeLinecap="round" />
          <circle cx="-32" cy="224" r="7" fill="#ffd5b9" /><circle cx="156" cy="224" r="7" fill="#ffd5b9" />
        </g>

        <g transform="translate(522 116)"><path d="M0 22c0-25 30-36 55-29 20 5 24 26 14 39-10 13-34 19-53 14L0 57l5-18C2 34 0 28 0 22Z" fill="#fff" opacity=".93" /><text x="16" y="34" fill="#365b60" fontSize="20" fontWeight="700" fontFamily="Nunito, system-ui, sans-serif">你好呀！</text></g>
      </svg>
      <ParticleCanvas scene={scene} />
      <div className="scene-badge"><span className="scene-badge-dot" />正在练习 · {scenes[scene].label}</div>
    </div>
  )
}

function Waveform({ active }: { active: boolean }) {
  return <div className={`waveform ${active ? 'waveform-active' : ''}`} aria-hidden="true">{Array.from({ length: 22 }, (_, index) => <span key={index} style={{ '--bar-height': `${12 + ((index * 17) % 26)}px`, '--bar-delay': `${index * 0.035}s` } as React.CSSProperties} />)}</div>
}

function readStoredApiConfig(): ApiConfig {
  try {
    const stored = JSON.parse(localStorage.getItem('canto-api-config') || '{}') as Partial<ApiConfig>
    return {
      ...defaultApiConfig,
      ...stored,
      baseUrl: typeof stored.baseUrl === 'string' ? stored.baseUrl : defaultApiConfig.baseUrl,
      model: typeof stored.model === 'string' ? stored.model : defaultApiConfig.model,
      apiKey: typeof stored.apiKey === 'string' ? stored.apiKey : '',
      systemPrompt: typeof stored.systemPrompt === 'string' ? stored.systemPrompt : defaultApiConfig.systemPrompt,
    }
  } catch {
    return { ...defaultApiConfig }
  }
}

function readStoredAgeBand(): AgeBand {
  const saved = localStorage.getItem('canto-age-band')
  if (saved === '12+') return '12-plus'
  return saved === '3-6' || saved === '6-12' || saved === '12-plus' ? saved : '6-12'
}

type SceneGenerationContext = {
  brief?: unknown
  tags?: unknown
}

function App() {
  const [scene, setScene] = useState<SceneKey>('sky')
  const [ageBand, setAgeBand] = useState<AgeBand>(readStoredAgeBand)
  const [isTvMode, setIsTvMode] = useState(() => localStorage.getItem('canto-display-mode') === 'tv')
  const [isAgeMenuOpen, setIsAgeMenuOpen] = useState(false)
  const [activePhrase, setActivePhrase] = useState(1)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [mouth, setMouth] = useState<MouthFrame>('closed')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [chatInput, setChatInput] = useState('')
  const [chatError, setChatError] = useState('')
  const [lastFailedPrompt, setLastFailedPrompt] = useState('')
  const [isChatting, setIsChatting] = useState(false)
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [generatedScene, setGeneratedScene] = useState<SceneSpec | null>(null)
  const [sceneStatus, setSceneStatus] = useState('内置场景')
  const sceneRequest = useRef(0)
  const chatRequest = useRef(0)
  const sceneAbort = useRef<AbortController | null>(null)
  const chatAbort = useRef<AbortController | null>(null)
  const connectionAbort = useRef<AbortController | null>(null)
  const connectionRequest = useRef(0)
  const sceneContext = useRef<Required<SceneGenerationContext>>({
    brief: DEFAULT_SCENE_BRIEFS.sky,
    tags: sanitizeSceneTags(undefined, 'sky'),
  })
  const [lessonHint, setLessonHint] = useState('')
  const [replySpeech, setReplySpeech] = useState('')
  const [apiConfig, setApiConfig] = useState<ApiConfig>(readStoredApiConfig)
  const [draftConfig, setDraftConfig] = useState<ApiConfig>(apiConfig)
  const [rememberApiKey, setRememberApiKey] = useState(() => Boolean(readStoredApiConfig().apiKey))
  const [connectionState, setConnectionState] = useState<ConnectionState>({ status: 'idle', message: '' })

  const currentPhrase = phrases[activePhrase]
  const ageProfile = getAgeProfile(ageBand)
  const chatClient = useMemo(() => new ChatClient(apiConfig), [apiConfig])
  const speakingLabel = isSpeaking ? '小麦正在示范' : '点击听发音'
  const canCallModel = Boolean(apiConfig.baseUrl.trim() && apiConfig.model.trim() && (apiConfig.apiKey.trim() || apiConfig.provider === '自定义服务'))

  useEffect(() => {
    if (!isSpeaking) { setMouth('closed'); return }
    const frames: MouthFrame[] = ['a', 'i', 'u', 'a', 'closed']
    let frame = 0
    const interval = window.setInterval(() => { setMouth(frames[frame % frames.length]); frame += 1 }, 180)
    return () => window.clearInterval(interval)
  }, [isSpeaking])

  useEffect(() => {
    if (!showToast) return
    const timer = window.setTimeout(() => setShowToast(false), 2600)
    return () => window.clearTimeout(timer)
  }, [showToast])

  useEffect(() => () => {
    chatAbort.current?.abort()
    sceneAbort.current?.abort()
    connectionAbort.current?.abort()
  }, [])

  const speakText = (text: string) => {
    if (isSpeaking) {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
      setIsSpeaking(false)
      return
    }
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
      setToastMessage('此浏览器暂不支持语音播放')
      setShowToast(true)
      return
    }
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'zh-HK'
    utterance.voice = window.speechSynthesis.getVoices().find((voice) => voice.lang.toLowerCase() === 'zh-hk') || null
    if (!utterance.voice) {
      setToastMessage('未找到粤语音色，将尝试设备默认语音')
      setShowToast(true)
    }
    utterance.rate = 0.74
    utterance.pitch = 1.1
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)
    window.speechSynthesis.cancel()
    setIsSpeaking(true)
    window.speechSynthesis.speak(utterance)
  }
  const playPhrase = () => speakText(currentPhrase.cantonese)

  const updateDraftConfig = (patch: Partial<ApiConfig>) => {
    cancelConnectionTest()
    setDraftConfig((current) => ({ ...current, ...patch }))
    setConnectionState({ status: 'idle', message: '' })
  }

  const cancelConnectionTest = () => {
    connectionRequest.current += 1
    connectionAbort.current?.abort()
    connectionAbort.current = null
  }

  const cancelChatRequest = () => {
    chatRequest.current += 1
    chatAbort.current?.abort()
    chatAbort.current = null
    setIsChatting(false)
  }

  const cancelSceneRequest = () => {
    sceneRequest.current += 1
    sceneAbort.current?.abort()
    sceneAbort.current = null
  }

  const saveApiConfig = () => {
    cancelConnectionTest()
    cancelChatRequest()
    cancelSceneRequest()
    setChatError('')
    setLastFailedPrompt('')
    setGeneratedScene(null)
    setSceneStatus('内置场景')
    const nextConfig: ApiConfig = {
      ...draftConfig,
      baseUrl: draftConfig.baseUrl.trim(),
      model: draftConfig.model.trim(),
      apiKey: draftConfig.apiKey.trim(),
    }
    localStorage.setItem('canto-api-config', JSON.stringify({
      ...nextConfig,
      apiKey: rememberApiKey ? nextConfig.apiKey : '',
    }))
    setApiConfig(nextConfig)
    setConnectionState({ status: 'idle', message: '' })
    setIsSettingsOpen(false)
    setToastMessage(rememberApiKey ? '配置已保存，API Key 会保存在当前浏览器' : '配置已保存，API Key 仅在当前页面使用')
    setShowToast(true)
  }

  const clearApiConfig = () => {
    cancelConnectionTest()
    localStorage.removeItem('canto-api-config')
    cancelChatRequest()
    cancelSceneRequest()
    setApiConfig(emptyApiConfig)
    setDraftConfig(emptyApiConfig)
    setRememberApiKey(false)
    setConnectionState({ status: 'idle', message: '' })
    setChatError('')
    setGeneratedScene(null)
    setSceneStatus('内置场景')
    setToastMessage('本机接口配置和 API Key 已清除')
    setShowToast(true)
  }

  const openSettings = () => {
    cancelConnectionTest()
    setDraftConfig(apiConfig)
    setConnectionState({ status: 'idle', message: '' })
    setIsSettingsOpen(true)
  }

  const closeSettings = () => {
    cancelConnectionTest()
    setConnectionState({ status: 'idle', message: '' })
    setIsSettingsOpen(false)
  }

  const testConnection = async () => {
    if (!draftConfig.baseUrl.trim() || !draftConfig.model.trim()) {
      setConnectionState({ status: 'error', message: '请先填写 Base URL 和模型名称。' })
      return
    }
    connectionAbort.current?.abort()
    const controller = new AbortController()
    connectionAbort.current = controller
    const requestId = ++connectionRequest.current
    let timedOut = false
    const timeout = window.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, 15000)
    setConnectionState({ status: 'testing', message: '正在连接模型服务…' })
    try {
      await new ChatClient(draftConfig).testConnection(controller.signal)
      if (connectionRequest.current === requestId) setConnectionState({ status: 'success', message: '连接成功，可以开始对话。' })
    } catch (error) {
      if (connectionRequest.current === requestId) setConnectionState({ status: 'error', message: describeChatClientError(error, timedOut) })
    } finally {
      window.clearTimeout(timeout)
      if (connectionRequest.current === requestId && connectionAbort.current === controller) connectionAbort.current = null
    }
  }

  const chooseAgeBand = (nextAge: AgeBand) => {
    cancelChatRequest()
    cancelSceneRequest()
    setGeneratedScene(null)
    setSceneStatus('内置场景')
    setAgeBand(nextAge)
    setChatHistory([])
    setChatError('')
    setLastFailedPrompt('')
    setReplySpeech('')
    setLessonHint('')
    localStorage.setItem('canto-age-band', nextAge)
    setIsAgeMenuOpen(false)
    setToastMessage(`已切换到${AGE_PROFILES[nextAge].label}`)
    setShowToast(true)
  }

  const toggleTvMode = () => {
    const next = !isTvMode
    setIsTvMode(next)
    localStorage.setItem('canto-display-mode', next ? 'tv' : 'compact')
    setToastMessage(next ? '已进入大屏模式，适合电视和远距离观看' : '已退出大屏模式')
    setShowToast(true)
  }

  const loadScene = async (nextScene: SceneKey, context: SceneGenerationContext = {}, refresh = false) => {
    const requestId = ++sceneRequest.current
    sceneAbort.current?.abort()
    const brief = sanitizeSceneBrief(context.brief, nextScene)
    const tags = sanitizeSceneTags(context.tags, nextScene)
    sceneContext.current = { brief, tags }
    setScene(nextScene)
    setGeneratedScene(null)
    setSceneStatus('内置场景')
    if (!canCallModel) return
    let cacheBase = apiConfig.baseUrl.split(/[?#]/, 1)[0]
    try { const url = new URL(apiConfig.baseUrl, window.location.origin); cacheBase = `${url.origin}${url.pathname}` } catch { /* Keep the query-free configured path. */ }
    const cacheKey = `${cacheBase}|${apiConfig.model}|${ageBand}|v2|${sceneCacheSignature(nextScene, brief, tags)}`
    if (!refresh) {
      const cached = await getCachedScene(cacheKey, nextScene)
      if (sceneRequest.current !== requestId) return
      if (cached) { setGeneratedScene(cached); setSceneStatus('已加载场景'); return }
    }
    setSceneStatus('正在设计场景…')
    const controller = new AbortController()
    sceneAbort.current = controller
    let timedOut = false
    const timeout = window.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, 20000)
    try {
      const result = await chatClient.send({
        ageGroup: ageBand,
        systemPrompt: scenePrompt,
        signal: controller.signal,
        messages: [{
          role: 'user',
          content: `请根据以下受约束信息设计儿童场景：${JSON.stringify({ theme: nextScene, label: scenes[nextScene].label, brief, tags })}`,
        }],
      })
      const raw = result.turn?.sceneSpec
      if (!isValidGeneratedScene(raw, nextScene)) throw new Error('invalid scene')
      const spec = normalizeSceneSpec(raw, DEFAULT_SCENE_SPECS[nextScene])
      if (sceneRequest.current !== requestId) return
      setGeneratedScene(spec)
      setSceneStatus('AI 场景')
      void setCachedScene(cacheKey, spec)
    } catch (error) {
      if (sceneRequest.current === requestId) {
        setSceneStatus(timedOut
          ? '场景生成超时，使用内置场景'
          : isAbortError(error) || (error instanceof Error && error.message.includes('取消'))
            ? '内置场景'
            : '场景生成失败，使用内置场景')
      }
    } finally {
      window.clearTimeout(timeout)
      if (sceneAbort.current === controller) sceneAbort.current = null
    }
  }

  const generateScene = () => {
    if (!canCallModel) { openSettings(); return }
    void loadScene(scene, sceneContext.current, true)
  }

  const clearLocalData = () => {
    cancelChatRequest()
    cancelSceneRequest()
    setChatHistory([])
    setChatInput('')
    setChatError('')
    setLastFailedPrompt('')
    setReplySpeech('')
    setLessonHint('')
    setGeneratedScene(null)
    setSceneStatus('内置场景')
    sceneContext.current = {
      brief: DEFAULT_SCENE_BRIEFS[scene],
      tags: sanitizeSceneTags(undefined, scene),
    }
    void clearSceneCache()
    setToastMessage('本地对话与场景缓存已清空')
    setShowToast(true)
  }

  const stopChat = () => {
    chatAbort.current?.abort()
  }

  const askAi = async (override?: string) => {
    const prompt = (override ?? chatInput).trim()
    if (!prompt || isChatting) return
    if (!canCallModel) { setChatError('请先配置模型接口，再开始对话。'); return }
    const baseHistory = chatHistory
    const userMessage: ChatMessage = { role: 'user', content: prompt }
    const nextHistory = [...baseHistory, userMessage]
    const requestId = ++chatRequest.current
    const controller = new AbortController()
    chatAbort.current?.abort()
    chatAbort.current = controller
    let timedOut = false
    const timeout = window.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, 30000)
    setIsChatting(true)
    setChatError('')
    setLastFailedPrompt('')
    setReplySpeech('')
    setChatInput('')
    setChatHistory(nextHistory)
    try {
      const result = await chatClient.send({
        messages: nextHistory.slice(-20),
        ageGroup: ageBand,
        signal: controller.signal,
        systemPrompt: `请优先返回 JSON：{"reply":"面向孩子的粤语回复","ttsText":"朗读文字","lessonHint":"简短提示","sceneTheme":"sky|playground|pond|playroom|null","sceneBrief":"仅供画面的简短场景摘要","sceneTags":["pond","duck"]}。sceneBrief 最多 60 个汉字，只写可见场景，不含真实姓名、住址、学校、联系方式或其他个人信息。sceneTags 只能从 ${sceneElementTypes} 中选择，最多 8 个。仅当对话明确转到新的地点或场景变化时填写 sceneTheme、sceneBrief 和 sceneTags，否则均返回 null 或空数组。`,
      })
      if (chatRequest.current !== requestId) return
      const reply = result.message.content.trim()
      if (!reply) throw new Error('empty model response')
      setReplySpeech(result.turn?.ttsText || reply)
      setLessonHint(result.turn?.lessonHint || '')
      setChatHistory([...nextHistory, { role: 'assistant', content: reply }])
      setLastFailedPrompt('')
      const suggestedTheme = result.turn?.sceneTheme
      if (suggestedTheme && Object.hasOwn(scenes, suggestedTheme)) {
        void loadScene(suggestedTheme as SceneKey, {
          brief: result.turn?.sceneBrief,
          tags: result.turn?.sceneTags,
        })
      }
    } catch (error) {
      if (chatRequest.current !== requestId) return
      setChatHistory(baseHistory)
      setChatInput(prompt)
      setLastFailedPrompt(prompt)
      setChatError(describeChatClientError(error, timedOut))
    } finally {
      window.clearTimeout(timeout)
      if (chatAbort.current === controller) chatAbort.current = null
      if (chatRequest.current === requestId) setIsChatting(false)
    }
  }

  return (
    <div className={`app-shell ${isTvMode ? 'tv-mode' : ''}`} data-age-band={ageBand}>
      <main className="main-content">
        <header className="topbar"><div className="brand-lockup"><div className="brand-mark"><span>芽</span><i /></div><div><strong>Canto芽</strong><small>儿童粤语小课堂</small></div></div><div className="topbar-actions"><div className="mode-controls"><div className="age-control"><button className="age-toggle" onClick={() => setIsAgeMenuOpen((open) => !open)} aria-expanded={isAgeMenuOpen}><span className="age-toggle-dot" />{ageProfile.shortLabel}<Icon name="chevron" size={13} /></button>{isAgeMenuOpen && <div className="age-menu" role="menu">{(Object.keys(AGE_PROFILES) as AgeBand[]).map((key) => <button key={key} className={`age-option ${ageBand === key ? 'age-option-active' : ''}`} onClick={() => chooseAgeBand(key)}><span>{AGE_PROFILES[key].shortLabel}</span><small>{AGE_PROFILES[key].interactionHint}</small>{ageBand === key && <Icon name="check" size={14} />}</button>)}</div>}</div><button className={`tv-toggle ${isTvMode ? 'tv-toggle-active' : ''}`} onClick={toggleTvMode} aria-pressed={isTvMode}><Icon name="monitor" size={14} /><span>{isTvMode ? '退出大屏' : '大屏模式'}</span></button></div></div></header>
        <div className="content-grid">
          <section className="learning-column">
            <div className="welcome-row"><div><p className="eyebrow">{ageProfile.label}</p><h1>一齐讲粤语 <span>☀</span></h1><p className="welcome-subtitle">{ageProfile.welcomeCopy}</p></div></div>
            <div className="practice-card">
              <div className="practice-head"><div><div className="section-kicker"><span className="kicker-dot" />{ageProfile.interactionHint}</div><h2>{ageProfile.lessonTitle}</h2><p>{ageProfile.lessonHint}</p></div></div>
              <div className="scene-picker">{(Object.keys(scenes) as SceneKey[]).map((key) => <button key={key} className={`scene-option ${scene === key ? 'scene-option-active' : ''}`} style={{ '--scene-color': scenes[key].color } as React.CSSProperties} onClick={() => void loadScene(key)}><span>{scenes[key].icon}</span><div><strong>{scenes[key].label}</strong><small>{scenes[key].sublabel}</small></div>{scene === key && <Icon name="check" size={15} />}</button>)}</div>
              <div className="scene-card">{generatedScene ? <div className="scene-art"><SceneSpecRenderer spec={{ ...generatedScene, character: { ...generatedScene.character, mouth } }} /><ParticleCanvas scene={scene} /><div className="scene-badge">{sceneStatus} · {generatedScene.label}</div></div> : <SceneIllustration scene={scene} mouth={mouth} />}<span className="scene-status" role="status">{sceneStatus}</span><button className="scene-refresh-button" onClick={generateScene}><Icon name="spark" size={13} /> {canCallModel ? '生成新场景' : '配置模型生成场景'}</button></div>
              <div className="phrase-row"><div className="phrase-label"><span>练习句子</span><small>点击卡片切换练习</small></div><div className="phrase-cards">{phrases.map((phrase, index) => <button key={phrase.cantonese} className={`phrase-card ${activePhrase === index ? 'phrase-card-active' : ''}`} style={{ '--phrase-color': phrase.color } as React.CSSProperties} onClick={() => setActivePhrase(index)}><span>{phrase.category}</span><strong>{phrase.cantonese}</strong><small>{phrase.romanization}</small></button>)}</div></div>
              <div className="practice-actions"><button className={`listen-button ${isSpeaking ? 'listen-button-playing' : ''}`} onClick={playPhrase}><span className="listen-icon"><Icon name={isSpeaking ? 'pause' : 'play'} size={16} /></span><span><strong>{isSpeaking ? '正在播放...' : '听听小麦怎么说'}</strong><small>{speakingLabel}</small></span></button><button className="next-button" onClick={() => setActivePhrase((activePhrase + 1) % phrases.length)}><span>下一个句子</span><Icon name="arrow" size={16} /></button></div>
            </div>
          </section>

          <aside className="insight-column">
            <div className="coach-card"><div className="coach-head"><div><div className="section-kicker"><span className="live-dot" />AI 粤语伙伴</div><h3>{ageProfile.coachTitle}</h3></div></div><div className="coach-wave"><Waveform active={isSpeaking} /></div><div className="coach-quote"><span className="quote-mark">“</span><p>{lessonHint || currentPhrase.note}</p><span className="quote-mark quote-mark-end">”</span></div><button className={`record-button ${isSpeaking ? 'record-button-active' : ''}`} onClick={playPhrase}><span><Icon name={isSpeaking ? "pause" : "play"} size={21} /></span><strong>{isSpeaking ? '点击停止' : '播放示范'}</strong><small>{ageBand === '3-6' ? '听完后做一个动作，再跟小麦说' : '听完后跟着小麦说一遍'}</small></button><div className="ask-row"><input value={chatInput} disabled={isChatting} onChange={(event) => setChatInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !isChatting) void askAi() }} placeholder={ageProfile.placeholder} aria-label="问问小麦" /><button className="ask-send-button" onClick={() => { if (isChatting) stopChat(); else void askAi() }} disabled={!isChatting && !chatInput.trim()} aria-label={isChatting ? '取消请求' : '发送问题'}><Icon name={isChatting ? "pause" : "arrow"} size={14} /></button></div><div className="chat-suggestions">{ageProfile.suggestions.map((suggestion) => <button key={suggestion} disabled={isChatting} onClick={() => setChatInput(suggestion)}>{suggestion}</button>)}</div>{(chatHistory.length > 0 || isChatting) && <div className="chat-transcript" aria-live="polite">{chatHistory.slice(-6).map((message, index) => <div className={`chat-line ${message.role === 'user' ? 'chat-line-user' : 'chat-line-assistant'}`} key={`${message.role}-${index}-${message.content}`}><span>{message.role === 'user' ? '你' : '小麦'}</span><p>{message.content}</p></div>)}{isChatting && <div className="chat-line chat-line-assistant"><span>小麦</span><p>正在想一想…</p></div>}</div>}{chatError && <div className="chat-error-box" role="alert"><p className="chat-error">{chatError}</p>{lastFailedPrompt && <button className="retry-button" onClick={() => void askAi(lastFailedPrompt)}><Icon name="arrow" size={12} />重试</button>}</div>}{replySpeech && <button className="reply-speech" onClick={() => speakText(replySpeech)}><Icon name={isSpeaking ? "pause" : "play"} size={13} /> {isSpeaking ? "停止播放" : "听小麦说"}</button>}<div className="coach-foot"><button className="clear-chat" onClick={clearLocalData}>清空对话和场景缓存</button><span>{chatHistory.length ? `自由对话 ${chatHistory.length} 条` : '粤语 · zh-HK'}</span></div></div>
            <div className="api-card"><div className="api-card-head"><div className="api-icon"><Icon name="spark" size={17} /></div><div><h3>AI 对话引擎</h3><p>{apiConfig.model || '尚未配置模型'}</p></div><span className={`status-dot ${canCallModel ? 'status-dot-ready' : ''}`} /></div><div className="api-meta"><span>{canCallModel ? '已填写配置，发送时连接' : '请先配置模型'}</span><button onClick={openSettings}>配置 <Icon name="arrow" size={13} /></button></div></div>

          </aside>
        </div>
      </main>

      {isSettingsOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeSettings() }}>
        <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
          <div className="settings-modal-head"><div><div className="section-kicker"><span className="kicker-dot" />开发者设置</div><h2 id="settings-title">连接你的 AI 老师</h2><p>对话会发送给所选模型服务；浏览器直连需要服务允许跨域访问。</p></div><button className="icon-button" onClick={closeSettings} aria-label="关闭"><Icon name="close" /></button></div>
          <div className="settings-form">
            <label>服务商<select value={draftConfig.provider} onChange={(event) => updateDraftConfig({ provider: event.target.value })}><option>OpenAI 兼容接口</option><option>DeepSeek</option><option>Moonshot</option><option>自定义服务</option></select></label>
            <label>Base URL<input value={draftConfig.baseUrl} onChange={(event) => updateDraftConfig({ baseUrl: event.target.value })} placeholder="https://api.example.com/v1" /></label>
            <div className="form-row"><label>模型名称<input value={draftConfig.model} onChange={(event) => updateDraftConfig({ model: event.target.value })} placeholder="gpt-4o-mini" /></label><label>API Key<input type="password" autoComplete="off" value={draftConfig.apiKey} onChange={(event) => updateDraftConfig({ apiKey: event.target.value })} placeholder="sk-..." /></label></div>
            <label className="remember-key-control"><input type="checkbox" checked={rememberApiKey} onChange={(event) => setRememberApiKey(event.target.checked)} /><span><strong>在这台设备保存 API Key</strong><small>{rememberApiKey ? '关闭页面后仍会保存，其他本机脚本也可能读取。' : '只在当前页面内使用，关闭页面后需要重新填写。'}</small></span></label>
            <label>系统提示词<textarea rows={3} value={draftConfig.systemPrompt} onChange={(event) => updateDraftConfig({ systemPrompt: event.target.value })} /></label>
            <div className="settings-service-note"><Icon name="lock" size={14} /><span>自定义服务可留空 API Key 以连接代理；其他服务请填写密钥。儿童对话和场景摘要会发送给所选服务。</span></div>
            <div className={`connection-result connection-result-${connectionState.status}`} role="status">
              <span>{connectionState.status === 'success' ? <Icon name="check" size={13} /> : <Icon name="spark" size={13} />}{connectionState.message || '保存前可先测试当前草稿配置。'}</span>
              <button className="secondary-button" onClick={() => void testConnection()} disabled={connectionState.status === 'testing'}>{connectionState.status === 'testing' ? '测试中…' : '测试连接'}</button>
            </div>
          </div>
          <div className="settings-modal-foot"><span><Icon name="lock" size={14} /> API Key 只会发送给配置的模型服务</span><div className="settings-actions"><button className="danger-text-button" onClick={clearApiConfig}>清除配置</button><button className="secondary-button" onClick={closeSettings}>取消</button><button className="primary-button" onClick={saveApiConfig}>保存配置 <Icon name="check" size={15} /></button></div></div>
        </section>
      </div>}
      {showToast && <div className="toast"><Icon name="check" size={16} /><span>{toastMessage}</span></div>}
    </div>
  )
}

export default App

const rootElement = document.getElementById('root')!
type CantoWindow = Window & { __cantoRoot?: ReturnType<typeof createRoot> }
const cantoWindow = window as CantoWindow
const root = cantoWindow.__cantoRoot ?? createRoot(rootElement)
cantoWindow.__cantoRoot = root
root.render(<App />)
