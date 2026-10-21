/* Aurora Tracker: the editor. A song lives in a note, inside a ```tracker block; the editor reads and writes that block. */

const AT_VIEW = 'aurora-tracker';
const AT_KEYS = 'zsxdcvgbhnjm', AT_KEYS2 = 'q2w3er5t6y7u';

class ATView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf); this.plugin = plugin;
    this.song = null; this.file = null; this.cur = { p: 'A', r: 0, c: 0 }; this.edT = 4; this.follow = true; this.oct = 4;
    this.ph = -1; this.phOrd = -1; this.vu = Array(AT_TRACKS.length).fill(0); this.glow = 0;
  }
  getViewType() { return AT_VIEW; }
  getDisplayText() { return this.song ? `${this.song.title} · Aurora Tracker` : 'Aurora Tracker'; }
  getIcon() { return 'audio-waveform'; }
  getState() { return { file: this.file ? this.file.path : null }; }
  async setState(state, result) {
    if (state && state.file) { const f = this.app.vault.getAbstractFileByPath(state.file); if (f) await this.load(f); }
    return super.setState(state, result);
  }
  async onOpen() {
    this.contentEl.addClass('at'); this.contentEl.tabIndex = 0;
    this.registerDomEvent(this.contentEl, 'keydown', e => this.key(e));
    const P = this.plugin.player;
    this.offs = [P.on((ev, ...a) => this.onPlayer(ev, ...a))];
    this.registerEvent(this.app.vault.on('modify', f => { if (this.file && f.path === this.file.path && Date.now() - (this.savedAt || 0) > 1500) this.load(f, true); }));
    this.registerEvent(this.app.vault.on('rename', (f, old) => { if (this.file && old === this.file.path) this.file = f; }));
    this.render();
  }
  async onClose() { this.offs.forEach(off => off()); if (this.plugin.player.owner === this) this.plugin.player.stop(); await this.flush(); }

  async load(file, keepPlace) {
    const text = await this.app.vault.read(file);
    const block = atBlock(text);
    this.file = file;
    this.song = atFromText(block ? block.body : '');
    if (!block) this.song.title = file.basename;
    if (!keepPlace) { this.cur = { p: this.song.order[0], r: 0, c: 0 }; }
    if (this.plugin.player.owner === this) this.plugin.player.song = this.song;
    this.render();
  }

  // save a moment after the last change
  changed() { clearTimeout(this.st); this.st = window.setTimeout(() => this.flush(), 600); this.leaf.updateHeader && this.leaf.updateHeader(); }
  async flush() {
    clearTimeout(this.st);
    if (!this.file || !this.song) return;
    const body = atToText(this.song);
    this.savedAt = Date.now();
    await this.app.vault.process(this.file, text => atReplaceBlock(text, body));
  }

  /* ---------- the page ---------- */
  render() {
    const el = this.contentEl; el.empty();
    this.paintBg();
    if (!this.song) {
      const e = el.createDiv({ cls: 'at-empty' });
      e.createEl('h2', { text: 'Aurora Tracker' });
      e.createEl('p', { text: 'Songs live in notes. Start a new one, or open a note that has a tracker block.' });
      e.createEl('button', { text: 'New song', cls: 'mod-cta' }).onclick = () => this.plugin.newSong(this.leaf);
      e.createEl('button', { text: 'Try the demo' }).onclick = () => this.plugin.newSong(this.leaf, atFromText(AT_DEMO));
      return;
    }
    const s = this.song, wrap = el.createDiv({ cls: 'at-wrap' });

    // top bar
    const top = wrap.createDiv({ cls: 'at-top' });
    top.createEl('h1', { text: 'Aurora Tracker' });
    const title = top.createEl('input', { cls: 'at-title', attr: { type: 'text', value: s.title, 'aria-label': 'Song title' } });
    title.oninput = () => { s.title = title.value || 'Untitled'; this.changed(); };
    top.createSpan({ cls: 'at-sp' });
    this.playBtn = top.createEl('button', { cls: 'at-play mod-cta' });
    this.playBtn.onclick = () => this.togglePlay();
    const bpmL = top.createEl('label', { cls: 'at-k', text: 'BPM ' });
    const bpm = bpmL.createEl('input', { attr: { type: 'number', min: 40, max: 240, value: s.bpm } });
    bpm.onchange = () => { s.bpm = Math.max(40, Math.min(240, +bpm.value || 112)); bpm.value = s.bpm; this.changed(); this.drawTimeline(); };
    const swL = top.createEl('label', { cls: 'at-k', text: 'Swing ' });
    const sw = swL.createEl('input', { attr: { type: 'range', min: 0, max: 50, value: s.swing } });
    sw.oninput = () => { s.swing = +sw.value; this.changed(); };
    const ocL = top.createEl('label', { cls: 'at-k', text: 'Octave ' });
    const oc = ocL.createEl('select', { cls: 'dropdown' });
    for (const o of [2, 3, 4, 5, 6]) oc.createEl('option', { text: String(o), value: String(o) });
    oc.value = String(this.oct); oc.onchange = () => { this.oct = +oc.value; };
    this.octSel = oc;

    const grid = wrap.createDiv({ cls: 'at-grid' });
    const left = grid.createDiv(), right = grid.createDiv();

    // song card
    const sc = left.createDiv({ cls: 'at-card at-songbar' });
    sc.createEl('h2', { text: 'Song' });
    this.patsEl = sc.createDiv({ cls: 'at-pats' });
    sc.createSpan({ cls: 'at-sp' });
    const files = sc.createDiv({ cls: 'at-files' });
    files.createSpan({ cls: 'at-flabel', text: 'Song file' });
    files.createEl('button', { text: 'Copy', attr: { 'aria-label': 'Copy the song as text' } }).onclick = () => this.copy();
    files.createEl('button', { text: 'Import' }).onclick = () => new ATImportModal(this.app, this.plugin).open();
    files.createEl('button', { text: 'WAV' }).onclick = () => this.plugin.exportWav(this.song, this.file);
    files.createEl('button', { text: 'MIDI' }).onclick = () => this.plugin.exportMidi(this.song, this.file);

    // the pattern sequencer
    const tc = left.createDiv({ cls: 'at-card at-tl-card' });
    this.tlEl = tc.createDiv({ cls: 'at-tl' });
    tc.createEl('button', { cls: 'at-tl-add', text: '+', attr: { 'aria-label': "Add the pattern you're editing to the end of the song" } }).onclick = () => { s.order.push(this.cur.p); this.changed(); this.drawTimeline(); };
    this.tlTime = tc.createDiv({ cls: 'at-tl-time' });
    left.createDiv({ cls: 'at-small at-tl-hint', text: "Click a bar to edit it · + adds the pattern you're editing · right-click a bar to remove it" });

    // the pattern
    const pc = left.createDiv({ cls: 'at-card' });
    const ph = pc.createEl('h2'); ph.appendText('Pattern '); this.patName = ph.createSpan({ cls: 'at-accent' }); ph.createSpan({ cls: 'at-sp' });
    ph.createEl('button', { text: '🎲 Dice the drums', attr: { 'aria-label': 'Roll a new drum groove for this pattern' } }).onclick = () => this.diceDrums();
    ph.createEl('button', { text: 'Clear' }).onclick = () => { s.pats[this.cur.p] = atEmpty(); this.changed(); this.drawGrid(); };
    this.trk = pc.createEl('table', { cls: 'at-trk' });

    // keys
    const kc = right.createDiv({ cls: 'at-card at-help' });
    kc.createEl('h2', { text: 'Keys' });
    const line = parts => { const d = kc.createDiv(); parts.forEach(x => x.startsWith('[') ? d.createEl('kbd', { text: x.slice(1, -1) }) : d.appendText(x)); };
    line(['[Z]', '–', '[M]', ' notes, ', '[Q]', '–', '[U]', ' an octave up']);
    line(['[←]', '[→]', '[↑]', '[↓]', ' move · ', '[Del]', ' clear · ', '[1]', ' note off']);
    line(['[Space]', ' play / stop · ', '[+]', '[−]', ' octave']);
    kc.createDiv({ text: 'Or double-click a cell to drop a note in.' });

    // instrument
    const ic = right.createDiv({ cls: 'at-card' });
    const ih = ic.createEl('h2', { text: 'Instrument' }); ih.createSpan({ cls: 'at-sp' }); ih.createEl('small', { text: 'click a track name to open it' });
    this.chipsEl = ic.createDiv({ cls: 'at-tchips' });
    this.instEl = ic.createDiv();

    this.drawPats(); this.drawTimeline(); this.drawGrid(); this.drawEditor(); this.drawPlay();
  }

  paintBg() {
    const host = this.containerEl, on = this.plugin.set.bg;
    host.toggleClass('at-bg-host', on); host.toggleClass('at-bg-aurora', on);
    host.setCssProps({ '--at-glow': String(this.plugin.set.glow / 100), '--at-dim': String(this.plugin.set.dim / 100) });
  }

  drawPlay() { if (this.playBtn) this.playBtn.setText(this.plugin.player.playing && this.plugin.player.owner === this ? '■ Stop' : '▶ Play'); }
  drawPats() {
    const el = this.patsEl; if (!el) return; el.empty();
    for (const p of AT_PATS) {
      const b = el.createEl('button', { cls: 'at-ob' + (p === this.cur.p ? ' is-on' : ''), text: p });
      b.onclick = () => { this.cur.p = p; this.follow = false; this.drawPats(); this.drawGrid(); this.drawTimeline(); };
    }
    const f = el.createEl('button', { cls: 'at-follow', text: this.follow ? 'Follow ✓' : 'Follow', attr: { 'aria-label': 'Follow the song while it plays' } });
    f.onclick = () => { this.follow = !this.follow; this.drawPats(); };
  }
  playingHere() { return this.plugin.player.playing && this.plugin.player.owner === this; }
  drawTimeline() {
    const el = this.tlEl; if (!el) return; el.empty();
    const s = this.song, oi = this.playingHere() ? this.phOrd : -1;
    s.order.forEach((p, i) => {
      const b = el.createDiv({ cls: 'at-bar' + (oi >= 0 && i < oi ? ' is-done' : '') + (i === oi ? ' is-now' : '') + (oi < 0 && p === this.cur.p ? ' is-edit' : ''), attr: { 'aria-label': `Pattern ${p}` } });
      b.createEl('i').setCssStyles({ width: (i === oi ? (this.ph + 1) / AT_ROWS * 100 : 0) + '%' });
      b.createSpan({ text: p });
      b.onclick = () => { this.cur.p = p; this.follow = false; this.drawPats(); this.drawGrid(); this.drawTimeline(); };
      b.oncontextmenu = e => { e.preventDefault(); if (s.order.length > 1) { s.order.splice(i, 1); this.changed(); this.drawTimeline(); } };
    });
    const sd = atStepDur(s), total = s.order.length * AT_ROWS * sd, now = oi >= 0 ? (oi * AT_ROWS + this.ph + 1) * sd : 0;
    const f = x => Math.floor(x / 60) + ':' + String(Math.floor(x % 60)).padStart(2, '0');
    this.tlTime.setText(`${f(now)} / ${f(total)}`);
  }
  drawGrid() {
    const s = this.song, P = s.pats[this.cur.p], t = this.trk; if (!t) return;
    t.empty(); this.patName.setText(this.cur.p);
    const hr = t.createEl('tr'); hr.createEl('th');
    this.vuEls = [];
    AT_TRACKS.forEach(([k, l], c) => {
      const th = hr.createEl('th', { cls: `at-c-${k}` + (c === this.edT ? ' is-sel' : '') });
      th.createSpan({ cls: 'at-dot' });
      const n = th.createSpan({ cls: 'at-tname', text: l }); n.onclick = () => { this.edT = c; this.cur.c = c; this.drawEditor(); this.drawGrid(); };
      const m = th.createSpan({ cls: 'at-mute' + (s.mute[c] ? ' is-on' : ''), text: 'M', attr: { 'aria-label': 'Mute' } });
      m.onclick = e => { e.stopPropagation(); s.mute[c] ^= 1; this.drawGrid(); };
      this.vuEls.push(th.createDiv({ cls: 'at-vu' }).createEl('i'));
    });
    this.rowEls = [];
    for (let r = 0; r < AT_ROWS; r++) {
      const tr = t.createEl('tr', { cls: (r % 4 === 0 ? 'is-beat' : '') }); this.rowEls.push(tr);
      tr.createEl('td', { cls: 'at-rn', text: r.toString(16).toUpperCase().padStart(2, '0') });
      P[r].forEach((n, c) => {
        const td = tr.createEl('td', { cls: `at-c-${AT_TRACKS[c][0]}` + (n == null ? '' : n === 'off' ? ' is-off' : ' is-n') + (this.cur.r === r && this.cur.c === c ? ' is-cur' : ''), text: atCell(n) });
        td.onclick = () => { this.cur.r = r; this.cur.c = c; this.contentEl.focus(); this.drawGrid(); };
        td.ondblclick = () => { this.cur.r = r; this.cur.c = c; P[r][c] = P[r][c] == null ? AT_DEF_NOTE[AT_TRACKS[c][0]] : null; this.preview(c, P[r][c]); this.changed(); this.drawGrid(); };
      });
    }
    this.drawPH();
  }
  drawPH() {
    if (!this.rowEls) return;
    const show = this.playingHere() && this.song.order[this.phOrd] === this.cur.p;
    this.rowEls.forEach((tr, i) => tr.toggleClass('is-ph', show && i === this.ph));
  }

  /* ---------- playing ---------- */
  togglePlay() {
    const P = this.plugin.player;
    if (this.playingHere()) P.stop(); else this.plugin.play(this.song, this);
  }
  onPlayer(ev, a, b, hits) {
    if (ev === 'play' || ev === 'stop') { if (ev === 'stop') { this.ph = -1; this.phOrd = -1; } this.drawPlay(); this.drawTimeline(); this.drawPH(); return; }
    if (ev !== 'step' || this.plugin.player.owner !== this) return;
    if (a !== this.phOrd) { this.phOrd = a; if (this.follow && this.song.order[a] !== this.cur.p) { this.cur.p = this.song.order[a]; this.drawPats(); this.drawGrid(); } }
    this.ph = b; this.drawPH(); this.drawTimeline();
    hits.forEach((h, c) => { if (h) this.vu[c] = 1; }); if (hits[0]) this.glow = 1;
    if (!this.vuLoop) { this.vuLoop = true; const fade = () => { this.vu = this.vu.map(v => v * 0.86); this.glow *= 0.9;
      (this.vuEls || []).forEach((e, c) => e.setCssStyles({ width: this.vu[c] * 100 + '%' }));
      this.containerEl.setCssProps({ '--at-pulse': this.glow.toFixed(3) });
      if (this.playingHere() || this.vu.some(v => v > 0.02)) window.requestAnimationFrame(fade); else this.vuLoop = false; };
      window.requestAnimationFrame(fade); }
  }
  preview(c, n) { if (n == null || n === 'off') return; this.plugin.player.preview(this.song, c, n); }

  /* ---------- keys ---------- */
  key(e) {
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase(), s = this.song; if (!s) return;
    const P = s.pats[this.cur.p], R = AT_ROWS, C = AT_TRACKS.length;
    const i1 = AT_KEYS.indexOf(k), i2 = AT_KEYS2.indexOf(k);
    let m = null;
    if (i1 >= 0) m = (this.oct + 1) * 12 + i1; else if (i2 >= 0) m = (this.oct + 2) * 12 + i2;
    if (m != null) { P[this.cur.r][this.cur.c] = m; this.preview(this.cur.c, m); this.cur.r = (this.cur.r + 1) % R; }
    else if (k === '1') { P[this.cur.r][this.cur.c] = 'off'; this.cur.r = (this.cur.r + 1) % R; }
    else if (k === 'delete' || k === 'backspace' || k === '.') P[this.cur.r][this.cur.c] = null;
    else if (k === 'arrowdown') { this.cur.r = (this.cur.r + 1) % R; e.preventDefault(); this.drawGrid(); return; }
    else if (k === 'arrowup') { this.cur.r = (this.cur.r + R - 1) % R; e.preventDefault(); this.drawGrid(); return; }
    else if (k === 'arrowright') { this.cur.c = (this.cur.c + 1) % C; e.preventDefault(); this.drawGrid(); return; }
    else if (k === 'arrowleft') { this.cur.c = (this.cur.c + C - 1) % C; e.preventDefault(); this.drawGrid(); return; }
    else if (k === ' ') { e.preventDefault(); this.togglePlay(); return; }
    else if (k === '+' || k === '=') { this.oct = Math.min(6, this.oct + 1); this.octSel.value = String(this.oct); return; }
    else if (k === '-') { this.oct = Math.max(2, this.oct - 1); this.octSel.value = String(this.oct); return; }
    else return;
    e.preventDefault(); this.changed(); this.drawGrid();
  }

  diceDrums() {
    const P = this.song.pats[this.cur.p], R = Math.random;
    for (let r = 0; r < AT_ROWS; r++) {
      P[r][0] = (r % 4 === 0 || (R() < 0.18 && r % 2 === 0)) ? 36 : null;
      P[r][1] = (r === 4 || r === 12 || R() < 0.08) ? 50 : null;
      P[r][2] = r % 2 === 0 ? (R() < 0.15 ? 80 : 78) : (R() < 0.3 ? 78 : null);
    }
    this.changed(); this.drawGrid(); new Notice('New groove 🎲');
  }
  async copy() { await navigator.clipboard.writeText('```tracker\n' + atToText(this.song) + '```\n'); new Notice('Aurora Tracker: song copied as text.'); }

  /* ---------- the instrument panel ---------- */
  drawEditor() {
    const s = this.song, c = this.edT, k = AT_TRACKS[c][0], I = s.inst[c];
    this.chipsEl.empty();
    AT_TRACKS.forEach(([kk, l], i) => {
      const b = this.chipsEl.createEl('button', { cls: `at-c-${kk}` + (i === c ? ' is-on' : '') });
      b.createEl('i'); b.appendText(l);
      b.onclick = () => { this.edT = i; this.cur.c = i; this.drawEditor(); this.drawGrid(); };
    });
    const el = this.instEl; el.empty();
    const head = el.createDiv({ cls: 'at-ed-head' });
    const sel = head.createEl('select', { cls: 'dropdown' });
    for (const n of Object.keys(AT_PRESETS[k])) sel.createEl('option', { text: AT_PNAME[n] || n, value: n });
    if (I.preset === 'custom') sel.createEl('option', { text: 'Custom', value: 'custom' });
    sel.value = I.preset;
    if (I.preset === 'sid') head.createSpan({ cls: 'at-sidtag', text: 'C64' });
    sel.onchange = () => { if (sel.value === 'custom') return; I.preset = sel.value; I.p = Object.assign({ oct: I.p.oct || 0 }, AT_PRESETS[k][I.preset]); this.changed(); this.drawEditor(); this.tryIt(); };
    const fmt = (v, st, key) => key === 'oct' ? (v > 0 ? '+' : '') + Math.round(v) : st >= 1 ? String(Math.round(v)) : v < 1 ? v.toFixed(st < 0.01 ? 3 : 2) : v.toFixed(1);
    const knob = (label, build) => { const d = el.createDiv({ cls: 'at-knob' }); d.createSpan({ text: label }); return build(d); };
    knob('Volume', d => { const r = d.createEl('input', { attr: { type: 'range', min: 0, max: 100, value: Math.round(s.vol[c] * 100) } }); const v = d.createSpan({ cls: 'at-kv', text: String(Math.round(s.vol[c] * 100)) });
      r.oninput = () => { s.vol[c] = r.value / 100; v.setText(r.value); this.changed(); }; });
    let tryT;
    for (const [key, label, min, max, st] of AT_KNOBS[k]) {
      if (key === 'wave' || key === 'arp') {
        knob(label, d => { const sl = d.createEl('select', { cls: 'dropdown' }); (key === 'wave' ? AT_WAVES : Object.keys(AT_ARPS)).forEach(w => sl.createEl('option', { text: w, value: w })); sl.value = I.p[key];
          d.createSpan(); sl.onchange = () => { I.p[key] = sl.value; I.preset = 'custom'; this.changed(); this.drawEditor(); this.tryIt(); }; });
        continue;
      }
      if ((key === 'pw' || key === 'pwm') && I.p.wave !== 'pulse') continue;
      knob(label, d => {
        const r = d.createEl('input', { attr: { type: 'range', min, max, step: st, value: I.p[key] ?? 0 } });
        const v = d.createSpan({ cls: 'at-kv', text: fmt(+(I.p[key] ?? 0), st, key) });
        r.oninput = () => { I.p[key] = +r.value; if (key !== 'oct') I.preset = I.preset === 'custom' ? 'custom' : I.preset; v.setText(fmt(+r.value, st, key)); this.changed(); clearTimeout(tryT); tryT = window.setTimeout(() => this.tryIt(), 180); };
      });
    }
    const btns = el.createDiv({ cls: 'at-ed-btns' });
    btns.createEl('button', { text: '▶ Try', cls: 'mod-cta' }).onclick = () => this.tryIt();
    btns.createEl('button', { text: '🎲 Dice the sound' }).onclick = () => {
      for (const [key, , min, max, st] of AT_KNOBS[k]) {
        if (min == null || key === 'oct') continue;
        const span = (max - min) * 0.25; let nv = (I.p[key] ?? min) + (Math.random() * 2 - 1) * span;
        I.p[key] = Math.max(min, Math.min(max, Math.round(nv / st) * st));
      }
      if (AT_KNOBS[k].some(x => x[0] === 'arp') && Math.random() < 0.2) I.p.arp = Object.keys(AT_ARPS)[Math.floor(Math.random() * 6)];
      I.preset = 'custom'; this.changed(); this.drawEditor(); this.tryIt();
    };
    btns.createEl('button', { text: 'Reset' }).onclick = () => { const base = AT_PRESETS[k][I.preset] ? I.preset : Object.keys(AT_PRESETS[k])[0]; I.preset = base; I.p = Object.assign({ oct: I.p.oct || 0 }, AT_PRESETS[k][base]); this.changed(); this.drawEditor(); this.tryIt(); };
  }
  tryIt() {
    const c = this.edT, k = AT_TRACKS[c][0], n = AT_DEF_NOTE[k], P = this.plugin.player;
    P.audio(); const t = P.ctx.currentTime + 0.02;
    if (!atTonal(c)) { P.bus.trig(this.song, c, n, t, 0, this.song.vol[c]); P.bus.trig(this.song, c, n, t + 0.25, 0, this.song.vol[c] * 0.8); }
    else { P.bus.trig(this.song, c, n, t, k === 'pad' ? 1.2 : 0.35, this.song.vol[c]); if (k !== 'pad') P.bus.trig(this.song, c, n + 7, t + 0.4, 0.35, this.song.vol[c]); }
  }
}

/* ---------- the tracker block inside a note ---------- */
function atBlock(text) {
  const m = String(text).match(/```tracker[^\n]*\n([\s\S]*?)```/);
  return m ? { body: m[1], index: m.index, length: m[0].length } : null;
}
function atReplaceBlock(text, body) {
  const b = atBlock(text), block = '```tracker\n' + body + '```';
  if (!b) return text.replace(/\s*$/, '') + (text.trim() ? '\n\n' : '') + block + '\n';
  return text.slice(0, b.index) + block + text.slice(b.index + b.length);
}

class ATImportModal extends Modal {
  constructor(app, plugin) { super(app); this.plugin = plugin; }
  onOpen() {
    this.setTitle('Import a song');
    const c = this.contentEl;
    c.createEl('p', { cls: 'at-small', text: 'Paste a song (the text from Copy, with or without the ```tracker lines). It becomes a new song note.' });
    const ta = c.createEl('textarea', { cls: 'at-import' });
    const row = c.createDiv({ cls: 'modal-button-container' });
    row.createEl('button', { text: 'Cancel' }).onclick = () => this.close();
    row.createEl('button', { text: 'Import', cls: 'mod-cta' }).onclick = async () => {
      if (!/pattern\s+[A-D]/i.test(ta.value)) { new Notice("That doesn't look like a song: it needs at least one pattern."); return; }
      const song = atFromText(ta.value);
      this.close();
      await this.plugin.newSong(null, song);
    };
    window.setTimeout(() => ta.focus(), 50);
  }
  onClose() { this.contentEl.empty(); }
}
