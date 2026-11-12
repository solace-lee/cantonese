import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// Vite resolves the same TypeScript modules and extensionless imports as the app.
const vite = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom' })
after(() => vite.close())
const { normalizeSceneSpec, isValidGeneratedScene, DEFAULT_SCENE_SPECS, SCENE_LIMITS } = await vite.ssrLoadModule('/src/lib/sceneSpec.ts')
const { SceneSpecRenderer } = await vite.ssrLoadModule('/src/lib/sceneRenderer.tsx')
const { ChatClient, ChatClientError } = await vite.ssrLoadModule('/src/lib/chatClient.ts')

test('untrusted scene values are bounded and never become executable SVG', () => {
  const raw = {
    theme: 'javascript:alert(1)',
    label: '<script>alert(1)</script>',
    character: { pose: 'hijack', mood: 'evil', mouth: 'onclick' },
    elements: [
      { type: 'script', x: 0, y: 0 },
      ...Array.from({ length: 30 }, () => ({
        type: 'cloud', x: -999, y: 9999, scale: 999,
        color: 'url(https://evil.example/)', opacity: -2, zIndex: 999,
        animation: 'onclick', onload: 'alert(1)',
      })),
    ],
  }
  const scene = normalizeSceneSpec(raw, DEFAULT_SCENE_SPECS.pond)
  assert.equal(scene.theme, 'pond')
  assert.equal(scene.character.pose, DEFAULT_SCENE_SPECS.pond.character.pose)
  assert.equal(scene.elements.length, SCENE_LIMITS.maxElements - 1)
  assert.ok(scene.elements.every((element) => element.type === 'cloud' && element.x === 0 && element.y === 420 && element.scale === 2.5 && element.color === '#8bbda1' && element.opacity === 0.15 && element.zIndex === 5 && element.animation === 'none'))
  const html = renderToStaticMarkup(React.createElement(SceneSpecRenderer, { spec: scene }))
  assert.doesNotMatch(html, /<script|<foreignObject|onload=|https:\/\/evil\.example/i)
})

test('empty and unknown scene elements fall back to the supplied safe template', () => {
  const fallback = DEFAULT_SCENE_SPECS.playroom
  for (const input of [null, {}, { elements: [{ type: 'image', href: 'https://evil.example' }] }]) {
    const scene = normalizeSceneSpec(input, fallback)
    assert.equal(scene.theme, 'playroom')
    assert.deepEqual(scene.elements, fallback.elements)
  }
})

test('generated scenes require a matching theme and at least one allowed element', () => {
  assert.equal(isValidGeneratedScene({ theme: 'pond', elements: [] }, 'pond'), false)
  assert.equal(isValidGeneratedScene({ theme: 'pond', elements: [{ type: 'script' }] }, 'pond'), false)
  assert.equal(isValidGeneratedScene({ theme: 'sky', elements: [{ type: 'cloud' }] }, 'pond'), false)
  assert.equal(isValidGeneratedScene({ theme: 'pond', elements: [{ type: 'duck' }] }, 'pond'), true)
})

test('chat sends multi-turn context with the selected age prompt and parses structured output', async () => {
  let sent
  const client = new ChatClient({ provider: 'custom', baseUrl: 'https://model.example/v1/', model: 'test-model', apiKey: 'test-key', systemPrompt: '基础提示' }, {
    fetchImpl: async (url, options) => {
      sent = { url, headers: options.headers, body: JSON.parse(options.body) }
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ reply: '一齐踢波！', ttsText: '一齐踢波', lessonHint: '试着说踢波', sceneTheme: 'playground', sceneSpec: { theme: 'playground', elements: [] } }) } }] }), { status: 200 })
    },
  })
  const history = [
    { role: 'user', content: '我想玩球' },
    { role: 'assistant', content: '好呀！' },
    { role: 'user', content: '去哪里？' },
  ]
  const result = await client.send({ messages: history, ageGroup: '3-6', responseFormat: 'json_object' })
  assert.equal(sent.url, 'https://model.example/v1/chat/completions')
  assert.equal(sent.headers.Authorization, 'Bearer test-key')
  assert.equal(sent.body.messages[0].role, 'system')
  assert.match(sent.body.messages[0].content, /基础提示/)
  assert.match(sent.body.messages[0].content, /3–6 岁/)
  assert.deepEqual(sent.body.messages.slice(1), history)
  assert.deepEqual(sent.body.response_format, { type: 'json_object' })
  assert.equal(result.message.content, '一齐踢波！')
  assert.equal(result.turn.ttsText, '一齐踢波')
  assert.equal(result.turn.lessonHint, '试着说踢波')
  assert.equal(result.turn.sceneSpec.theme, 'playground')
  assert.equal(result.turn.sceneTheme, 'playground')
})

test('plain text replies and model failures remain distinguishable', async () => {
  const config = { provider: 'proxy', baseUrl: '/v1', model: 'test' }
  const client = new ChatClient(config, { fetchImpl: async () => new Response(JSON.stringify({ choices: [{ message: { content: '早晨！' } }] })) })
  const result = await client.send({ messages: [{ role: 'user', content: '你好' }], ageGroup: '6-12' })
  assert.equal(result.turn.reply, '早晨！')
  assert.equal(result.turn.sceneSpec, undefined)
  const failing = new ChatClient(config, { fetchImpl: async () => new Response('{"error":"invalid key"}', { status: 401 }) })
  await assert.rejects(() => failing.send({ messages: [], ageGroup: '6-12' }), (error) => error instanceof ChatClientError && error.status === 401 && error.details.error === 'invalid key')
})
