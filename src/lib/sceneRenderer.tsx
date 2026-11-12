import type { SceneElement, SceneSpec } from './sceneSpec'

type SceneSpecRendererProps = {
  spec: SceneSpec
  className?: string
  idPrefix?: string
}

const gradientByTheme = {
  sky: ['#b9e9ff', '#edf9f3'],
  playground: ['#d9efff', '#edf7d9'],
  pond: ['#e1f5ef', '#c6e8c2'],
  playroom: ['#ffe7c4', '#ffcfaf'],
} as const

function ElementGraphic({ element }: { element: SceneElement }) {
  const color = element.color || '#8bbda1'
  switch (element.type) {
    case 'cloud':
      return <g fill={color}><rect x="-42" y="-10" width="84" height="20" rx="10" /><circle cx="-15" cy="-12" r="20" /><circle cx="15" cy="-17" r="25" /></g>
    case 'sun':
      return <g fill={color}><circle r="31" /><path d="M0-46v-12M0 46v12M-46 0h-12M46 0h12M-33-33l-9-9M33 33l9 9M33-33l9-9M-33 33l-9 9" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" /></g>
    case 'tree':
      return <g><path d="M-8 15h16l5 52h-26Z" fill="#aa7956" /><circle cx="0" cy="-5" r="35" fill={color} /><circle cx="-28" cy="8" r="24" fill={color} opacity=".92" /><circle cx="27" cy="9" r="27" fill={color} opacity=".96" /></g>
    case 'ball':
      return <g><circle r="25" fill="#fff" stroke={color} strokeWidth="7" /><path d="m-13-17 17 15-12 20M13-19 7 3l17 12M-23 2l17 2" fill="none" stroke={color} strokeWidth="5" /></g>
    case 'flower':
      return <g fill={color}><path d="m0-5 8-17 8 17 18 4-14 12 3 20-15-10-15 10 3-20-14-12Z" /><circle r="7" fill="#f4c866" /></g>
    case 'pond':
      return <g><ellipse rx="120" ry="42" fill={color} /><path d="M-85 0c35-12 58-10 92 3M20 10c30-9 52-7 82 2" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".55" /></g>
    case 'duck':
      return <g><ellipse cx="-4" cy="14" rx="29" ry="18" fill={color} /><circle cx="17" cy="-3" r="17" fill={color} /><circle cx="23" cy="-7" r="3" fill="#2f4a4a" /><path d="m33-2 15 7-15 7" fill="#ef9b52" /></g>
    case 'toy':
      return <g><rect x="-48" y="-58" width="96" height="116" rx="12" fill={color} /><path d="M-33-7h66M-33 34h66" stroke="#e1a391" strokeWidth="7" /><circle cx="-22" cy="-35" r="10" fill="#f5b43f" /><circle cx="19" cy="15" r="12" fill="#77bbc8" /></g>
    case 'hill':
      return <path d="M-180 80C-110-15 0-24 82 45c40 34 90 32 142 8v70h-404Z" fill={color} />
    case 'star':
      return <path d="m0-27 8 18 20 2-15 13 5 20-18-10-18 10 5-20-15-13 20-2Z" fill={color} />
    default:
      return null
  }
}

function Character({ spec }: { spec: SceneSpec }) {
  const poseOffset = spec.character.pose === 'jump' ? -12 : spec.character.pose === 'point' ? 4 : 0
  const bodyColor = spec.character.mood === 'excited' ? '#e87d68' : '#ee836e'
  return <g transform={`translate(380 ${286 + poseOffset})`}>
    <ellipse cx="0" cy="93" rx="70" ry="16" fill="#466666" opacity=".12" />
    <path d="M-28 3c-10 21-15 54-11 88h77C42 57 35 23 19 3Z" fill={bodyColor} />
    <path d="M-29 75c-4 22-4 35-1 45M30 75c5 23 5 35 1 45" fill="none" stroke="#3c5a5c" strokeWidth="12" strokeLinecap="round" />
    <circle cy="-46" r="59" fill="#ffd5b9" />
    <path d="M-56-50C-61-90-36-129 1-127c39 1 61 32 55 72-11-11-24-21-38-29-14 11-39 20-74 34Z" fill="#5b4b4e" />
    <ellipse cx="-22" cy="-47" rx="6" ry="8" fill="#374f54" /><ellipse cx="22" cy="-47" rx="6" ry="8" fill="#374f54" />
    <circle cx="-24" cy="-49" r="2" fill="#fff" /><circle cx="20" cy="-49" r="2" fill="#fff" />
    {spec.character.mouth === 'closed' && <path d="M-10-23c7 7 14 7 21 0" fill="none" stroke="#a85f5e" strokeWidth="4" strokeLinecap="round" />}
    {spec.character.mouth === 'a' && <ellipse cy="-21" rx="11" ry="9" fill="#783f49" stroke="#a85f5e" strokeWidth="3" />}
    {spec.character.mouth === 'i' && <ellipse cy="-21" rx="6" ry="10" fill="#783f49" stroke="#a85f5e" strokeWidth="3" />}
    {spec.character.mouth === 'u' && <ellipse cy="-21" rx="13" ry="6" fill="#783f49" stroke="#a85f5e" strokeWidth="3" />}
    <path d="M-62 33c-19 10-32 31-32 51M62 33c19 10 32 31 32 51" fill="none" stroke="#ffd5b9" strokeWidth="15" strokeLinecap="round" />
    {spec.character.pose === 'point' && <path d="M95 65h37" stroke="#ffd5b9" strokeWidth="14" strokeLinecap="round" />}
  </g>
}

export function SceneSpecRenderer({ spec, className, idPrefix = 'scene-spec' }: SceneSpecRendererProps) {
  const [top, bottom] = gradientByTheme[spec.theme]
  const sorted = [...spec.elements].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
  return <div className={className}>
    <svg viewBox="0 0 760 420" role="img" aria-label={spec.label} preserveAspectRatio="xMidYMid slice">
      <defs><linearGradient id={`${idPrefix}-background`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={top} /><stop offset="1" stopColor={bottom} /></linearGradient></defs>
      <rect width="760" height="420" fill={`url(#${idPrefix}-background)`} />
      <path d="M0 280c115-30 200-28 322 8 112 33 247 21 438-22v154H0Z" fill={spec.theme === 'playroom' ? '#f4b78f' : '#b9dc99'} />
      {sorted.map((element, index) => <g key={`${element.type}-${index}`} transform={`translate(${element.x} ${element.y}) scale(${element.scale})`} opacity={element.opacity ?? 1}><ElementGraphic element={element} /></g>)}
      <Character spec={spec} />
      <g transform="translate(528 116)"><path d="M0 22c0-25 30-36 55-29 20 5 24 26 14 39-10 13-34 19-53 14L0 57l5-18C2 34 0 28 0 22Z" fill="#fff" opacity=".93" /><text x="16" y="34" fill="#365b60" fontSize="18" fontWeight="700" fontFamily="Noto Sans SC, sans-serif">你好呀！</text></g>
    </svg>
  </div>
}
