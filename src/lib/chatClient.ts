import { getAgeProfile } from './ageProfiles'
import type { AgeGroup, ChatMessage, ChatRequest, ChatResult, ChatUsage, ModelConfig, StructuredChatTurn } from './types'

export type ChatClientOptions = {
  fetchImpl?: typeof fetch
}

export type StreamCallbacks = {
  onToken?: (token: string) => void
}

export type ChatClientErrorKind = 'config' | 'auth' | 'network' | 'timeout' | 'aborted' | 'rate-limit' | 'http' | 'invalid-response'

export class ChatClientError extends Error {
  status?: number
  details?: unknown
  kind: ChatClientErrorKind

  constructor(message: string, kind: ChatClientErrorKind, status?: number, details?: unknown) {
    super(message)
    this.name = 'ChatClientError'
    this.kind = kind
    this.status = status
    this.details = details
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
    || Boolean(error && typeof error === 'object' && 'name' in error && error.name === 'AbortError')
}

export function describeChatClientError(error: unknown, timedOut = false): string {
  if (timedOut) return '模型响应超时，请检查网络后重试。'
  if (isAbortError(error)) return '请求已取消。'
  if (!(error instanceof ChatClientError)) return '暂时无法连接模型，请稍后重试。'
  if (error.kind === 'aborted') return '请求已取消，可以重新发送。'
  if (error.kind === 'config') return '模型配置不完整，请检查 Base URL、模型名称和访问方式。'
  if (error.kind === 'auth') return '模型服务拒绝了访问，请检查 API Key 或代理设置。'
  if (error.kind === 'network') return '网络请求失败，请检查网络，并确认服务允许浏览器跨域访问（CORS）。'
  if (error.kind === 'timeout') return '模型响应超时，请检查网络后重试。'
  if (error.kind === 'rate-limit') return '请求过于频繁或额度不足，请稍后再试。'
  if (error.kind === 'invalid-response') return '模型返回的内容无法解析，请检查接口是否兼容 OpenAI Chat Completions。'
  if (error.status && error.status >= 500) return '模型服务暂时不可用，请稍后重试。'
  return '模型服务暂时没有完成请求，请检查配置后重试。'
}

function httpErrorKind(status: number): ChatClientErrorKind {
  if (status === 400 || status === 404 || status === 422) return 'config'
  if (status === 401 || status === 403) return 'auth'
  if (status === 408) return 'timeout'
  if (status === 429) return 'rate-limit'
  return 'http'
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
    if (typeof value.reply !== 'string') return { reply: '' }
    return {
      reply: value.reply,
      ttsText: typeof value.ttsText === 'string' ? value.ttsText : undefined,
      lessonHint: typeof value.lessonHint === 'string' ? value.lessonHint : undefined,
      sceneSpec: value.sceneSpec,
      sceneTheme: typeof value.sceneTheme === 'string' ? value.sceneTheme : undefined,
      sceneBrief: typeof value.sceneBrief === 'string' ? value.sceneBrief.slice(0, 160) : undefined,
      sceneTags: Array.isArray(value.sceneTags)
        ? value.sceneTags.filter((tag): tag is string => typeof tag === 'string').slice(0, 12).map((tag) => tag.slice(0, 24))
        : undefined,
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
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis)
  }

  updateConfig(config: Partial<ModelConfig>): void {
    this.config = { ...this.config, ...config }
  }

  getConfig(): ModelConfig {
    return { ...this.config }
  }

  async send(request: ChatRequest, callbacks: StreamCallbacks = {}): Promise<ChatResult> {
    if (!this.config.baseUrl.trim() || !this.config.model.trim()) {
      throw new ChatClientError('模型配置不完整', 'config')
    }
    let response: Response
    try {
      response = await this.fetchImpl(`${normaliseBaseUrl(this.config.baseUrl)}/chat/completions`, {
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
    } catch (error) {
      if (isAbortError(error)) throw new ChatClientError('模型请求已取消', 'aborted')
      throw new ChatClientError('无法连接模型服务', 'network')
    }

    if (!response.ok) {
      const details = await this.readError(response)
      const kind = httpErrorKind(response.status)
      throw new ChatClientError(`模型接口请求失败（${response.status}）`, kind, response.status, details)
    }

    if (request.stream) return this.readStream(response, callbacks.onToken)
    let data: Record<string, unknown>
    try {
      data = await response.json() as Record<string, unknown>
    } catch {
      throw new ChatClientError('模型返回内容无法解析', 'invalid-response', response.status)
    }
    return this.parseResult(data)
  }

  async testConnection(signal?: AbortSignal): Promise<void> {
    const result = await this.send({
      messages: [{ role: 'user', content: '这是一个连接测试。请只回复“好”。' }],
      ageGroup: '12-plus',
      systemPrompt: '这是接口连接测试。只回复“好”，不要解释或扩展。',
      signal,
    })
    if (!result.message.content.trim()) {
      throw new ChatClientError('模型返回了空内容', 'invalid-response')
    }
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
    if (!turn.reply.trim()) {
      throw new ChatClientError('模型返回了空内容', 'invalid-response')
    }
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

