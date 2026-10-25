const test = require('node:test');
const assert = require('node:assert');
const core = require('../core.js');

test('generateName is deterministic for a given seed', () => {
  const a = core.generateName({ rand: core.mulberry32(42), style: 'classic' });
  const b = core.generateName({ rand: core.mulberry32(42), style: 'classic' });
  assert.deepEqual(a, b);
});

test('generateName returns capitalized, letter-only names', () => {
  const rand = core.mulberry32(7);
  for (let i = 0; i < 25; i += 1) {
    const name = core.generateName({ rand, style: i % 2 ? 'classic' : 'fantasy' });
    assert.match(name.first, /^[A-Z][a-z]+$/);
    assert.match(name.last, /^[A-Z][a-z]+$/);
  }
});

test('generateName honors the starting-letter filter', () => {
  const rand = core.mulberry32(99);
  for (let i = 0; i < 12; i += 1) {
    const name = core.generateName({ rand, style: 'classic', letter: 'K' });
    assert.ok(name.first.toLowerCase().startsWith('k'), `${name.first} should start with K`);
    assert.ok(name.last.toLowerCase().startsWith('k'), `${name.last} should start with K`);
  }
});

test('generateName produces a varied spread over many rolls', () => {
  const rand = core.mulberry32(2026);
  const seen = new Set();
  for (let i = 0; i < 60; i += 1) {
    const name = core.generateName({ rand, style: 'classic' });
    seen.add(`${name.first} ${name.last}`);
  }
  assert.ok(seen.size >= 40, `expected variety, got ${seen.size} unique names`);
});

test('generateName falls back to Math.random without a rand function', () => {
  const name = core.generateName();
  assert.ok(typeof name.first === 'string' && name.first.length > 0);
  assert.ok(typeof name.last === 'string' && name.last.length > 0);
});
