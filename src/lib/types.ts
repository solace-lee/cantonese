export type AgeGroup = '3-6' | '6-12' | '12-plus'

export type ChatRole = 'system' | 'user' | 'assistant'

export type ChatMessage = {
  role: ChatRole
  content: string
  id?: string
  createdAt?: string
}

export type ModelConfig = {
  provider: string
  baseUrl: string
  model: string
  apiKey?: string
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
}

export type ChatRequest = {
  messages: ChatMessage[]
  ageGroup: AgeGroup
  signal?: AbortSignal
  stream?: boolean
  systemPrompt?: string
  responseFormat?: 'text' | 'json_object'
}

export type ChatUsage = {
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
}

export type StructuredChatTurn = {
  reply: string
  ttsText?: string
  lessonHint?: string
  sceneSpec?: unknown
  sceneTheme?: string
}

export type ChatResult = {
  message: ChatMessage
  turn?: StructuredChatTurn
  usage?: ChatUsage
  raw?: unknown
}

export type UserProfile = {
  id: string
  displayName: string
  ageGroup: AgeGroup
  locale?: string
  avatar?: string
  createdAt?: string
  updatedAt?: string
}

export type UserSession = {
  user: UserProfile
  expiresAt?: string
  accessToken?: string
}

export type UserProfilePatch = Partial<Pick<UserProfile, 'displayName' | 'ageGroup' | 'locale' | 'avatar'>>

export type LoginInput = {
  identifier: string
  password?: string
  provider?: string
}

