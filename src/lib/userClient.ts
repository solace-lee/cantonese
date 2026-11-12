import type { LoginInput, UserProfile, UserProfilePatch, UserSession } from './types'

export type UserClientOptions = {
  baseUrl: string
  fetchImpl?: typeof fetch
  getAccessToken?: () => string | undefined
}

export class UserClientError extends Error {
  status?: number
  details?: unknown

  constructor(message: string, status?: number, details?: unknown) {
    super(message)
    this.name = 'UserClientError'
    this.status = status
    this.details = details
  }
}

export class UserClient {
  private readonly baseUrl: string
  private readonly fetchImpl: typeof fetch
  private readonly getAccessToken?: () => string | undefined

  constructor(options: UserClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '')
    this.fetchImpl = options.fetchImpl ?? fetch
    this.getAccessToken = options.getAccessToken
  }

  async login(input: LoginInput): Promise<UserSession> {
    return this.request<UserSession>('/api/auth/login', { method: 'POST', body: input })
  }

  async getMe(): Promise<UserProfile> {
    return this.request<UserProfile>('/api/me')
  }

  async updateProfile(patch: UserProfilePatch): Promise<UserProfile> {
    return this.request<UserProfile>('/api/me', { method: 'PATCH', body: patch })
  }

  async logout(): Promise<void> {
    await this.request('/api/auth/logout', { method: 'POST' })
  }

  private async request<T = unknown>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
    const headers: HeadersInit = { 'Content-Type': 'application/json' }
    const token = this.getAccessToken?.()
    if (token) headers.Authorization = `Bearer ${token}`
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: options.method ?? 'GET',
      credentials: 'include',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
    if (!response.ok) {
      let details: unknown
      try { details = await response.json() } catch { details = await response.text() }
      throw new UserClientError(`用户服务请求失败（${response.status}）`, response.status, details)
    }
    if (response.status === 204) return undefined as T
    return await response.json() as T
  }
}

export function createUserClient(options: UserClientOptions): UserClient {
  return new UserClient(options)
}

