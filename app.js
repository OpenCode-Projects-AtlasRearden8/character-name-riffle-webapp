(function () {
  'use strict';

  const core = globalThis.RiffleCore;
  const STORAGE_KEY = 'charriffle.v1';
  const TABS = ['inventory', 'clashes', 'aliases', 'family', 'riffle'];
  const SEV_CLASS = { high: 'sev-high', medium: 'sev-medium', low: 'sev-low' };

  let storageOk = true;
  try {
    const probe = STORAGE_KEY + '.probe';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
  } catch (e) {
    storageOk = false;
  }

  function defaultState() {
    return {
      version: 1,
      activeTab: 'inventory',
      characters: [],
      riffleSlots: [],
      settings: { style: 'classic', letter: '', count: 6 },
    };
  }

  let state = defaultState();
  if (storageOk) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) state = Object.assign(defaultState(), JSON.parse(raw));
    } catch (e) {
      state = defaultState();
    }
  }

  let saveSeq = 0;
  function uid() {
    saveSeq += 1;
    if (globalThis.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + saveSeq + '-' + Math.random().toString(36).slice(2, 10);
  }

  function save() {
    if (!storageOk) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('CharRiffle could not save to localStorage:', e);
    }
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  const $ = (sel) => document.querySelector(sel);

  function displayName(c) {
    return [c && c.first, c && c.last].filter(Boolean).join(' ') || '(unnamed)';
  }

  function trunc(value, max) {
    const s = String(value || '');
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
  }

  let toastTimer = null;
  function toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  // ---------- tabs ----------

  function setTab(tab) {
    state.activeTab = TABS.includes(tab) ? tab : 'inventory';
    save();
    render();
  }

  // ---------- characters ----------

  let editorId = null;
  let editingAliases = [];
  let familyId = null;

  function findChar(id) {
    return state.characters.find((c) => c.id === id) || null;
  }

  function getClashes() {
    return core.detectClashes(state.characters);
  }

  function openEditor(id) {
    editorId = id || null;
    const c = id ? findChar(id) : null;
    editingAliases = c ? [...(c.aliases || [])] : [];
    $('#editor-title').textContent = c ? 'Edit ' + displayName(c) : 'Add character';
    $('#f-first').value = c ? c.first || '' : '';
    $('#f-last').value = c ? c.last || '' : '';
    $('#f-role').value = c && c.role ? c.role : 'Supporting';
    $('#f-first-app').value = c ? c.firstAppearance || '' : '';
    $('#f-last-app').value = c ? c.lastAppearance || '' : '';
    $('#f-notes').value = c ? c.notes || '' : '';
    $('#f-alias').value = '';
    renderAliasChips();
    $('#editor').hidden = false;
    $('#f-first').focus();
  }

  function closeEditor() {
    editorId = null;
    $('#editor').hidden = true;
  }

  function submitEditor(event) {
    event.preventDefault();
    const first = $('#f-first').value.trim();
    const last = $('#f-last').value.trim();
    if (!core.normalize(first) && !core.normalize(last)) {
      toast('Give the character at least a first or last name.');
      return;
    }
    const payload = {
      first,
      last,
      role: $('#f-role').value,
      firstAppearance: $('#f-first-app').value.trim(),
      lastAppearance: $('#f-last-app').value.trim(),
      notes: $('#f-notes').value.trim(),
      aliases: [...editingAliases],
    };
    if (editorId) {
      const c = findChar(editorId);
      if (c) Object.assign(c, payload);
    } else {
      state.characters.push({ id: uid(), relations: [], ...payload });
    }
    closeEditor();
    save();
    render();
    toast('Character saved.');
  }

  function renderAliasChips() {
    $('#alias-chips').innerHTML = editingAliases.length
      ? editingAliases
          .map(
            (a, i) =>
              '<span class="chip">' + escapeHtml(a) +
              '<button type="button" class="chip-x" data-alias-i="' + i + '" aria-label="Remove ' + escapeHtml(a) + '">×</button></span>'
          )
          .join('')
      : '<span class="hint">No nicknames or aliases yet.</span>';
  }

  function addAliasFromInput() {
    const input = $('#f-alias');
    const value = input.value.trim();
    if (!value) return;
    if (editingAliases.some((a) => core.normalize(a) === core.normalize(value))) {
      toast('That alias is already on this character.');
      return;
    }
    editingAliases.push(value);
    input.value = '';
    renderAliasChips();
    input.focus();
  }

  function deleteCharacter(id) {
    const c = findChar(id);
    if (!c) return;
    if (!confirm('Remove ' + displayName(c) + ' from the cast? This cannot be undone.')) return;
    state.characters = state.characters.filter((x) => x.id !== id);
    state.characters.forEach((other) => {
      other.relations = (other.relations || []).filter((r) => r.targetId !== id);
    });
    if (familyId === id) familyId = state.characters[0] ? state.characters[0].id : null;
    save();
    render();
    toast(displayName(c) + ' removed.');
  }

  function characterCard(c, index, clashCount) {
    const clashBadge = clashCount
      ? '<button type="button" class="badge clash" data-jump-clashes title="Show clash warnings">' +
        clashCount + ' clash' + (clashCount === 1 ? '' : 'es') + '</button>'
      : '';
    const chips = (c.aliases || [])
      .map((a) => '<span class="chip static">' + escapeHtml(a) + '</span>')
      .join('');
    const relations = (c.relations || [])
      .map((r) => {
        const t = findChar(r.targetId);
        return escapeHtml((r.label || 'Related') + ' → ' + (t ? displayName(t) : '(removed character)'));
      })
      .join(' · ');
    return (
      '<article class="card character">' +
      '<div class="card-head">' +
      '<h3>' + escapeHtml(displayName(c)) + '</h3>' +
      '<span class="badge role">' + escapeHtml(c.role || 'Unset role') + '</span>' +
      clashBadge +
      '</div>' +
      '<div class="card-body">' +
      '<p class="meta"><span>First seen</span> ' + escapeHtml(c.firstAppearance || '—') +
      ' &nbsp;·&nbsp; <span>Last seen</span> ' + escapeHtml(c.lastAppearance || '—') + '</p>' +
      (c.notes ? '<p class="notes">' + escapeHtml(c.notes) + '</p>' : '') +
      (chips ? '<div class="chips">' + chips + '</div>' : '') +
      (relations ? '<p class="meta"><span>Relations</span> ' + relations + '</p>' : '') +
      '</div>' +
      '<div class="card-actions">' +
      '<button type="button" class="btn small" data-edit="' + escapeHtml(c.id) + '">Edit</button>' +
      '<button type="button" class="btn small danger" data-delete="' + escapeHtml(c.id) + '">Delete</button>' +
      '</div></article>'
    );
  }

  function renderInventory() {
    const clashes = getClashes();
    const clashCountByIndex = new Map();
    clashes.forEach((w) => {
      [w.a, w.b].forEach((i) => {
        if (typeof i === 'number') {
          clashCountByIndex.set(i, (clashCountByIndex.get(i) || 0) + 1);
        }
      });
    });
    const query = $('#search').value.trim().toLowerCase();
    const matchesQuery = (c) => {
      if (!query) return true;
      return [c.first, c.last, c.role, c.firstAppearance, c.lastAppearance, c.notes]
        .concat(c.aliases || [])
        .join(' ')
        .toLowerCase()
        .includes(query);
    };
    const cards = state.characters
      .map((c, i) => ({ c, i }))
      .filter((entry) => matchesQuery(entry.c))
      .map((entry) => characterCard(entry.c, entry.i, clashCountByIndex.get(entry.i) || 0));
    $('#character-list').innerHTML = cards.length
      ? cards.join('')
      : state.characters.length
        ? '<div class="card empty"><h3>No matches</h3><p>Nothing in the cast matches that search.</p></div>'
        : '<div class="card empty"><h3>No characters yet</h3><p>Add your first character, or load a small sample cast to poke around. Everything stays in this browser.</p>' +
          '<button type="button" class="btn primary" id="btn-sample">Load sample cast</button></div>';
  }

  // ---------- clashes tab ----------

  function renderClashes() {
    const clashes = getClashes();
    $('#clashes-count').textContent = String(clashes.length);
    $('#clashes-list').innerHTML = clashes.length
      ? clashes.map(warningCard).join('')
      : '<div class="card empty"><h3>No clashes detected</h3><p>Cast names are comfortably distinct. New warnings show up here as you add or edit characters.</p></div>';
  }

  function warningCard(w) {
    const a = state.characters[w.a];
    const b = state.characters[w.b];
    const nameAt = (c, i) => (c ? displayName(c) : 'character #' + (i + 1));
    return (
      '<article class="card warning">' +
      '<div class="card-head"><h3>' + escapeHtml(w.label || w.type) + '</h3>' +
      '<span class="badge sev ' + SEV_CLASS[w.severity] + '">' + escapeHtml(w.severity) + '</span></div>' +
      '<p>' + escapeHtml(w.detail) + '</p>' +
      '<div class="card-actions">' +
      (a ? '<button type="button" class="btn small" data-focus-char="' + escapeHtml(a.id) + '">Show ' + escapeHtml(nameAt(a, w.a)) + '</button>' : '') +
      (b ? '<button type="button" class="btn small" data-focus-char="' + escapeHtml(b.id) + '">Show ' + escapeHtml(nameAt(b, w.b)) + '</button>' : '') +
      '</div></article>'
    );
  }

  // ---------- aliases tab ----------

  function renderAliases() {
    const groups = new Map();
    state.characters.forEach((c) => {
      (Array.isArray(c.aliases) ? c.aliases : []).forEach((raw) => {
        const key = core.normalize(raw);
        if (!key) return;
        if (!groups.has(key)) groups.set(key, { display: String(raw).trim(), owners: [] });
        const group = groups.get(key);
        if (!group.owners.some((o) => o.id === c.id)) group.owners.push(c);
      });
    });
    const rows = [...groups.values()].sort((x, y) => x.display.localeCompare(y.display));
    $('#aliases-list').innerHTML = rows.length
      ? '<table class="table"><thead><tr><th>Nickname / alias</th><th>Maps to</th></tr></thead><tbody>' +
        rows
          .map(
            (g) =>
              '<tr class="' + (g.owners.length > 1 ? 'row-hot' : '') + '"><td>' + escapeHtml(g.display) +
              (g.owners.length > 1 ? ' <span class="badge sev sev-high">shared</span>' : '') +
              '</td><td>' + g.owners.map((c) => escapeHtml(displayName(c))).join(', ') + '</td></tr>'
          )
          .join('') +
        '</tbody></table>'
      : '<div class="card empty"><h3>No aliases yet</h3><p>Open a character in the Inventory tab and add nicknames on the way — formal names here, casual names everywhere there.</p></div>';
  }

  // ---------- family tab ----------

  function currentFamilyChar() {
    return findChar(familyId) || state.characters[0] || null;
  }

  function renderFamily() {
    const chars = state.characters;
    $('#family-empty').hidden = chars.length > 0;
    $('#family-tools').hidden = chars.length === 0;
    const c = currentFamilyChar();
    if (!c) {
      $('#rel-list').innerHTML = '';
      $('#family-sketch').innerHTML = '<p class="hint">The sketch appears once you have characters.</p>';
      return;
    }
    renderRelationLists(c);
    $('#family-sketch').innerHTML = sketchSvg();
  }

  function renderRelationLists(c) {
    const outbound = (c.relations || []).filter((r) => findChar(r.targetId));
    const inbound = [];
    state.characters.forEach((x) => {
      if (x.id !== c.id) {
        (x.relations || []).forEach((r) => {
          if (r.targetId === c.id) inbound.push({ label: r.label, from: x });
        });
      }
    });
    $('#family-char').innerHTML = state.characters
      .map((x) => '<option value="' + escapeHtml(x.id) + '"' + (x.id === c.id ? ' selected' : '') + '>' + escapeHtml(displayName(x)) + '</option>')
      .join('');
    $('#rel-target').innerHTML = state.characters
      .filter((x) => x.id !== c.id)
      .map((x) => '<option value="' + escapeHtml(x.id) + '">' + escapeHtml(displayName(x)) + '</option>')
      .join('');
    const rows = outbound
      .map(
        (r) =>
          '<div class="rel-row"><strong>' + escapeHtml(r.label || 'Related') + '</strong>' +
          '<span>→</span><span>' + escapeHtml(displayName(findChar(r.targetId))) + '</span>' +
          '<span class="spacer"></span>' +
          '<button type="button" class="btn small danger" data-del-rel="' + escapeHtml(r.targetId) + '">Remove</button></div>'
      )
      .concat(
        inbound.map(
          (r) =>
            '<div class="rel-row inbound"><strong>' + escapeHtml(r.label || 'Related') + '</strong>' +
            '<span>←</span><span>' + escapeHtml(displayName(r.from)) + '</span>' +
            '<span class="spacer"></span><span>manage on their card</span></div>'
        )
      );
    $('#rel-list').innerHTML = rows.length
      ? rows.join('')
      : '<p class="hint">No relations yet for ' + escapeHtml(displayName(c)) + '.</p>';
  }

  function addRelation() {
    const c = currentFamilyChar();
    if (!c) return;
    const targetId = $('#rel-target').value;
    if (!targetId || targetId === c.id) {
      toast('Focus on a character whose family you can draw with someone else.');
      return;
    }
    const custom = $('#rel-custom').value.trim();
    const preset = $('#rel-label').value;
    const label = custom || preset || 'Related';
    c.relations = c.relations || [];
    if (c.relations.some((r) => r.targetId === targetId && r.label === label)) {
      toast('That relation is already listed.');
      return;
    }
    c.relations.push({ targetId, label });
    $('#rel-custom').value = '';
    save();
    render();
    toast('Relation added.');
  }

  function removeRelation(sourceId, targetId) {
    const source = findChar(sourceId);
    if (!source) return;
    source.relations = (source.relations || []).filter((r) => r.targetId !== targetId);
    save();
    render();
  }

  function sketchSvg() {
    const chars = state.characters;
    if (!chars.length) return '';
    const W = 440;
    const H = 440;
    const cx = W / 2;
    const cy = H / 2;
    const n = chars.length;
    const radius = n <= 2 ? 130 : Math.min(165, 64 + n * 9);
    const pos = chars.map((c, i) => {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle), c };
    });
    const edges = new Map();
    chars.forEach((src) => {
      (src.relations || []).forEach((rel) => {
        const ia = pos.findIndex((p) => p.c.id === src.id);
        const ib = pos.findIndex((p) => p.c.id === rel.targetId);
        if (ia < 0 || ib < 0 || ia === ib) return;
        const key = [ia, ib].sort((x, y) => x - y).join('|');
        const entry = edges.get(key) || { ia, ib, labels: [] };
        if (!entry.labels.includes(rel.label) && entry.labels.length < 3) entry.labels.push(rel.label);
        edges.set(key, entry);
      });
    });
    let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="sketch" role="img" aria-label="Family relationship sketch">';
    edges.forEach((e) => {
      const pa = pos[e.ia];
      const pb = pos[e.ib];
      const mx = (pa.x + pb.x) / 2;
      const my = (pa.y + pb.y) / 2;
      const dx = mx - cx;
      const dy = my - cy;
      const len = Math.hypot(dx, dy) || 1;
      const ox = mx + (dx / len) * 13;
      const oy = my + (dy / len) * 13 + 3;
      svg += '<line x1="' + pa.x.toFixed(1) + '" y1="' + pa.y.toFixed(1) + '" x2="' + pb.x.toFixed(1) + '" y2="' + pb.y.toFixed(1) + '" class="edge"/>';
      svg += '<text x="' + ox.toFixed(1) + '" y="' + oy.toFixed(1) + '" class="edge-label">' + escapeHtml(e.labels.join(' / ')) + '</text>';
    });
    pos.forEach((p) => {
      const selected = p.c.id === (familyId || chars[0].id) ? ' selected' : '';
      svg += '<g class="node' + selected + '" data-node="' + escapeHtml(p.c.id) + '">';
      svg += '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="27" class="node-circle"/>';
      svg += '<text x="' + p.x.toFixed(1) + '" y="' + (p.y + (p.c.last ? -3 : 4)).toFixed(1) + '" class="node-label">' + escapeHtml(trunc(p.c.first || '(unnamed)', 11)) + '</text>';
      if (p.c.last) {
        svg += '<text x="' + p.x.toFixed(1) + '" y="' + (p.y + 8).toFixed(1) + '" class="node-sub">' + escapeHtml(trunc(p.c.last, 13)) + '</text>';
      }
      svg += '</g>';
    });
    svg += '</svg>';
    if (!edges.size) {
      svg += '<p class="hint">Draw a relation on the left and it appears here.</p>';
    }
    return svg;
  }

  // ---------- riffle tab ----------

  function riffleOptions() {
    const count = Math.min(16, Math.max(1, parseInt($('#riffle-count').value, 10) || 6));
    const opts = {
      style: $('#riffle-style').value === 'fantasy' ? 'fantasy' : 'classic',
      letter: $('#riffle-letter').value || '',
    };
    state.settings = { style: opts.style, letter: opts.letter, count };
    save();
    return opts;
  }

  function makeSlot(opts) {
    const name = core.generateName(opts);
    return { id: uid(), first: name.first, last: name.last, pinned: false };
  }

  function riffleAll() {
    const opts = riffleOptions();
    const pinned = state.riffleSlots.filter((s) => s.pinned);
    const want = Math.max(0, state.settings.count - pinned.length);
    const fresh = [];
    for (let i = 0; i < want; i += 1) fresh.push(makeSlot(opts));
    state.riffleSlots = pinned.concat(fresh);
    save();
    render();
  }

  function reriffleSlot(index) {
    const slot = state.riffleSlots[index];
    if (!slot) return;
    const opts = riffleOptions();
    const name = core.generateName(opts);
    slot.first = name.first;
    slot.last = name.last;
    save();
    render();
  }

  function slotClashChips(slot) {
    if (!state.characters.length) return '';
    const probe = [{ first: slot.first, last: slot.last }].concat(state.characters);
    const warnings = core.detectClashes(probe).filter((w) => w.a === 0 || w.b === 0);
    const seen = new Set();
    const chips = [];
    warnings.forEach((w) => {
      const otherIndex = w.a === 0 ? w.b : w.a;
      if (otherIndex === 0 || seen.has(otherIndex)) return;
      seen.add(otherIndex);
      const c = state.characters[otherIndex - 1];
      if (c) chips.push('<span class="badge clash" title="' + escapeHtml(w.detail) + '">~' + escapeHtml(displayName(c)) + '</span>');
    });
    return chips.length ? '<span class="slot-clashes">' + chips.join('') + '</span>' : '';
  }

  function slotHtml(slot, index) {
    return (
      '<div class="card slot' + (slot.pinned ? ' pinned' : '') + '">' +
      '<div class="slot-name"><span class="slot-n">' + (index + 1) + '</span>' +
      '<strong>' + escapeHtml([slot.first, slot.last].filter(Boolean).join(' ')) + '</strong>' +
      slotClashChips(slot) +
      '</div>' +
      '<div class="card-actions">' +
      '<button type="button" class="btn small" data-slot-reriffle="' + index + '">Reriffle</button>' +
      '<button type="button" class="btn small' + (slot.pinned ? ' primary' : '') + '" data-slot-pin="' + index + '">' + (slot.pinned ? 'pinned' : 'Pin to keep') + '</button>' +
      '<button type="button" class="btn small' + (slotClashChips(slot) ? ' danger' : '') + '" data-slot-add="' + index + '">Add to cast</button>' +
      '<button type="button" class="btn small" data-slot-drop="' + index + '">Drop</button>' +
      '</div></div>'
    );
  }

  function renderRiffle() {
    $('#riffle-style').value = state.settings.style;
    $('#riffle-letter').value = state.settings.letter;
    $('#riffle-count').value = state.settings.count;
    $('#slot-list').innerHTML = state.riffleSlots.length
      ? state.riffleSlots.map(slotHtml).join('')
      : '<div class="card empty"><h3>No placeholder names yet</h3><p>Hit “Riffle” to spin a batch of names. Pin the keepers, reriffle the rest, then promote winners to your cast.</p></div>';
    $('#btn-add-all').disabled = state.riffleSlots.length === 0;
  }

  function addToCast(slot) {
    const name = [slot.first, slot.last].filter(Boolean).join(' ');
    const dupe = state.characters.some(
      (c) => core.normalize(nameOfChar(c)) === core.normalize(name)
    );
    if (dupe) {
      toast(name + ' is already in the cast.');
      return false;
    }
    state.characters.push({
      id: uid(),
      first: slot.first,
      last: slot.last,
      role: 'Placeholder',
      firstAppearance: '',
      lastAppearance: '',
      notes: 'Brainstormed placeholder from the Riffle tab.',
      aliases: [],
      relations: [],
    });
    return true;
  }

  function nameOfChar(c) {
    return [c.first, c.last].filter(Boolean).join(' ');
  }

  function addAllSlots() {
    const unpinned = state.riffleSlots.filter((s) => !s.pinned);
    if (!unpinned.length) {
      toast('Everything in the batch is pinned.');
      return;
    }
    let added = 0;
    unpinned.forEach((slot) => {
      if (addToCast(slot)) added += 1;
      state.riffleSlots = state.riffleSlots.filter((s) => s.id !== slot.id);
    });
    save();
    render();
    toast(added ? added + ' placeholder name' + (added === 1 ? '' : 's') + ' added to the cast.' : 'No new names to add.');
  }

  // ---------- import / export ----------

  function downloadJson() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'charriffle-backup.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Exported your cast as JSON.');
  }

  function sanitizeCharacter(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const role = String(raw.role ?? '').trim();
    return {
      id: typeof raw.id === 'string' && raw.id ? raw.id : uid(),
      first: String(raw.first ?? '').trim().slice(0, 80),
      last: String(raw.last ?? '').trim().slice(0, 80),
      role: role.slice(0, 40) || 'Other',
      firstAppearance: String(raw.firstAppearance ?? '').trim().slice(0, 200),
      lastAppearance: String(raw.lastAppearance ?? '').trim().slice(0, 200),
      notes: String(raw.notes ?? '').trim().slice(0, 2000),
      aliases: (Array.isArray(raw.aliases) ? raw.aliases : [])
        .map((a) => String(a ?? '').trim().slice(0, 60))
        .filter(Boolean)
        .slice(0, 20),
      relations: (Array.isArray(raw.relations) ? raw.relations : [])
        .filter((r) => r && typeof r === 'object' && typeof r.targetId === 'string')
        .map((r) => ({ targetId: r.targetId, label: String(r.label ?? 'Related').trim().slice(0, 60) || 'Related' }))
        .slice(0, 60),
    };
  }

  function importJson(file) {
    const reader = new FileReader();
    reader.onload = () => {
      let parsed;
      try {
        parsed = JSON.parse(reader.result);
      } catch (e) {
        toast('That file is not valid JSON.');
        return;
      }
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.characters)) {
        toast('That file does not look like a CharRiffle export.');
        return;
      }
      const chars = parsed.characters.map(sanitizeCharacter).filter(Boolean);
      if (!confirm('Replace your current cast with ' + chars.length + ' imported character' + (chars.length === 1 ? '' : 's') + '?')) return;
      state = {
        version: 1,
        activeTab: state.activeTab,
        characters: chars,
        riffleSlots: [],
        settings: Object.assign({ style: 'classic', letter: '', count: 6 }, parsed.settings || {}),
      };
      save();
      render();
      toast('Imported ' + chars.length + ' character' + (chars.length === 1 ? '' : 's') + '.');
    };
    reader.onerror = () => toast('Could not read that file.');
    reader.readAsText(file);
  }

  function clearAll() {
    if (!confirm('Clear the whole ledger — characters, riffle batch, and sample data? Export JSON first if you want a copy.')) return;
    state = defaultState();
    save();
    render();
    toast('Ledger cleared.');
  }

  // ---------- sample cast ----------

  function loadSample() {
    if (state.characters.length && !confirm('Add a sample cast on top of your current ' + state.characters.length + ' character' + (state.characters.length === 1 ? '' : 's') + '?')) return;
    const ids = {};
    const mk = (key, fields) => {
      const c = Object.assign(
        {
          id: uid(),
          first: '',
          last: '',
          role: 'Supporting',
          firstAppearance: '',
          lastAppearance: '',
          notes: '',
          aliases: [],
          relations: [],
        },
        fields
      );
      ids[key] = c.id;
      return c;
    };
    state.characters = state.characters.concat([
      mk('robert', {
        first: 'Robert', last: 'Ford', role: 'Protagonist',
        firstAppearance: 'Ch. 1 — dockside job went sideways', lastAppearance: 'Ch. 24 — last train out',
        notes: 'A broker with a ledger habit. Goes by Bob at work, never at home.',
        aliases: ['Bob', 'Rob'],
      }),
      mk('rowan', {
        first: 'Rowan', last: 'Ford', role: 'Supporting',
        firstAppearance: 'Ch. 2 — Sunday dinner', lastAppearance: '',
        notes: 'The younger sibling who keeps showing up unannounced.',
      }),
      mk('robin', {
        first: 'Robin', last: 'Quaid', role: 'Antagonist',
        firstAppearance: 'Ch. 4 — auction room', lastAppearance: 'Ch. 22 — county line',
        notes: 'All charm in person, all claw at a distance.',
        aliases: ['Rob'],
      }),
      mk('brandon', {
        first: 'Brandon', last: 'Lee', role: 'Love interest',
        firstAppearance: 'Ch. 5 — river crossing', lastAppearance: 'Ch. 25 — the gate',
        notes: 'Travels light, remembers everything.',
      }),
      mk('ella', {
        first: 'Ella', last: 'Marsh', role: 'Minor',
        firstAppearance: 'Ch. 6 — letter scene', lastAppearance: '',
        notes: 'Signs anonymous notes with someone else’s name.',
        aliases: ['Brandon Lee'],
      }),
      mk('nora', {
        first: 'Nora', last: 'Quaid', role: 'Mentor',
        firstAppearance: 'Ch. 8 — lighthouse', lastAppearance: '',
        notes: 'Knows the coast, the ledgers, and every skeleton in both.',
      }),
    ]);
    findChar(ids.robert).relations = [
      { targetId: ids.rowan, label: 'Sibling' },
      { targetId: ids.nora, label: 'Child' },
    ];
    findChar(ids.rowan).relations = [{ targetId: ids.robert, label: 'Sibling' }];
    findChar(ids.nora).relations = [{ targetId: ids.robert, label: 'Parent' }];
    findChar(ids.brandon).relations = [{ targetId: ids.ella, label: 'Rival' }];
    familyId = state.characters.length ? state.characters[0].id : null;
    save();
    render();
    setTab('family');
    toast('Sample cast loaded — six characters with built-in demo clashes.');
  }

  // ---------- render ----------

  function render() {
    document.querySelectorAll('.tab-section').forEach((sec) => {
      sec.hidden = sec.dataset.tab !== state.activeTab;
    });
    document.querySelectorAll('.tab-button').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === state.activeTab);
    });
    renderInventory();
    renderClashes();
    renderAliases();
    renderFamily();
    renderRiffle();
  }

  // ---------- events ----------

  function init() {
    if (!storageOk) $('#storage-warning').hidden = false;

    document.querySelectorAll('.tab-button').forEach((btn) => {
      btn.addEventListener('click', () => setTab(btn.dataset.tab));
    });

    $('#btn-add').addEventListener('click', () => openEditor(null));
    $('#character-form').addEventListener('submit', submitEditor);
    $('#btn-cancel').addEventListener('click', closeEditor);
    $('#btn-add-alias').addEventListener('click', addAliasFromInput);
    $('#f-alias').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addAliasFromInput();
      }
    });
    $('#alias-chips').addEventListener('click', (e) => {
      const chip = e.target.closest('[data-alias-i]');
      if (chip) {
        editingAliases.splice(Number(chip.dataset.aliasI), 1);
        renderAliasChips();
      }
    });
    $('#search').addEventListener('input', render);

    $('#character-list').addEventListener('click', (e) => {
      const edit = e.target.closest('[data-edit]');
      if (edit) {
        openEditor(edit.dataset.edit);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      const del = e.target.closest('[data-delete]');
      if (del) {
        deleteCharacter(del.dataset.delete);
        return;
      }
      const jump = e.target.closest('[data-jump-clashes]');
      if (jump) setTab('clashes');
      const sample = e.target.closest('#btn-sample');
      if (sample) loadSample();
    });

    $('#clashes-list').addEventListener('click', (e) => {
      const focus = e.target.closest('[data-focus-char]');
      if (focus) {
        const c = findChar(focus.dataset.focusChar);
        if (c) {
          setTab('inventory');
          openEditor(c.id);
        }
      }
    });

    $('#family-char').addEventListener('change', (e) => {
      familyId = e.target.value;
      render();
    });
    $('#btn-add-relation').addEventListener('click', addRelation);
    $('#rel-list').addEventListener('click', (e) => {
      const del = e.target.closest('[data-del-rel]');
      if (del) {
        const c = currentFamilyChar();
        removeRelation(c.id, del.dataset.delRel);
      }
    });
    $('#family-sketch').addEventListener('click', (e) => {
      const node = e.target.closest('[data-node]');
      if (node) {
        familyId = node.dataset.node;
        render();
      }
    });

    $('#btn-riffle').addEventListener('click', riffleAll);
    $('#btn-clear-slots').addEventListener('click', () => {
      if (!state.riffleSlots.length) return;
      if (!confirm('Clear the whole riffle batch, including pinned slots?')) return;
      state.riffleSlots = [];
      save();
      render();
    });
    $('#slot-list').addEventListener('click', (e) => {
      const reroll = e.target.closest('[data-slot-reriffle]');
      if (reroll) {
        reriffleSlot(Number(reroll.dataset.slotReriffle));
        return;
      }
      const pin = e.target.closest('[data-slot-pin]');
      if (pin) {
        const slot = state.riffleSlots[Number(pin.dataset.slotPin)];
        if (slot) {
          slot.pinned = !slot.pinned;
          save();
          render();
        }
        return;
      }
      const add = e.target.closest('[data-slot-add]');
      if (add) {
        const slot = state.riffleSlots[Number(add.dataset.slotAdd)];
        if (slot) {
          if (addToCast(slot)) {
            state.riffleSlots = state.riffleSlots.filter((s) => s.id !== slot.id);
            save();
            render();
            toast([slot.first, slot.last].filter(Boolean).join(' ') + ' added to the cast as a placeholder.');
          }
        }
        return;
      }
      const drop = e.target.closest('[data-slot-drop]');
      if (drop) {
        state.riffleSlots.splice(Number(drop.dataset.slotDrop), 1);
        save();
        render();
      }
    });
    $('#btn-add-all').addEventListener('click', addAllSlots);

    $('#btn-export').addEventListener('click', downloadJson);
    $('#btn-import').addEventListener('click', () => $('#import-file').click());
    $('#import-file').addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) importJson(e.target.files[0]);
      e.target.value = '';
    });
    $('#btn-clear-all').addEventListener('click', clearAll);

    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
