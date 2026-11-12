import { getAgeProfile } from './ageProfiles'
import type { AgeGroup, ChatMessage, ChatRequest, ChatResult, ChatUsage, ModelConfig, StructuredChatTurn } from './types'

export type ChatClientOptions = {
  fetchImpl?: typeof fetch
}

export type StreamCallbacks = {
  onToken?: (token: string) => void
}

export class ChatClientError extends Error {
  status?: number
  details?: unknown

  constructor(message: string, status?: number, details?: unknown) {
    super(message)
    this.name = 'ChatClientError'
    this.status = status
    this.details = details
  }
}

function normaliseBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/$/, '')
}

function mapUsage(usage: Record<string, unknown> | undefined): ChatUsage | undefined {
  if (!usage) return undefined
  const promptTokens = typeof usage.prompt_tokens === 'number' ? usage.prompt_tokens : undefined
  const completionTokens = typeof usage.completion_tokens === 'number' ? usage.completion_tokens : undefined
  const totalTokens = typeof usage.total_tokens === 'number' ? usage.total_tokens : undefined
  if (promptTokens === undefined && completionTokens === undefined && totalTokens === undefined) return undefined
  return { promptTokens, completionTokens, totalTokens }
}

function composeSystemPrompt(config: ModelConfig, ageGroup: AgeGroup, extraPrompt?: string): string {
  const agePrompt = getAgeProfile(ageGroup).systemPrompt
  return [config.systemPrompt, agePrompt, extraPrompt].filter(Boolean).join('\n\n')
}

function toPayloadMessages(config: ModelConfig, request: ChatRequest): ChatMessage[] {
  const systemPrompt = composeSystemPrompt(config, request.ageGroup, request.systemPrompt)
  const history = request.messages.filter((message) => message.role !== 'system' && message.content.trim())
  return [{ role: 'system', content: systemPrompt }, ...history]
}

function extractTextContent(value: unknown): string {
  if (typeof value === 'string') return value
  if (!Array.isArray(value)) return ''
  return value.map((part) => {
    if (typeof part === 'string') return part
    if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') return part.text
    return ''
  }).join('')
}

function parseStructuredTurn(content: unknown): StructuredChatTurn {
  if (content && typeof content === 'object' && !Array.isArray(content)) {
    const value = content as Record<string, unknown>
    if (typeof value.reply !== 'string') return { reply: JSON.stringify(value) }
    return {
      reply: value.reply,
      ttsText: typeof value.ttsText === 'string' ? value.ttsText : undefined,
      lessonHint: typeof value.lessonHint === 'string' ? value.lessonHint : undefined,
      sceneSpec: value.sceneSpec,
      sceneTheme: typeof value.sceneTheme === 'string' ? value.sceneTheme : undefined,
    }
  }

  const text = extractTextContent(content).trim()
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1]
  const candidate = fenced ?? text
  if (candidate.startsWith('{') && candidate.endsWith('}')) {
    try {
      return parseStructuredTurn(JSON.parse(candidate))
    } catch {
      // Fall back to the plain text turn when a provider returned malformed JSON.
    }
  }
  return { reply: text }
}

export class ChatClient {
  private config: ModelConfig
  private readonly fetchImpl: typeof fetch

  constructor(config: ModelConfig, options: ChatClientOptions = {}) {
    this.config = { ...config }
    this.fetchImpl = options.fetchImpl ?? fetch
  }

  updateConfig(config: Partial<ModelConfig>): void {
    this.config = { ...this.config, ...config }
  }

  getConfig(): ModelConfig {
    return { ...this.config }
  }

  async send(request: ChatRequest, callbacks: StreamCallbacks = {}): Promise<ChatResult> {
    const response = await this.fetchImpl(`${normaliseBaseUrl(this.config.baseUrl)}/chat/completions`, {
      method: 'POST',
      signal: request.signal,
      headers: this.headers(),
      body: JSON.stringify({
        model: this.config.model,
        temperature: this.config.temperature ?? 0.7,
        max_tokens: this.config.maxTokens,
        stream: Boolean(request.stream),
        ...(request.responseFormat === 'json_object' ? { response_format: { type: 'json_object' } } : {}),
        messages: toPayloadMessages(this.config, request),
      }),
    })

    if (!response.ok) {
      const details = await this.readError(response)
      throw new ChatClientError(`模型接口请求失败（${response.status}）`, response.status, details)
    }

    if (request.stream) return this.readStream(response, callbacks.onToken)
    const data = await response.json() as Record<string, unknown>
    return this.parseResult(data)
  }

  async sendText(text: string, history: ChatMessage[] = [], ageGroup: AgeGroup = '6-12', callbacks: StreamCallbacks = {}): Promise<ChatResult> {
    return this.send({ messages: [...history, { role: 'user', content: text }], ageGroup, stream: Boolean(callbacks.onToken) }, callbacks)
  }

  private headers(): HeadersInit {
    const headers: HeadersInit = { 'Content-Type': 'application/json' }
    if (this.config.apiKey) headers.Authorization = `Bearer ${this.config.apiKey}`
    return headers
  }

  private async readError(response: Response): Promise<unknown> {
    const body = await response.text()
    try { return JSON.parse(body) } catch { return body }
  }

  private parseResult(data: Record<string, unknown>): ChatResult {
    const choices = Array.isArray(data.choices) ? data.choices as Array<Record<string, unknown>> : []
    const first = choices[0] ?? {}
    const message = (first.message ?? {}) as Record<string, unknown>
    const turn = parseStructuredTurn(message.content)
    return {
      message: { role: 'assistant', content: turn.reply },
      turn,
      usage: mapUsage(data.usage as Record<string, unknown> | undefined),
      raw: data,
    }
  }

  private async readStream(response: Response, onToken?: (token: string) => void): Promise<ChatResult> {
    if (!response.body) return { message: { role: 'assistant', content: '' } }
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let content = ''
    let done = false
    while (!done) {
      const chunk = await reader.read()
      done = chunk.done
      buffer += decoder.decode(chunk.value ?? new Uint8Array(), { stream: !done })
      const lines = buffer.split(/\r?\n/)
      buffer = done ? '' : (lines.pop() ?? '')
      for (const line of lines) {
        if (!line.startsWith('data:')) continue
        const payload = line.slice(5).trim()
        if (!payload || payload === '[DONE]') continue
        try {
          const data = JSON.parse(payload) as Record<string, unknown>
          const choices = Array.isArray(data.choices) ? data.choices as Array<Record<string, unknown>> : []
          const delta = (choices[0]?.delta ?? {}) as Record<string, unknown>
          const token = typeof delta.content === 'string' ? delta.content : ''
          if (token) { content += token; onToken?.(token) }
        } catch {
          // Ignore malformed keep-alive chunks while preserving the stream.
        }
      }
    }
    const turn = parseStructuredTurn(content)
    return { message: { role: 'assistant', content: turn.reply }, turn }
  }
}

export function createChatClient(config: ModelConfig, options?: ChatClientOptions): ChatClient {
  return new ChatClient(config, options)
}

