import crypto from 'node:crypto'

export function extractPhoneNumbers(markdown) {
  const matches = markdown.match(/(?<!\d)\d{11}(?!\d)/g) ?? []
  return [...new Set(matches)]
}

export function sampleAccounts(accounts, count) {
  if (!Number.isInteger(count) || count < 1 || count > accounts.length) {
    throw new Error(`count must be between 1 and ${accounts.length}`)
  }
  const shuffled = [...accounts]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = crypto.randomInt(index + 1)
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }
  return shuffled.slice(0, count)
}

export function maskPhone(phone) {
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`
}
