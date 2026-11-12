import http from 'node:http'
import crypto from 'node:crypto'

const port = Number(process.env.PORT || 8787)
const origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173'
const users = new Map()
const sessions = new Map()

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  })
  res.end(JSON.stringify(payload))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}) } catch (error) { reject(error) }
    })
    req.on('error', reject)
  })
}

function sessionUser(req) {
  const cookie = req.headers.cookie || ''
  const token = cookie.split(';').map((item) => item.trim()).find((item) => item.startsWith('canto_session='))?.split('=')[1]
  const userId = token ? sessions.get(token) : undefined
  return userId ? users.get(userId) : undefined
}

function publicUser(user) {
  return { ...user }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return sendJson(res, 204, {})
  try {
    if (req.method === 'POST' && req.url === '/api/auth/login') {
      const body = await readBody(req)
      const identifier = String(body.identifier || '').trim()
      if (!identifier) return sendJson(res, 400, { error: 'identifier_required' })
      const id = crypto.createHash('sha256').update(identifier).digest('hex').slice(0, 16)
      const user = users.get(id) || { id, displayName: identifier, ageGroup: '6-12', locale: 'zh-HK', avatar: '乐', createdAt: new Date().toISOString() }
      user.updatedAt = new Date().toISOString()
      users.set(id, user)
      const token = crypto.randomBytes(24).toString('hex')
      sessions.set(token, id)
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Set-Cookie': `canto_session=${token}; HttpOnly; SameSite=Lax; Path=/`, 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true' })
      return res.end(JSON.stringify({ user: publicUser(user) }))
    }

    if (req.method === 'POST' && req.url === '/api/auth/logout') {
      const cookie = req.headers.cookie || ''
      const token = cookie.split(';').map((item) => item.trim()).find((item) => item.startsWith('canto_session='))?.split('=')[1]
      if (token) sessions.delete(token)
      res.writeHead(204, { 'Set-Cookie': 'canto_session=; Max-Age=0; HttpOnly; SameSite=Lax; Path=/', 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true' })
      return res.end()
    }

    if (req.url === '/api/me' && (req.method === 'GET' || req.method === 'PATCH')) {
      const user = sessionUser(req)
      if (!user) return sendJson(res, 401, { error: 'unauthorized' })
      if (req.method === 'PATCH') {
        const body = await readBody(req)
        if (typeof body.displayName === 'string' && body.displayName.trim()) user.displayName = body.displayName.trim()
        if (['3-6', '6-12', '12-plus'].includes(body.ageGroup)) user.ageGroup = body.ageGroup
        if (typeof body.locale === 'string') user.locale = body.locale
        if (typeof body.avatar === 'string') user.avatar = body.avatar
        user.updatedAt = new Date().toISOString()
      }
      return sendJson(res, 200, publicUser(user))
    }

    sendJson(res, 404, { error: 'not_found' })
  } catch (error) {
    sendJson(res, 400, { error: error instanceof Error ? error.message : 'bad_request' })
  }
})

server.listen(port, () => {
  console.log(`Canto芽 user service listening on http://localhost:${port}`)
})
