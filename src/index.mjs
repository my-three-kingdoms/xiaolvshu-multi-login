import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { chromium } from 'playwright-core'

import { loadSettings } from './config.mjs'
import { extractPhoneNumbers, maskPhone } from './parser.mjs'

const DEFAULT_CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  path.join(process.env.LOCALAPPDATA ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
]

function parseArguments(argv) {
  const result = { config: path.resolve('config.json'), dryRun: false }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--dry-run') {
      result.dryRun = true
      continue
    }
    if (argument === '--config' || argument === '--count' || argument === '--start') {
      const value = argv[index + 1]
      if (!value) {
        throw new Error(`${argument} requires a value`)
      }
      result[argument.slice(2)] = argument === '--config' ? path.resolve(value) : Number(value)
      index += 1
      continue
    }
    throw new Error(`Unknown argument: ${argument}`)
  }
  return result
}

async function findChrome(configuredPath) {
  const candidates = [configuredPath, ...DEFAULT_CHROME_PATHS].filter(Boolean)
  for (const candidate of candidates) {
    try {
      await fs.access(candidate)
      return candidate
    } catch {
      // Try the next standard installation path.
    }
  }
  throw new Error('Google Chrome was not found. Set chromePath in config.json.')
}

function profileDirectory(profileRoot, phone) {
  const key = crypto.createHash('sha256').update(phone).digest('hex').slice(0, 20)
  return path.join(profileRoot, `account-${key}`)
}

async function visible(locator) {
  try {
    return await locator.isVisible()
  } catch {
    return false
  }
}

async function navigateWithRetries(page, url) {
  let lastError
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    } catch (error) {
      lastError = error
      if (attempt < 3) {
        await page.waitForTimeout(attempt * 1500)
      }
    }
  }
  throw lastError
}

async function clickDialogAgreement(page) {
  const dialog = page.locator('[role="dialog"]:visible').first()
  try {
    await dialog.waitFor({ state: 'visible', timeout: 3000 })
  } catch {
    return false
  }
  const primaryButton = dialog.locator('.login-legal-action--primary:visible').first()
  if (await visible(primaryButton)) {
    await primaryButton.click()
    return true
  }
  const buttons = dialog.locator('button:visible')
  for (let index = 0; index < await buttons.count(); index += 1) {
    const button = buttons.nth(index)
    const label = (await button.innerText()).trim()
    if (/^(同意|接受|继续|确认)$/.test(label)) {
      await button.click()
      return true
    }
  }
  throw new Error('The legal notice dialog is visible but its agreement button was not found')
}

async function loginAccount(page, siteUrl, phone, smsCode) {
  await navigateWithRetries(page, siteUrl)
  await page.waitForTimeout(900)

  if (!new URL(page.url()).pathname.startsWith('/login')) {
    return { state: 'already-authenticated' }
  }

  const phoneInput = page.locator(
    'input[aria-label="手机号"], #login-phone-d, #login-phone-edit-d, input[type="tel"]',
  ).first()
  try {
    await phoneInput.waitFor({ state: 'visible', timeout: 20000 })
  } catch {
    if (!new URL(page.url()).pathname.startsWith('/login')) {
      return { state: 'already-authenticated' }
    }
    const title = await page.title()
    throw new Error(`The login form did not become ready (url=${page.url()}, title=${title})`)
  }
  if (!(await visible(phoneInput))) {
    if (!new URL(page.url()).pathname.startsWith('/login')) {
      return { state: 'already-authenticated' }
    }
    throw new Error('The login page loaded without a phone input')
  }
  if (!smsCode) {
    throw new Error('This profile is signed out and no SMS verification code was provided')
  }

  const form = page.locator('form').first()
  await phoneInput.fill(phone)
  await form.locator('button[type="submit"]:visible').click()
  await page.waitForTimeout(300)
  await clickDialogAgreement(page)

  const codeInput = page.locator(
    'input[aria-label="短信验证码"], #login-code-d, input[autocomplete="one-time-code"]',
  ).first()
  await codeInput.waitFor({ state: 'visible', timeout: 15000 })

  const requestButton = page.locator('button:visible').filter({ hasText: /获取验证码/ }).first()
  if (await visible(requestButton)) {
    await requestButton.click()
  }

  await codeInput.fill(smsCode)
  await form.locator('button[type="submit"]:visible').click()
  try {
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 })
  } catch {
    throw new Error('The page did not leave the login route after submitting the verification code')
  }
  return { state: 'logged-in' }
}

async function launchAccount({ phone, settings, chromePath, smsCode }) {
  const directory = profileDirectory(settings.profileRoot, phone)
  await fs.mkdir(directory, { recursive: true })
  const context = await chromium.launchPersistentContext(directory, {
    executablePath: chromePath,
    headless: false,
    viewport: null,
    args: ['--new-window'],
  })
  const page = context.pages()[0] ?? await context.newPage()
  try {
    const result = await loginAccount(page, settings.siteUrl, phone, smsCode)
    console.log(`${maskPhone(phone)}: ${result.state}`)
  } catch (error) {
    console.error(`${maskPhone(phone)}: login failed (${error.message})`)
  }
  return context
}

async function main() {
  const args = parseArguments(process.argv.slice(2))
  const settings = await loadSettings(args.config, {
    count: args.count,
    start: args.start,
  })
  const markdown = await fs.readFile(settings.accountsFile, 'utf8')
  const accounts = extractPhoneNumbers(markdown)
  const selectedAccounts = accounts.slice(settings.start, settings.start + settings.count)
  if (selectedAccounts.length === 0) {
    throw new Error('No 11-digit accounts were found in the selected range')
  }
  if (selectedAccounts.length < settings.count) {
    console.warn(`Only ${selectedAccounts.length} accounts are available in the selected range`)
  }

  if (args.dryRun) {
    console.log(`accounts=${accounts.length}, selected=${selectedAccounts.length}`)
    console.log(`profileRoot=${settings.profileRoot}`)
    return
  }

  const smsCode = process.env.XIAOLVSHU_SMS_CODE ?? ''
  const chromePath = await findChrome(settings.chromePath)
  await fs.mkdir(settings.profileRoot, { recursive: true })
  console.log(`Opening ${selectedAccounts.length} isolated Chrome windows on ${os.platform()}`)

  const launches = await Promise.allSettled(selectedAccounts.map((phone) => launchAccount({
    phone,
    settings,
    chromePath,
    smsCode,
  })))
  const contexts = []
  launches.forEach((launch, index) => {
    if (launch.status === 'fulfilled') {
      contexts.push(launch.value)
      return
    }
    console.error(`${maskPhone(selectedAccounts[index])}: window launch failed (${launch.reason.message})`)
  })
  if (contexts.length === 0) {
    throw new Error('No Chrome windows could be launched')
  }
  console.log('Windows remain open. Close them when finished; this console will then exit.')
  await Promise.all(contexts.map((context) => context.waitForEvent('close', { timeout: 0 })))
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
