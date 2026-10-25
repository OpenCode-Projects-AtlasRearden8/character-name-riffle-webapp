const test = require('node:test');
const assert = require('node:assert');
const core = require('../core.js');

function types(warnings) {
  return warnings.map((w) => w.type);
}

test('normalize lowercases, strips diacritics, and collapses punctuation', () => {
  assert.equal(core.normalize('  Kévin  '), 'kevin');
  assert.equal(core.normalize('Jean-Luc'), 'jean luc');
  assert.equal(core.normalize('   '), '');
  assert.equal(core.normalize('O’Neil'), 'o neil');
});

test('levenshtein computes classic edit distances', () => {
  assert.equal(core.levenshtein('kitten', 'sitting'), 3);
  assert.equal(core.levenshtein('flaw', 'lawn'), 2);
  assert.equal(core.levenshtein('same', 'same'), 0);
});

test('spellingSimilarity grades near-misses and far-misses', () => {
  assert.equal(core.spellingSimilarity('Jon', 'John'), 1);
  assert.equal(core.spellingSimilarity('Marie', 'Maria'), 1);
  assert.equal(core.spellingSimilarity('Anna', 'Hanna'), 1);
  assert.equal(core.spellingSimilarity('Iris', 'Ivy'), 0);
  assert.equal(core.spellingSimilarity('Bella', 'Cassandra'), 0);
  assert.equal(core.spellingSimilarity('Jon', 'jón '), 2);
});

test('soundex handles classic reference words', () => {
  assert.equal(core.soundex('Robert'), 'R163');
  assert.equal(core.soundex('Rupert'), 'R163');
  assert.equal(core.soundex('Tymczak'), 'T522');
  assert.equal(core.soundex('Ashcraft'), 'A261');
  assert.equal(core.soundex(''), '');
});

test('soundex groups names that sound alike but spell differently', () => {
  assert.equal(core.soundex('Sean'), core.soundex('Shawn'));
  assert.equal(core.soundex('Katherine'), core.soundex('Kathryn'));
});

test('detectClashes flags exact duplicate names as high severity', () => {
  const cast = [
    { id: 'c1', first: 'Ash', last: 'Reed' },
    { id: 'c2', first: 'ash', last: 'reed' },
  ];
  const warnings = core.detectClashes(cast);
  assert.deepEqual(types(warnings), ['duplicate-name']);
  assert.equal(warnings[0].severity, 'high');
});

test('detectClashes flags similar first-name spellings', () => {
  const cast = [
    { id: 'c1', first: 'Jon', last: 'Smith' },
    { id: 'c2', first: 'John', last: 'Reid' },
  ];
  const warnings = core.detectClashes(cast);
  assert.ok(warnings.some((w) => w.type === 'similar-first-name' && w.severity === 'medium'));
});

test('detectClashes flags long names similar in spelling', () => {
  const cast = [
    { id: 'c1', first: 'Gabriella', last: 'Vale' },
    { id: 'c2', first: 'Gabriela', last: 'Marsh' },
  ];
  const warnings = core.detectClashes(cast);
  assert.ok(warnings.some((w) => w.type === 'similar-first-name'));
});

test('detectClashes does not flag clearly distinct short names', () => {
  const cast = [
    { id: 'c1', first: 'Iris', last: 'Smith' },
    { id: 'c2', first: 'Ivy', last: 'Reid' },
  ];
  assert.deepEqual(core.detectClashes(cast), []);
});

test('detectClashes catches names that sound alike but spell differently', () => {
  const cast = [
    { id: 'c1', first: 'Sean', last: 'Ford' },
    { id: 'c2', first: 'Shawn', last: 'Marsh' },
  ];
  const warnings = core.detectClashes(cast);
  assert.ok(warnings.some((w) => w.type === 'sounds-alike-first' && w.severity === 'low'));
});

test('detectClashes catches similar surnames (Miller / Mueller)', () => {
  const cast = [
    { id: 'c1', first: 'Kate', last: 'Miller' },
    { id: 'c2', first: 'Rosa', last: 'Mueller' },
  ];
  const warnings = core.detectClashes(cast);
  assert.ok(warnings.some((w) => w.type === 'similar-last-name' || w.type === 'sounds-alike-last'));
});

test('detectClashes flags shared first name at low severity', () => {
  const cast = [
    { id: 'c1', first: 'Anna', last: 'Smith' },
    { id: 'c2', first: 'Anna', last: 'Carey' },
  ];
  const warnings = core.detectClashes(cast);
  assert.deepEqual(types(warnings), ['shared-first-name']);
  assert.equal(warnings[0].severity, 'low');
});

test('detectClashes flags reversed twin names', () => {
  const cast = [
    { id: 'c1', first: 'Ash', last: 'Reed' },
    { id: 'c2', first: 'Reed', last: 'Ash' },
  ];
  const warnings = core.detectClashes(cast);
  assert.ok(warnings.some((w) => w.type === 'reversed-name' && w.severity === 'medium'));
});

test('detectClashes flags a nickname used by two characters', () => {
  const cast = [
    { id: 'c1', first: 'Robert', last: 'Ford', aliases: ['Bob'] },
    { id: 'c2', first: 'Barbara', last: 'Ross', aliases: ['bob'] },
  ];
  const warnings = core.detectClashes(cast);
  assert.deepEqual(types(warnings), ['alias-shared']);
  assert.equal(warnings[0].severity, 'high');
});

test('detectClashes flags an alias shadowing another character name', () => {
  const cast = [
    { id: 'c1', first: 'Robert', last: 'Ford', aliases: ['Brandon'] },
    { id: 'c2', first: 'Brandon', last: 'Lee' },
  ];
  const warnings = core.detectClashes(cast);
  assert.deepEqual(types(warnings), ['alias-shadows-name']);
  assert.equal(warnings[0].severity, 'medium');
});

test('detectClashes flags an alias matching a full name', () => {
  const cast = [
    { id: 'c1', first: 'Ella', last: 'Marsh', aliases: ['Brandon Lee'] },
    { id: 'c2', first: 'Brandon', last: 'Lee' },
  ];
  const warnings = core.detectClashes(cast);
  assert.deepEqual(types(warnings), ['alias-shadows-name']);
});

test('detectClashes stays quiet for a distinctly named cast', () => {
  const cast = [
    { id: 'c1', first: 'Zora', last: 'Quill' },
    { id: 'c2', first: 'Phineas', last: 'Marsh', aliases: ['Fin'] },
    { id: 'c3', first: 'Marisol', last: 'Vega', aliases: ['Mari'] },
  ];
  assert.deepEqual(core.detectClashes(cast), []);
});

test('detectClashes sorts high severity first and handles empty casts', () => {
  assert.deepEqual(core.detectClashes([]), []);
  const cast = [
    { id: 'c1', first: 'Anna', last: 'Smith' },
    { id: 'c2', first: 'Anna', last: 'Carey' },
    { id: 'c3', first: 'Robert', last: 'Ford', aliases: ['Anna Smith'] },
  ];
  const warnings = core.detectClashes(cast);
  assert.ok(warnings.length >= 2);
  const ranks = { high: 0, medium: 1, low: 2 };
  for (let i = 1; i < warnings.length; i += 1) {
    assert.ok(ranks[warnings[i].severity] >= ranks[warnings[i - 1].severity], 'warnings sorted by severity');
  }
});

test('detectClashes ignores characters without names', () => {
  const cast = [{ id: 'c0' }, { id: 'c1', first: '', last: '', aliases: [''] }];
  assert.deepEqual(core.detectClashes(cast), []);
});

test('detectClashes dedupes pair warnings to one row per type', () => {
  const cast = [
    { id: 'c1', first: 'Jon', last: 'Smith' },
    { id: 'c2', first: 'John', last: 'Smyth' },
  ];
  const warnings = core.detectClashes(cast);
  const seen = new Set();
  warnings.forEach((w) => {
    const fingerprint = `${w.type}:${w.a}:${w.b}:${w.key}`;
    assert.ok(!seen.has(fingerprint), `duplicate warning ${fingerprint}`);
    seen.add(fingerprint);
  });
  assert.equal(warnings.length, 2);
});
