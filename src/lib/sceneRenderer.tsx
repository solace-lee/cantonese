import type { SceneElement, ScenePalette, SceneSpec } from './sceneSpec'

type SceneSpecRendererProps = {
  spec: SceneSpec
  className?: string
  idPrefix?: string
}

const gradientByTheme: Record<SceneSpec['theme'], readonly [string, string]> = {
  sky: ['#b9e9ff', '#edf9f3'],
  playground: ['#d9efff', '#edf7d9'],
  pond: ['#e1f5ef', '#c6e8c2'],
  playroom: ['#ffe7c4', '#ffcfaf'],
}

const gradientByPalette: Partial<Record<ScenePalette, readonly [string, string]>> = {
  sunny: ['#bfeaff', '#fff0c8'],
  day: ['#b8e4ff', '#eef9f0'],
  field: ['#d8efff', '#dceebd'],
  water: ['#d8f1ef', '#a9d9d5'],
  warm: ['#ffe5c2', '#ffc8a9'],
  dusk: ['#b7c9ec', '#f6c7b2'],
}

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
    case 'bird':
      return <g><path d="M-29 4c16-25 34-25 51 0-18 17-34 17-51 0Z" fill={color} /><circle cx="12" cy="-2" r="3" fill="#2f4a4a" /><path d="m22 2 13 5-13 5" fill="#ef9b52" /></g>
    case 'fish':
      return <g><ellipse rx="30" ry="17" fill={color} /><path d="M26 0 49-17v34Z" fill={color} opacity=".75" /><circle cx="-15" cy="-4" r="3" fill="#fff" /></g>
    case 'frog':
      return <g><ellipse cy="9" rx="31" ry="22" fill={color} /><circle cx="-18" cy="-14" r="10" fill={color} /><circle cx="18" cy="-14" r="10" fill={color} /><circle cx="-18" cy="-16" r="3" fill="#243c38" /><circle cx="18" cy="-16" r="3" fill="#243c38" /><path d="M-12 15c8 7 16 7 24 0" fill="none" stroke="#355f52" strokeWidth="3" strokeLinecap="round" /></g>
    case 'cat':
      return <g><circle cy="2" r="28" fill={color} /><path d="m-25-16 4-24 20 14M25-16l-4-24-20 14" fill={color} /><circle cx="-10" cy="-2" r="3" fill="#374f54" /><circle cx="10" cy="-2" r="3" fill="#374f54" /><path d="m-5 9 5 4 5-4M0 13v6" fill="none" stroke="#755f50" strokeWidth="2.5" strokeLinecap="round" /></g>
    case 'dog':
      return <g><circle cy="2" r="28" fill={color} /><ellipse cx="-27" cy="2" rx="10" ry="24" fill="#bd875d" transform="rotate(20 -27 2)" /><ellipse cx="27" cy="2" rx="10" ry="24" fill="#bd875d" transform="rotate(-20 27 2)" /><circle cx="-9" cy="-3" r="3" fill="#374f54" /><circle cx="9" cy="-3" r="3" fill="#374f54" /><ellipse cy="10" rx="8" ry="6" fill="#4d3f39" /></g>
    case 'rabbit':
      return <g><circle cy="12" r="25" fill={color} /><ellipse cx="-13" cy="-24" rx="9" ry="30" fill={color} /><ellipse cx="13" cy="-24" rx="9" ry="30" fill={color} /><circle cx="-8" cy="7" r="3" fill="#374f54" /><circle cx="8" cy="7" r="3" fill="#374f54" /><circle cy="16" r="4" fill="#e68f94" /></g>
    case 'blocks':
      return <g fill={color}><rect x="-40" y="-2" width="38" height="38" rx="5" /><rect x="-1" y="-34" width="38" height="70" rx="5" /><rect x="37" y="4" width="31" height="32" rx="5" /></g>
    case 'car':
      return <g><path d="M-50 10h100v25h-100ZM-30 10l15-30h34l18 30Z" fill={color} /><circle cx="-27" cy="37" r="12" fill="#374f54" /><circle cx="29" cy="37" r="12" fill="#374f54" /><path d="M-9-14h25l9 18h-42Z" fill="#dff4ff" /></g>
    case 'kite':
      return <g><path d="M0-48 37-9 0 43-37-9Z" fill={color} /><path d="M0-48v91M-37-9h74" stroke="#fff" strokeWidth="4" opacity=".7" /><path d="M0 43c-17 22 17 21 0 44" fill="none" stroke="#e5a55a" strokeWidth="3" /></g>
    case 'teddy':
      return <g><circle cx="-22" cy="-23" r="14" fill={color} /><circle cx="22" cy="-23" r="14" fill={color} /><circle cy="-4" r="31" fill={color} /><ellipse cy="29" rx="27" ry="35" fill={color} /><circle cx="-10" cy="-8" r="3" fill="#4c3e39" /><circle cx="10" cy="-8" r="3" fill="#4c3e39" /><ellipse cy="4" rx="8" ry="6" fill="#e7bd8f" /></g>
    case 'bench':
      return <g><rect x="-46" y="-8" width="92" height="16" rx="4" fill={color} /><rect x="-44" y="15" width="88" height="13" rx="4" fill={color} /><path d="M-32 28v27M32 28v27" stroke="#72594a" strokeWidth="8" strokeLinecap="round" /></g>
    case 'goal':
      return <g fill="none" stroke={color} strokeWidth="7"><path d="M-58 25V-38H58V25M-31-38v63M0-38v63M31-38v63M-58-12h116M-58 8h116" /></g>
    case 'rainbow':
      return <g fill="none" strokeWidth="13" strokeLinecap="round"><path d="M-70 30a70 70 0 0 1 140 0" stroke="#f17a75" /><path d="M-52 30a52 52 0 0 1 104 0" stroke="#f3be5d" /><path d="M-34 30a34 34 0 0 1 68 0" stroke={color} /></g>
    case 'bush':
      return <g fill={color}><circle cx="-24" cy="8" r="24" /><circle cy="-4" r="31" /><circle cx="27" cy="9" r="23" /><rect x="-45" y="8" width="91" height="25" rx="12" /></g>
    default:
      return null
  }
}

function SceneElementGraphic({ element }: { element: SceneElement }) {
  const animationClass = element.animation === 'float'
    ? 'scene-element-float'
    : element.animation === 'pulse'
      ? 'scene-element-pulse'
      : ''
  return <g transform={`translate(${element.x} ${element.y}) scale(${element.scale})`} opacity={element.opacity ?? 1}>
    <g className={animationClass}><ElementGraphic element={element} /></g>
  </g>
}

function Character({ spec }: { spec: SceneSpec }) {
  const poseOffset = spec.character.pose === 'jump' ? -12 : spec.character.pose === 'point' ? 4 : 0
  const bodyColor = spec.character.mood === 'excited'
    ? '#e87d68'
    : spec.character.mood === 'calm'
      ? '#6fa99a'
      : '#ee836e'
  const arms = spec.character.pose === 'wave'
    ? <>
        <path d="M-62 33c-19 10-32 31-32 51" fill="none" stroke="#ffd5b9" strokeWidth="15" strokeLinecap="round" />
        <path d="M62 33c27-7 43-35 43-61" fill="none" stroke="#ffd5b9" strokeWidth="15" strokeLinecap="round" />
      </>
    : spec.character.pose === 'jump'
      ? <>
          <path d="M-62 33c-27-5-43-29-47-55M62 33c27-5 43-29 47-55" fill="none" stroke="#ffd5b9" strokeWidth="15" strokeLinecap="round" />
        </>
      : <>
          <path d="M-62 33c-19 10-32 31-32 51M62 33c19 10 32 31 32 51" fill="none" stroke="#ffd5b9" strokeWidth="15" strokeLinecap="round" />
          {spec.character.pose === 'point' && <path d="M94 68h40" stroke="#ffd5b9" strokeWidth="14" strokeLinecap="round" />}
        </>
  return <g transform={`translate(380 ${286 + poseOffset})`}>
    <ellipse cx="0" cy="93" rx="70" ry="16" fill="#466666" opacity=".12" />
    <path d="M-28 3c-10 21-15 54-11 88h77C42 57 35 23 19 3Z" fill={bodyColor} />
    <path d="M-29 75c-4 22-4 35-1 45M30 75c5 23 5 35 1 45" fill="none" stroke="#3c5a5c" strokeWidth="12" strokeLinecap="round" />
    <circle cy="-46" r="59" fill="#ffd5b9" />
    <path d="M-56-50C-61-90-36-129 1-127c39 1 61 32 55 72-11-11-24-21-38-29-14 11-39 20-74 34Z" fill="#5b4b4e" />
    {spec.character.mood === 'curious' && <path d="M-34-66c7-5 14-5 21 0M15-66c7-5 14-5 21 0" fill="none" stroke="#72585a" strokeWidth="3" strokeLinecap="round" />}
    {spec.character.mood === 'excited' && <><circle cx="-39" cy="-21" r="7" fill="#f19b9b" opacity=".35" /><circle cx="39" cy="-21" r="7" fill="#f19b9b" opacity=".35" /></>}
    <ellipse cx="-22" cy="-47" rx="6" ry="8" fill="#374f54" /><ellipse cx="22" cy="-47" rx="6" ry="8" fill="#374f54" />
    <circle cx="-24" cy="-49" r="2" fill="#fff" /><circle cx="20" cy="-49" r="2" fill="#fff" />
    {spec.character.mouth === 'closed' && <path d="M-10-23c7 7 14 7 21 0" fill="none" stroke="#a85f5e" strokeWidth="4" strokeLinecap="round" />}
    {spec.character.mouth === 'a' && <ellipse cy="-21" rx="11" ry="9" fill="#783f49" stroke="#a85f5e" strokeWidth="3" />}
    {spec.character.mouth === 'i' && <ellipse cy="-21" rx="6" ry="10" fill="#783f49" stroke="#a85f5e" strokeWidth="3" />}
    {spec.character.mouth === 'u' && <ellipse cy="-21" rx="13" ry="6" fill="#783f49" stroke="#a85f5e" strokeWidth="3" />}
    {arms}
  </g>
}

export function SceneSpecRenderer({ spec, className, idPrefix = 'scene-spec' }: SceneSpecRendererProps) {
  const [top, bottom] = gradientByPalette[spec.palette] ?? gradientByTheme[spec.theme]
  const sorted = [...spec.elements].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
  const back = sorted.filter((element) => (element.zIndex ?? 0) <= 2)
  const front = sorted.filter((element) => (element.zIndex ?? 0) > 2)
  return <div className={className}>
    <svg viewBox="0 0 760 420" role="img" aria-label={spec.label} preserveAspectRatio="xMidYMid slice">
      <defs><linearGradient id={`${idPrefix}-background`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={top} /><stop offset="1" stopColor={bottom} /></linearGradient></defs>
      <rect width="760" height="420" fill={`url(#${idPrefix}-background)`} />
      <path d="M0 280c115-30 200-28 322 8 112 33 247 21 438-22v154H0Z" fill={spec.theme === 'playroom' ? '#f4b78f' : '#b9dc99'} />
      {back.map((element, index) => <SceneElementGraphic key={`${element.type}-back-${index}`} element={element} />)}
      <Character spec={spec} />
      {front.map((element, index) => <SceneElementGraphic key={`${element.type}-front-${index}`} element={element} />)}
      <g transform="translate(528 116)"><path d="M0 22c0-25 30-36 55-29 20 5 24 26 14 39-10 13-34 19-53 14L0 57l5-18C2 34 0 28 0 22Z" fill="#fff" opacity=".93" /><text x="16" y="34" fill="#365b60" fontSize="18" fontWeight="700" fontFamily="Noto Sans SC, sans-serif">你好呀！</text></g>
    </svg>
  </div>
}
