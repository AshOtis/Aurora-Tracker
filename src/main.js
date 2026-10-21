/* Aurora Tracker: a small tracker for making music in Obsidian. Songs are plain text in your notes. */

const AT_SET = { folder: 'Songs', exportFolder: '', alongside: false, themeSync: true, bg: true, glow: 35, dim: 50 };
const AT_THEME = ['249, 115, 22', '236, 72, 153', '94, 234, 212'];   // kick, snare, lead

class AuroraTracker extends Plugin {
  async onload() {
    this.set = Object.assign({}, AT_SET, await this.loadData());
    this.player = new ATPlayer();
    this.registerView(AT_VIEW, leaf => new ATView(leaf, this));
    this.addRibbonIcon('audio-waveform', 'Aurora Tracker', () => this.openFromHere());
    this.addCommand({ id: 'new-song', name: 'New song', callback: () => this.newSong() });
    this.addCommand({ id: 'demo-song', name: 'Open the demo song', callback: () => this.newSong(null, atFromText(AT_DEMO)) });
    this.addCommand({ id: 'import-song', name: 'Import a song from text', callback: () => new ATImportModal(this.app, this).open() });
    this.addCommand({ id: 'open-song', name: 'Open this note in Aurora Tracker', checkCallback: check => {
      const f = this.app.workspace.getActiveFile(); if (!f || f.extension !== 'md') return false;
      if (!check) this.openSong(f); return true; } });
    this.addCommand({ id: 'stop', name: 'Stop playing', callback: () => this.player.stop() });
    this.addSettingTab(new ATSettings(this.app, this));
    this.registerEvent(this.app.workspace.on('file-menu', (menu, file) => {
      if (file && file.extension === 'md') menu.addItem(i => i.setTitle('Open in Aurora Tracker').setIcon('audio-waveform').onClick(() => this.openSong(file)));
    }));

    // a small player wherever a ```tracker block appears
    this.registerMarkdownCodeBlockProcessor('tracker', (src, el, ctx) => {
      const child = new ATMini(el, this, src, ctx.sourcePath); ctx.addChild(child);
    });

    // one player at a time across the AshOtis players, and colouring the Static Aurora theme
    this.registerEvent(this.app.workspace.on('ashotis:playing', src => { if (src !== 'aurora-tracker' && !this.set.alongside) this.player.stop(); }));
    this.player.on(ev => {
      if (ev === 'play') { this.app.workspace.trigger('ashotis:playing', 'aurora-tracker'); this.theme(true); }
      if (ev === 'stop') { this.app.workspace.trigger('ashotis:stopped', 'aurora-tracker'); this.theme(false); }
    });
    this.registerInterval(window.setInterval(() => { if (this.player.playing) this.theme(true); }, 1000));
  }
  onunload() { this.player.stop(); this.theme(false); if (this.player.ctx) this.player.ctx.close(); }
  save() { return this.saveData(this.set); }

  play(song, owner) { this.player.play(song, owner); }

  // claim the Static Aurora colours while playing (the platform convention: data-sa-owner="id:time")
  theme(on) {
    const body = document.body, owner = (body.dataset.saOwner || '').split(':');
    if (on && this.set.themeSync) {
      if (owner[0] && owner[0] !== 'aurora-tracker' && Date.now() - Number(owner[1]) < 3000) return;
      body.dataset.saOwner = 'aurora-tracker:' + Date.now();
      if (!this.themed) { AT_THEME.forEach((c, i) => body.style.setProperty(`--sa-c${i + 1}`, `rgb(${c})`)); this.themed = true; }
    } else if (this.themed) {
      if (owner[0] === 'aurora-tracker') { delete body.dataset.saOwner; [1, 2, 3].forEach(i => body.style.removeProperty(`--sa-c${i}`)); }
      this.themed = false;
    }
  }

  /* ---------- songs as notes ---------- */
  async openFromHere() {
    const f = this.app.workspace.getActiveFile();
    if (f && f.extension === 'md' && atBlock(await this.app.vault.cachedRead(f))) return this.openSong(f);
    const leaf = this.app.workspace.getLeavesOfType(AT_VIEW)[0];
    if (leaf) return this.app.workspace.revealLeaf(leaf);
    return this.newSong();
  }
  async openSong(file) {
    const text = await this.app.vault.read(file);
    if (!atBlock(text)) { const s = atNewSong(file.basename); await this.app.vault.process(file, t => atReplaceBlock(t, atToText(s))); }
    let leaf = this.app.workspace.getLeavesOfType(AT_VIEW).find(l => l.view.file && l.view.file.path === file.path);
    if (!leaf) { leaf = this.app.workspace.getLeaf('tab'); await leaf.setViewState({ type: AT_VIEW, active: true, state: { file: file.path } }); }
    this.app.workspace.revealLeaf(leaf);
  }
  async newSong(leaf, song) {
    song = song || atNewSong('New song');
    const folder = (this.set.folder || '').replace(/^\/+|\/+$/g, '');
    if (folder && !this.app.vault.getAbstractFileByPath(folder)) await this.app.vault.createFolder(folder);
    const safe = song.title.replace(/[\\/:*?"<>|#^[\]]/g, '').trim() || 'Song';
    let path = (folder ? folder + '/' : '') + safe + '.md', i = 2;
    while (this.app.vault.getAbstractFileByPath(path)) path = (folder ? folder + '/' : '') + `${safe} ${i++}.md`;
    const file = await this.app.vault.create(path, `# ${song.title}\n\n\`\`\`tracker\n${atToText(song)}\`\`\`\n`);
    const l = leaf || this.app.workspace.getLeaf('tab');
    await l.setViewState({ type: AT_VIEW, active: true, state: { file: file.path } });
    this.app.workspace.revealLeaf(l);
    return file;
  }

  /* ---------- exports, saved into the vault ---------- */
  async exportPath(song, file, ext) {
    const folder = (this.set.exportFolder || (file && file.parent ? file.parent.path : '') || '').replace(/^\/+|\/+$/g, '');
    if (folder && folder !== '/' && !this.app.vault.getAbstractFileByPath(folder)) await this.app.vault.createFolder(folder);
    const base = (song.title.replace(/[\\/:*?"<>|#^[\]]/g, '').trim() || 'Song');
    const pre = folder && folder !== '/' ? folder + '/' : '';
    let path = `${pre}${base}.${ext}`, i = 2;
    while (this.app.vault.getAbstractFileByPath(path)) path = `${pre}${base} ${i++}.${ext}`;
    return path;
  }
  async exportWav(song, file) {
    const n = new Notice('Aurora Tracker: rendering…', 0);
    try {
      const { data, seconds } = await atRenderWav(song);
      const path = await this.exportPath(song, file, 'wav');
      await this.app.vault.createBinary(path, data);
      n.hide(); new Notice(`Aurora Tracker: saved ${path} (${seconds.toFixed(1)} s)`);
    } catch (e) { n.hide(); new Notice('Aurora Tracker: could not render the song. ' + (e.message || e)); }
  }
  async exportMidi(song, file) {
    const path = await this.exportPath(song, file, 'mid');
    const bytes = atMidi(song);
    await this.app.vault.createBinary(path, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    new Notice(`Aurora Tracker: saved ${path}`);
  }
}

/* ---------- the player inside a note ---------- */
class ATMini extends MarkdownRenderChild {
  constructor(el, plugin, src, path) { super(el); this.plugin = plugin; this.src = src; this.path = path; }
  onload() {
    const song = this.song = atFromText(this.src), el = this.containerEl, P = this.plugin.player;
    el.addClass('at-mini');
    const row = el.createDiv({ cls: 'at-mini-row' });
    this.btn = row.createEl('button', { cls: 'at-mini-play', attr: { 'aria-label': 'Play' } });
    const t = row.createDiv({ cls: 'at-mini-t' });
    t.createDiv({ cls: 'at-mini-title', text: song.title });
    const secs = song.order.length * AT_ROWS * atStepDur(song);
    t.createDiv({ cls: 'at-mini-sub', text: `${song.bpm} BPM · ${song.order.length} pattern${song.order.length === 1 ? '' : 's'} · ${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}` });
    row.createEl('button', { text: 'Edit', cls: 'at-mini-edit' }).onclick = () => {
      const f = this.plugin.app.vault.getAbstractFileByPath(this.path); if (f) this.plugin.openSong(f);
    };
    this.bars = el.createDiv({ cls: 'at-mini-bars' });
    song.order.forEach(p => { const b = this.bars.createDiv({ cls: 'at-bar' }); b.createEl('i'); b.createSpan({ text: p }); });
    const me = this;
    this.btn.onclick = () => { if (P.playing && P.owner === me) P.stop(); else this.plugin.play(this.song, me); };
    this.off = P.on((ev, oi, r) => this.update(ev, oi, r));
    this.update();
  }
  onunload() { if (this.off) this.off(); if (this.plugin.player.owner === this) this.plugin.player.stop(); }
  update(ev, oi, r) {
    const P = this.plugin.player, mine = P.playing && P.owner === this;
    this.btn.setText(mine ? '■' : '▶');
    const bars = Array.from(this.bars.children);
    bars.forEach((b, i) => {
      b.toggleClass('is-done', mine && ev === 'step' && i < oi);
      b.toggleClass('is-now', mine && ev === 'step' && i === oi);
      b.querySelector('i').setCssStyles({ width: mine && ev === 'step' && i === oi ? ((r + 1) / AT_ROWS * 100) + '%' : '0%' });
    });
  }
}

/* ---------- settings ---------- */
class ATSettings extends PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }
  display() {
    const el = this.containerEl, p = this.plugin, s = p.set;
    el.empty();
    new Setting(el).setName('Songs folder').setDesc('Where new songs are saved as notes.')
      .addText(t => t.setPlaceholder('Songs').setValue(s.folder).onChange(v => { s.folder = v.trim(); p.save(); }));
    new Setting(el).setName('Exports folder').setDesc('Where WAV and MIDI files go. Leave empty to save them next to the song.')
      .addText(t => t.setPlaceholder('next to the song').setValue(s.exportFolder).onChange(v => { s.exportFolder = v.trim(); p.save(); }));
    new Setting(el).setName('Play alongside other players').setDesc('Keep playing when Static FM, Hi-Fi Tuner, Aurora MP3 or another AshOtis player starts.')
      .addToggle(t => t.setValue(s.alongside).onChange(v => { s.alongside = v; p.save(); }));
    new Setting(el).setName('Colour the Static Aurora theme').setDesc('While a song plays, the theme glows in the tracker\'s colours.')
      .addToggle(t => t.setValue(s.themeSync).onChange(v => { s.themeSync = v; p.save(); if (!v) p.theme(false); }));
    new Setting(el).setName('Aurora background').setDesc('A drifting aurora behind the editor that pulses with the kick. It uses the Static Aurora colours when that theme is on.')
      .addToggle(t => t.setValue(s.bg).onChange(v => { s.bg = v; p.save(); this.redraw(); this.display(); }));
    if (s.bg) {
      new Setting(el).setName('Glow').addSlider(sl => sl.setLimits(10, 100, 5).setValue(s.glow).setDynamicTooltip().onChange(v => { s.glow = v; p.save(); this.redraw(); }));
      new Setting(el).setName('Darken').addSlider(sl => sl.setLimits(0, 90, 5).setValue(s.dim).setDynamicTooltip().onChange(v => { s.dim = v; p.save(); this.redraw(); }));
    }
  }
  redraw() { this.app.workspace.getLeavesOfType(AT_VIEW).forEach(l => l.view.paintBg && l.view.paintBg()); }
}
