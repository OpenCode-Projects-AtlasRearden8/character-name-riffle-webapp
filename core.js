(function (root) {
  'use strict';

  function normalize(value) {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z ]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let prev = new Array(b.length + 1);
    let curr = new Array(b.length + 1);
    for (let j = 0; j <= b.length; j += 1) prev[j] = j;
    for (let i = 1; i <= a.length; i += 1) {
      curr[0] = i;
      for (let j = 1; j <= b.length; j += 1) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      }
      const swap = prev;
      prev = curr;
      curr = swap;
    }
    return prev[b.length];
  }

  function spellingSimilarity(a, b) {
    const x = normalize(a);
    const y = normalize(b);
    if (!x || !y) return 0;
    if (x === y) return 2;
    const distance = levenshtein(x, y);
    if (distance === 1) return 1;
    if (distance === 2 && Math.max(x.length, y.length) >= 7) return 1;
    return 0;
  }

  const SOUNDEX_CODES = {
    B: '1', F: '1', P: '1', V: '1',
    C: '2', G: '2', J: '2', K: '2', Q: '2', S: '2', X: '2', Z: '2',
    D: '3', T: '3', L: '4', M: '5', N: '5', R: '6',
  };
  const VOWELS = new Set(['A', 'E', 'I', 'O', 'U', 'Y']);

  function soundex(value) {
    const word = normalize(value).toUpperCase().replace(/[^A-Z]/g, '');
    if (!word) return '';
    const first = word[0];
    let out = first;
    let prev = SOUNDEX_CODES[first] || '';
    for (let i = 1; i < word.length; i += 1) {
      const letter = word[i];
      if (letter === 'H' || letter === 'W') continue;
      if (VOWELS.has(letter)) {
        prev = '';
        continue;
      }
      const code = SOUNDEX_CODES[letter] || '';
      if (code && code !== prev) {
        out += code;
        if (out.length >= 4) break;
      }
      prev = code || prev;
    }
    return (out + '000').slice(0, 4);
  }

  function nameOf(character) {
    return [character && character.first, character && character.last]
      .map((part) => String(part ?? '').trim())
      .filter(Boolean)
      .join(' ');
  }

  const TYPE_LABELS = {
    'duplicate-name': 'Exact duplicate name',
    'reversed-name': 'Reversed twin name',
    'similar-first-name': 'Similar first-name spellings',
    'shared-first-name': 'Shared first name',
    'sounds-alike-first': 'First names sound alike',
    'similar-last-name': 'Similar surname spellings',
    'shared-last-name': 'Shared surname',
    'sounds-alike-last': 'Surnames sound alike',
    'alias-shared': 'Nickname collision',
    'alias-shadows-name': 'Alias shadows a character name',
  };

  const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };

  function detectClashes(characters) {
    const cast = Array.isArray(characters) ? characters : [];
    const warnings = [];

    const fullNames = cast.map((c) => normalize(nameOf(c)));
    const firstNames = cast.map((c) => normalize(c && c.first));
    const lastNames = cast.map((c) => normalize(c && c.last));

    for (let i = 0; i < cast.length; i += 1) {
      for (let j = i + 1; j < cast.length; j += 1) {
        const fullA = fullNames[i];
        const fullB = fullNames[j];
        if (!fullA || !fullB) continue;
        const labelA = nameOf(cast[i]);
        const labelB = nameOf(cast[j]);

        if (fullA === fullB) {
          warnings.push({
            type: 'duplicate-name',
            severity: 'high',
            a: i,
            b: j,
            key: `dup:${fullA}`,
            label: TYPE_LABELS['duplicate-name'],
            detail: `"${labelA}" appears twice in the cast (exact duplicate).`,
          });
          continue;
        }

        const wordsA = fullA.split(' ');
        const wordsB = fullB.split(' ');
        if (
          wordsA.length >= 2 &&
          wordsB.length >= 2 &&
          wordsA.slice().reverse().join(' ') === wordsB.join(' ')
        ) {
          warnings.push({
            type: 'reversed-name',
            severity: 'medium',
            a: i,
            b: j,
            key: `rev:${fullA}|${fullB}`,
            label: TYPE_LABELS['reversed-name'],
            detail: `"${labelA}" and "${labelB}" are the same name with the words swapped. Easy to muddle in a fast read.`,
          });
        }

        const firstA = firstNames[i];
        const firstB = firstNames[j];
        if (firstA && firstB) {
          const sim = spellingSimilarity(firstA, firstB);
          if (sim === 1) {
            warnings.push({
              type: 'similar-first-name',
              severity: 'medium',
              a: i,
              b: j,
              key: `first:${firstA}|${firstB}`,
              label: TYPE_LABELS['similar-first-name'],
              detail: `First names "${String(cast[i].first).trim()}" and "${String(cast[j].first).trim()}" are one small edit apart.`,
            });
          } else if (sim === 2) {
            warnings.push({
              type: 'shared-first-name',
              severity: 'low',
              a: i,
              b: j,
              key: `firstsame:${firstA}|${firstB}`,
              label: TYPE_LABELS['shared-first-name'],
              detail: `"${String(cast[i].first).trim()}" is the shared first name of ${labelA} and ${labelB}. Fine if it is deliberate.`,
            });
          } else if (soundex(firstA) === soundex(firstB)) {
            warnings.push({
              type: 'sounds-alike-first',
              severity: 'low',
              a: i,
              b: j,
              key: `firstsnd:${firstA}|${firstB}`,
              label: TYPE_LABELS['sounds-alike-first'],
              detail: `First names "${String(cast[i].first).trim()}" and "${String(cast[j].first).trim()}" sound alike (same soundex code).`,
            });
          }
        }

        const lastA = lastNames[i];
        const lastB = lastNames[j];
        if (lastA && lastB) {
          const sim = spellingSimilarity(lastA, lastB);
          if (sim === 1) {
            warnings.push({
              type: 'similar-last-name',
              severity: 'medium',
              a: i,
              b: j,
              key: `last:${lastA}|${lastB}`,
              label: TYPE_LABELS['similar-last-name'],
              detail: `Surnames "${String(cast[i].last).trim()}" and "${String(cast[j].last).trim()}" are close in spelling.`,
            });
          } else if (sim === 2) {
            warnings.push({
              type: 'shared-last-name',
              severity: 'low',
              a: i,
              b: j,
              key: `lastsame:${lastA}|${lastB}`,
              label: TYPE_LABELS['shared-last-name'],
              detail: `${labelA} and ${labelB} share the surname "${String(cast[i].last).trim()}".`,
            });
          } else if (soundex(lastA) === soundex(lastB)) {
            warnings.push({
              type: 'sounds-alike-last',
              severity: 'low',
              a: i,
              b: j,
              key: `lastsnd:${lastA}|${lastB}`,
              label: TYPE_LABELS['sounds-alike-last'],
              detail: `Surnames "${String(cast[i].last).trim()}" and "${String(cast[j].last).trim()}" sound alike (same soundex code).`,
            });
          }
        }
      }
    }

    const aliasGroups = new Map();
    cast.forEach((character, i) => {
      const aliases = Array.isArray(character && character.aliases) ? character.aliases : [];
      aliases.forEach((raw) => {
        const key = normalize(raw);
        if (!key) return;
        if (!aliasGroups.has(key)) {
          aliasGroups.set(key, { display: String(raw).trim(), owners: [] });
        }
        const group = aliasGroups.get(key);
        if (!group.owners.includes(i)) group.owners.push(i);
      });
    });

    aliasGroups.forEach((group, key) => {
      if (group.owners.length > 1) {
        const names = group.owners.map((i) => nameOf(cast[i]) || `character #${i + 1}`).join(' and ');
        warnings.push({
          type: 'alias-shared',
          severity: 'high',
          a: group.owners[0],
          b: group.owners[group.owners.length - 1],
          key: `alias:${key}`,
          label: TYPE_LABELS['alias-shared'],
          detail: `The alias "${group.display}" is mapped to ${names}. Readers may not know who is speaking.`,
        });
      }
      group.owners.forEach((owner) => {
        cast.forEach((other, oj) => {
          if (oj === owner) return;
          const otherFirst = firstNames[oj];
          const otherFull = fullNames[oj];
          if (!otherFirst && !otherFull) return;
          let matchKind = '';
          if (otherFull && key === otherFull) matchKind = 'full name';
          else if (otherFirst && key === otherFirst) matchKind = 'first name';
          if (!matchKind) return;
          warnings.push({
            type: 'alias-shadows-name',
            severity: 'medium',
            a: owner,
            b: oj,
            key: `shadow:${key}:${owner}:${oj}`,
            label: TYPE_LABELS['alias-shadows-name'],
            detail: `Alias "${group.display}" on ${nameOf(cast[owner]) || `character #${owner + 1}`} matches the ${matchKind} of ${nameOf(cast[oj]) || `character #${oj + 1}`}.`,
          });
        });
      });
    });

    warnings.sort(
      (w1, w2) =>
        SEVERITY_ORDER[w1.severity] - SEVERITY_ORDER[w2.severity] ||
        w1.type.localeCompare(w2.type) ||
        w1.a - w2.a ||
        w1.b - w2.b ||
        String(w1.key).localeCompare(String(w2.key))
    );
    return warnings;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const CLASSIC_FIRST = [
    'Alice', 'Andrew', 'Beatrice', 'Benjamin', 'Carla', 'Charles', 'Clara', 'Daisy', 'David', 'Edith',
    'Edmund', 'Eleanor', 'Frank', 'Gemma', 'George', 'Harriet', 'Henry', 'Idris', 'Isaac', 'June',
    'Julian', 'Kate', 'Kenneth', 'Lena', 'Leo', 'Mabel', 'Martin', 'Nadia', 'Nathan', 'Olga',
    'Oscar', 'Paula', 'Peter', 'Quinn', 'Rosa', 'Rufus', 'Simon', 'Stella', 'Sylvia', 'Theo',
    'Tessa', 'Ursula', 'Vera', 'Victor', 'Walter', 'Willa', 'Xavier', 'Yara', 'Zoe', 'Marlow',
  ];
  const CLASSIC_LAST = [
    'Ash', 'Barrow', 'Bellamy', 'Bracken', 'Calloway', 'Chase', 'Cobb', 'Crane', 'Daley', 'Dray',
    'Elmore', 'Everhart', 'Fenn', 'Finch', 'Foster', 'Garrow', 'Gray', 'Hale', 'Hartley', 'Holloway',
    'Ingram', 'Kestrel', 'Lawson', 'Lark', 'Marsh', 'Mercer', 'Nash', 'North', 'Oakes', 'Palmer',
    'Pell', 'Quill', 'Radley', 'Reeve', 'Ridge', 'Rowe', 'Sharp', 'Sloane', 'Tanner', 'Thorn',
    'Tolley', 'Vale', 'Vance', 'Whitlock', 'Winslow', 'Wren', 'Yardley', 'Zeller',
  ];
  const FANTASY_FIRST = {
    starts: [
      'Ae', 'Bra', 'Cal', 'Dra', 'El', 'Fae', 'Gor', 'Hael', 'Ilu', 'Jor', 'Kel', 'Lyn', 'Mor',
      'Nym', 'Ori', 'Pyr', 'Quen', 'Rha', 'Sol', 'Thal', 'Umi', 'Vel', 'Wyn', 'Xan', 'Yel', 'Zar',
    ],
    mids: ['a', 'ari', 'drie', 'eth', 'ia', 'ion', 'ir', 'ma', 'ol', 'or', 'ua', 'ul', 'ys', 'el'],
    ends: ['dor', 'eth', 'ien', 'ion', 'kar', 'lin', 'mir', 'na', 'ric', 'wen', 'wyn', 'ys', 'or', 'an'],
  };
  const FANTASY_LAST = {
    starts: [
      'Ash', 'Bran', 'Cold', 'Dusk', 'Everb', 'Fell', 'Frost', 'Grim', 'Hollow', 'Iron', 'Moon',
      'Night', 'Pale', 'Raven', 'Star', 'Storm', 'Sun', 'Thorn', 'Wind', 'Winter',
    ],
    ends: [
      'bane', 'crest', 'fall', 'field', 'guard', 'hollow', 'mere', 'moor', 'ridge', 'spire',
      'vale', 'watch', 'wood', 'brook', 'haven', 'born',
    ],
  };

  function pick(list, rand) {
    return list[Math.floor(rand() * list.length)];
  }

  function pickStartsWith(list, letter, rand) {
    if (!letter) return pick(list, rand);
    const letterLower = letter.toLowerCase();
    const filtered = list.filter((word) => word.toLowerCase().startsWith(letterLower));
    return filtered.length ? pick(filtered, rand) : pick(list, rand);
  }

  function generateFirst(style, letter, rand) {
    if (style === 'fantasy') {
      let name = pickStartsWith(FANTASY_FIRST.starts, letter, rand);
      if (rand() < 0.55) {
        name += pick(FANTASY_FIRST.mids, rand);
        if (rand() < 0.4) name += pick(FANTASY_FIRST.ends, rand);
      } else {
        name += pick(FANTASY_FIRST.ends, rand);
      }
      if (name.length < 4) name += pick(FANTASY_FIRST.ends, rand);
      return name;
    }
    return pickStartsWith(CLASSIC_FIRST, letter, rand);
  }

  function generateLast(style, letter, rand) {
    if (style === 'fantasy') {
      let name = pickStartsWith(FANTASY_LAST.starts, letter, rand) + pick(FANTASY_LAST.ends, rand);
      if (name.length < 6) name += pick(FANTASY_LAST.ends, rand);
      return name;
    }
    return pickStartsWith(CLASSIC_LAST, letter, rand);
  }

  function generateName(options) {
    const opts = options || {};
    const rand = typeof opts.rand === 'function' ? opts.rand : Math.random;
    const style = opts.style === 'fantasy' ? 'fantasy' : 'classic';
    const letter = opts.letter ? String(opts.letter) : '';
    return {
      first: generateFirst(style, letter, rand),
      last: generateLast(style, letter, rand),
    };
  }

  const api = {
    normalize,
    levenshtein,
    spellingSimilarity,
    soundex,
    nameOf,
    detectClashes,
    TYPE_LABELS,
    mulberry32,
    generateName,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.RiffleCore = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
