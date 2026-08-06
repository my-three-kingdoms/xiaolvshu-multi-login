import fs from 'node:fs/promises'
import path from 'node:path'

function expandEnvironment(value) {
  return value.replace(/%([^%]+)%/g, (_, name) => process.env[name] ?? `%${name}%`)
}

function positiveInteger(value, fieldName) {
  const number = Number(value)
  if (!Number.isInteger(number) || number < 1) {
    throw new Error(`${fieldName} must be a positive integer`)
  }
  return number
}

export async function loadSettings(configPath, overrides = {}) {
  let config = {}
  try {
    const raw = await fs.readFile(configPath, 'utf8')
    config = JSON.parse(raw.replace(/^\uFEFF/, ''))
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw new Error(`Cannot read config: ${error.message}`)
    }
  }

  const baseDirectory = path.dirname(configPath)
  const accountsFile = overrides.accountsFile ?? config.accountsFile
  if (!accountsFile) {
    throw new Error('accountsFile is required')
  }

  const profileRoot = overrides.profileRoot ?? config.profileRoot ?? path.join(
    process.env.LOCALAPPDATA ?? process.cwd(),
    'XiaolvshuMultiLogin',
    'profiles',
  )
  const siteUrl = overrides.siteUrl ?? config.siteUrl ?? 'https://xiaolvshu.app/login'
  const count = positiveInteger(overrides.count ?? config.count ?? 2, 'count')
  const start = Number(overrides.start ?? config.start ?? 0)
  if (!Number.isInteger(start) || start < 0) {
    throw new Error('start must be a non-negative integer')
  }

  return {
    accountsFile: path.resolve(baseDirectory, expandEnvironment(accountsFile)),
    count,
    start,
    siteUrl,
    profileRoot: path.resolve(baseDirectory, expandEnvironment(profileRoot)),
    chromePath: overrides.chromePath ?? config.chromePath ?? '',
  }
}
