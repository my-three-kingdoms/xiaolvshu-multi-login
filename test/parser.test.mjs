import test from 'node:test'
import assert from 'node:assert/strict'

import { extractPhoneNumbers, maskPhone } from '../src/parser.mjs'

test('extracts unique 11-digit values in source order', () => {
  const source = '| A | B |\n| --- | --- |\n| 13800138000 | 13900139000 |\n| 13800138000 | text |'
  assert.deepEqual(extractPhoneNumbers(source), ['13800138000', '13900139000'])
})

test('does not extract a substring from a longer number', () => {
  assert.deepEqual(extractPhoneNumbers('1138001380000 13800138000'), ['13800138000'])
})

test('masks phone numbers for logs', () => {
  assert.equal(maskPhone('13800138000'), '138****8000')
})
