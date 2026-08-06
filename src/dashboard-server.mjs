import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'

import { loadSettings } from './config.mjs'
import { extractPhoneNumbers, maskPhone } from './parser.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const htmlPath = path.join(root, 'dashboard', 'index.html')
const activeContexts = new Map()
const chromePaths = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  path.join(process.env.LOCALAPPDATA ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
]

function json(response, status, value) {
  const body = JSON.stringify(value)
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  response.end(body)
}

function profileDirectory(profileRoot, phone) {
  const key = crypto.createHash('sha256').update(phone).digest('hex').slice(0, 20)
  return path.join(profileRoot, `account-${key}`)
}

async function findChrome(configuredPath) {
  for (const candidate of [configuredPath, ...chromePaths].filter(Boolean)) {
    try {
      await fs.access(candidate)
      return candidate
    } catch {
      // Try the next standard installation path.
    }
  }
  throw new Error('Google Chrome was not found. Set chromePath in config.json.')
}

async function createContext(settings, phone) {
  const directory = profileDirectory(settings.profileRoot, phone)
  await fs.mkdir(directory, { recursive: true })
  const context = await chromium.launchPersistentContext(directory, {
    executablePath: await findChrome(settings.chromePath),
    headless: false,
    viewport: null,
    args: ['--new-window'],
  })
  activeContexts.set(phone, context)
  context.on('close', () => activeContexts.delete(phone))
  return context
}

async function readAccounts(settings) {
  const content = await fs.readFile(settings.accountsFile, 'utf8')
  return extractPhoneNumbers(content)
}

async function fetchPosts(settings, phone) {
  let context = activeContexts.get(phone)
  if (!context) context = await createContext(settings, phone)
  const page = context.pages()[0] ?? await context.newPage()
  await page.goto(settings.siteUrl.replace(/\/login\/?$/, '/'), { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(1200)
  return page.evaluate(() => {
    const selectors = ['article', '[data-testid*="post"]', '[class*="post-card"]', '[class*="note-card"]', 'main a[href*="/explore/"]']
    const nodes = selectors.flatMap((selector) => [...document.querySelectorAll(selector)])
    const seen = new Set()
    return nodes.map((node, index) => {
      const link = node.matches('a[href]') ? node : node.querySelector('a[href]')
      const href = link?.href ?? ''
      const text = (node.innerText || link?.innerText || '').replace(/\s+/g, ' ').trim()
      if (!href || !text || seen.has(href)) return null
      seen.add(href)
      return { id: `${index}-${href}`, title: text.slice(0, 100), url: href }
    }).filter(Boolean).slice(0, 50)
  })
}

async function main() {
  const settings = await loadSettings(path.join(root, 'config.json'))
  const port = Number(process.env.XIAOLVSHU_DASHBOARD_PORT || 8790)
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`)
      if (request.method === 'GET' && url.pathname === '/') {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
        return response.end(await fs.readFile(htmlPath))
      }
      if (request.method === 'GET' && url.pathname === '/api/accounts') {
        const accounts = await readAccounts(settings)
        return json(response, 200, { accounts: accounts.map((phone) => ({ phone, label: maskPhone(phone) })) })
      }
      if (request.method === 'GET' && url.pathname === '/api/posts') {
        const phone = url.searchParams.get('phone')
        if (!phone) return json(response, 400, { error: 'phone is required' })
        return json(response, 200, { posts: await fetchPosts(settings, phone) })
      }
      if (request.method === 'POST' && url.pathname === '/api/open') {
        let body = ''
        for await (const chunk of request) body += chunk
        const payload = JSON.parse(body || '{}')
        if (!payload.phone || !payload.url) return json(response, 400, { error: 'phone and url are required' })
        let context = activeContexts.get(payload.phone)
        if (!context) context = await createContext(settings, payload.phone)
        const page = context.pages()[0] ?? await context.newPage()
        await page.goto(payload.url, { waitUntil: 'domcontentloaded', timeout: 30000 })
        return json(response, 200, { ok: true })
      }
      return json(response, 404, { error: 'Not found' })
    } catch (error) {
      return json(response, 500, { error: error.message })
    }
  })
  server.listen(port, '127.0.0.1', () => console.log(`Dashboard: http://127.0.0.1:${port}`))
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
