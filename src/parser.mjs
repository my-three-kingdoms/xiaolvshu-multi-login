export function extractPhoneNumbers(markdown) {
  const matches = markdown.match(/(?<!\d)\d{11}(?!\d)/g) ?? []
  return [...new Set(matches)]
}

export function maskPhone(phone) {
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`
}
