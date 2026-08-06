import test from 'node:test'
import assert from 'node:assert/strict'

import { extractPhoneNumbers, maskPhone, sampleAccounts } from '../src/parser.mjs'

test('extracts unique 11-digit values in source order', () => {
  const source = '| A | B |\n| --- | --- |\n| 13800138000 | 13900139000 |\n| 13800138000 | text |'
  assert.deepEqual(extractPhoneNumbers(source), ['13800138000', '13900139000'])
})

test('does not extract a substring from a longer number', () => {
  assert.deepEqual(extractPhoneNumbers('1138001380000 13800138000'), ['13800138000'])
})

test('extracts phone numbers separated by spaces', () => {
  assert.deepEqual(extractPhoneNumbers('13800138000 13900139000 13700137000'), [
    '13800138000',
    '13900139000',
    '13700137000',
  ])
})

test('samples a unique subset from the account pool', () => {
  const pool = ['13800138000', '13900139000', '13700137000', '13600136000']
  const selected = sampleAccounts(pool, 2)
  assert.equal(selected.length, 2)
  assert.equal(new Set(selected).size, 2)
  assert.ok(selected.every((account) => pool.includes(account)))
})

test('masks phone numbers for logs', () => {
  assert.equal(maskPhone('13800138000'), '138****8000')
})
