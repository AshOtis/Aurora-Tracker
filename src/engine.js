/* Aurora Tracker: the song, its text format, and the sound engine. No samples: every sound is synthesis. */

const AT_TRACKS = [['kick', 'Kick'], ['snare', 'Snare'], ['hat', 'Hat'], ['bass', 'Bass'], ['lead', 'Lead'], ['pad', 'Pad']];
const AT_ROWS = 16;
const AT_PATS = ['A', 'B', 'C', 'D'];
const AT_NAMES = ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-'];
const AT_DEF_NOTE = { kick: 36, snare: 50, hat: 78, bass: 45, lead: 69, pad: 57 };
const atNoteName = m => AT_NAMES[m % 12] + (Math.floor(m / 12) - 1);
const atParseNote = s => { const i = AT_NAMES.indexOf(s.slice(0, 2)); return i < 0 ? null : i + 12 * (+s[2] + 1); };
const atCell = n => n == null ? '···' : n === 'off' ? '===' : atNoteName(n);
const atEmpty = () => Array.from({ length: AT_ROWS }, () => Array(AT_TRACKS.length).fill(null));

const AT_PRESETS={
 kick:{boom:{pitch:120,drop:40,decay:.8,click:.25,fm:.5},punch:{pitch:170,drop:50,decay:.35,click:.6,fm:1.2},lofi:{pitch:110,drop:45,decay:.45,click:.1,fm:2.5},sid:{pitch:180,drop:45,decay:.3,click:.8,fm:0,sid:1}},
 snare:{snare:{tone:190,noise:.85,decay:.2,fm:1.6,color:2200,claps:1},clap:{tone:0,noise:1,decay:.28,fm:0,color:1400,claps:4},rim:{tone:420,noise:.25,decay:.05,fm:3,color:3200,claps:1},sid:{tone:220,noise:.9,decay:.18,fm:0,color:5000,claps:1,sid:1}},
 hat:{closed:{decay:.06,metal:.6,noise:.5,color:7000},shaker:{decay:.09,metal:0,noise:.9,color:5000},ride:{decay:.9,metal:1,noise:.25,color:4500},sid:{decay:.05,metal:0,noise:1,color:9000,sid:1}},
 bass:{saw:{wave:'sawtooth',cutoff:1600,reso:6,env:.85,decay:.25,fm:0,pw:.5,pwm:0,arp:'off'},sub:{wave:'sine',cutoff:700,reso:0,env:0,decay:.6,fm:0,pw:.5,pwm:0,arp:'off'},fm:{wave:'sine',cutoff:3000,reso:0,env:.3,decay:.3,fm:2.5,pw:.5,pwm:0,arp:'off'},acid:{wave:'sawtooth',cutoff:3200,reso:18,env:.95,decay:.18,fm:0,pw:.5,pwm:0,arp:'off'},sid:{wave:'pulse',cutoff:2400,reso:8,env:.5,decay:.3,fm:0,pw:.3,pwm:.5,arp:'off'}},
 lead:{square:{wave:'square',cutoff:2600,attack:.01,release:.15,vibrato:.6,delay:.5,fm:0,pw:.5,pwm:0,arp:'off'},pluck:{wave:'triangle',cutoff:5000,attack:.002,release:.08,vibrato:0,delay:.4,fm:0,pw:.5,pwm:0,arp:'off',pluck:1},bell:{wave:'sine',cutoff:8000,attack:.002,release:.8,vibrato:0,delay:.6,fm:3.5,pw:.5,pwm:0,arp:'off'},chip:{wave:'square',cutoff:12000,attack:.001,release:.05,vibrato:.3,delay:.2,fm:0,pw:.5,pwm:0,arp:'off'},sid:{wave:'pulse',cutoff:3500,attack:.003,release:.2,vibrato:.5,delay:.35,fm:0,pw:.25,pwm:.7,arp:'off'}},
 pad:{warm:{wave:'sawtooth',cutoff:900,attack:.5,release:.8,detune:7,shimmer:0,pw:.5,pwm:0,arp:'off'},glass:{wave:'sine',cutoff:6000,attack:.3,release:1.2,detune:3,shimmer:2,pw:.5,pwm:0,arp:'off'},choir:{wave:'triangle',cutoff:1800,attack:.6,release:1,detune:12,shimmer:.5,pw:.5,pwm:0,arp:'off'},sid:{wave:'pulse',cutoff:2800,attack:.01,release:.3,detune:0,shimmer:0,pw:.4,pwm:.6,arp:'major'}}};
const AT_PNAME={boom:'Boom (808)',punch:'Punch',lofi:'Lo-fi',sid:'SID (C64)',snare:'Snare',clap:'Clap',rim:'Rim',closed:'Closed',shaker:'Shaker',ride:'Ride',saw:'Saw',sub:'Sub',fm:'FM',acid:'Acid',square:'Square',pluck:'Pluck',bell:'FM bell',chip:'Chip (8-bit)',warm:'Warm',glass:'Glass',choir:'Choir'};
const AT_WAVES=['sine','triangle','sawtooth','square','pulse'];
const AT_ARPS={off:[0],major:[0,4,7],minor:[0,3,7],octave:[0,12],power:[0,7,12],sus:[0,5,7]};
// [key, label, min, max, step]   (wave and arp are dropdowns)
const AT_KNOBS={
 kick:[['pitch','Pitch',60,240,1],['drop','Drop to',25,90,1],['decay','Decay',.05,1.5,.01],['click','Click',0,1,.01],['fm','FM grit',0,4,.05]],
 snare:[['tone','Body',0,500,1],['noise','Noise',0,1,.01],['decay','Decay',.03,.6,.01],['fm','FM',0,5,.05],['color','Colour',600,8000,10],['claps','Claps',1,5,1]],
 hat:[['decay','Decay',.02,1.2,.01],['metal','Metal',0,1,.01],['noise','Noise',0,1,.01],['color','Colour',2000,12000,50]],
 bass:[['oct','Octave',-3,2,1],['wave','Wave'],['cutoff','Cutoff',100,6000,10],['reso','Resonance',0,25,.1],['env','Filter env',0,1,.01],['decay','Decay',.05,1.2,.01],['fm','FM',0,6,.05],['pw','Pulse width',.05,.95,.01],['pwm','PWM',0,1,.01],['arp','Arpeggio']],
 lead:[['oct','Octave',-3,2,1],['wave','Wave'],['cutoff','Cutoff',300,12000,10],['attack','Attack',.001,.5,.001],['release','Release',.02,1.5,.01],['vibrato','Vibrato',0,1,.01],['delay','Echo',0,1,.01],['fm','FM',0,6,.05],['pw','Pulse width',.05,.95,.01],['pwm','PWM',0,1,.01],['arp','Arpeggio']],
 pad:[['oct','Octave',-3,2,1],['wave','Wave'],['cutoff','Cutoff',200,8000,10],['attack','Attack',.01,2,.01],['release','Release',.05,3,.01],['detune','Detune',0,30,.5],['shimmer','Shimmer',0,4,.05],['pw','Pulse width',.05,.95,.01],['pwm','PWM',0,1,.01],['arp','Arpeggio']]};
function atDefaultInst() {
  return AT_TRACKS.map(([k]) => { const n = Object.keys(AT_PRESETS[k])[0]; return { preset: n, p: Object.assign({}, AT_PRESETS[k][n]) }; });
}
function atNewSong(title) {
  const s = { title: title || 'Untitled', bpm: 112, swing: 10, order: ['A'], pats: { A: atEmpty(), B: atEmpty(), C: atEmpty(), D: atEmpty() },
    vol: [0.9, 0.7, 0.5, 0.8, 0.55, 0.45], mute: [0, 0, 0, 0, 0, 0], inst: atDefaultInst() };
  s.inst[3].p.oct = -1;
  // a beat to start from
  for (let r = 0; r < AT_ROWS; r += 4) s.pats.A[r][0] = 36;
  s.pats.A[4][1] = 50; s.pats.A[12][1] = 50;
  for (let r = 2; r < AT_ROWS; r += 4) s.pats.A[r][2] = 78;
  return s;
}

// the demo song, "Ferry at six"
const AT_DEMO = "title: Ferry at six\nbpm: 112\nswing: 12\ntracks: kick snare hat bass lead pad\nvolume: 90 70 50 80 55 45\norder: A A B A C B\nsound kick: boom pitch=120 drop=40 decay=0.8 click=0.25 fm=0.5\nsound snare: snare tone=190 noise=0.85 decay=0.2 fm=1.6 color=2200 claps=1\nsound hat: closed decay=0.06 metal=0.6 noise=0.5 color=7000\nsound bass: saw wave=sawtooth cutoff=1600 reso=6 env=0.85 decay=0.25 fm=0 pw=0.5 pwm=0 arp=off oct=-1\nsound lead: sid wave=pulse cutoff=3500 attack=0.003 release=0.2 vibrato=0.5 delay=0.35 fm=0 pw=0.25 pwm=0.7 arp=off\nsound pad: warm wave=sawtooth cutoff=900 attack=0.5 release=0.8 detune=7 shimmer=0 pw=0.5 pwm=0 arp=off\n\npattern A\n00 | C-2 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 A-2 \u00b7\u00b7\u00b7 A-3\n01 | \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7\n02 | \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 F#5 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7\n03 | \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 A-2 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7\n04 | C-2 D-3 F#5 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7\n05 | \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7\n06 | \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 F#5 E-3 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7\n07 | \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7\n08 | C-2 \u00b7\u00b7\u00b7 F#5 G-2 \u00b7\u00b7\u00b7 G-3\n09 | \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7\n0A | C-2 \u00b7\u00b7\u00b7 F#5 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7\n0B | \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 G-2 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7\n0C | C-2 D-3 F#5 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7\n0D | \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7\n0E | \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 F#5 D-3 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7\n0F | \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7\n\npattern B\n00 | C-2 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 F-2 \u00b7\u00b7\u00b7 F-3\n01 | \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7\n02 | \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 F#5 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7\n03 | \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 F-2 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7\n04 | C-2 D-3 F#5 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7\n05 | \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7\n06 | \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 F#5 C-3 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7\n07 | C-2 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7\n08 | C-2 \u00b7\u00b7\u00b7 F#5 G-2 \u00b7\u00b7\u00b7 G-3\n09 | \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7\n0A | \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 F#5 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7\n0B | \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 G-2 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7\n0C | C-2 D-3 F#5 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7\n0D | \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7\n0E | \u00b7\u00b7\u00b7 D-3 F#5 B-2 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7\n0F | \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7\n\npattern C\n00 | C-2 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 A-2 A-4 A-3\n01 | \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7\n02 | \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 F#5 \u00b7\u00b7\u00b7 C-5 \u00b7\u00b7\u00b7\n03 | \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 F#5 A-2 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7\n04 | C-2 D-3 F#5 \u00b7\u00b7\u00b7 E-5 \u00b7\u00b7\u00b7\n05 | \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7\n06 | \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 F#5 E-3 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7\n07 | \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 D-5 \u00b7\u00b7\u00b7\n08 | C-2 \u00b7\u00b7\u00b7 F#5 G-2 \u00b7\u00b7\u00b7 C-4\n09 | \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7\n0A | \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 F#5 \u00b7\u00b7\u00b7 C-5 \u00b7\u00b7\u00b7\n0B | \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 G-2 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7\n0C | C-2 D-3 F#5 \u00b7\u00b7\u00b7 B-4 \u00b7\u00b7\u00b7\n0D | \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7\n0E | \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 F#5 D-3 === \u00b7\u00b7\u00b7\n0F | \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7 \u00b7\u00b7\u00b7\n";

/* ---------- the text format ---------- */
function atToText(song) {
  let t = `title: ${song.title}\nbpm: ${song.bpm}\nswing: ${song.swing}\ntracks: ${AT_TRACKS.map(x => x[0]).join(' ')}\n` +
    `volume: ${song.vol.map(v => Math.round(v * 100)).join(' ')}\norder: ${song.order.join(' ')}\n`;
  song.inst.forEach((I, c) => {
    t += `sound ${AT_TRACKS[c][0]}: ${I.preset} ` + Object.entries(I.p).map(([k, v]) => `${k}=${typeof v === 'number' ? +v.toFixed(3) : v}`).join(' ') + '\n';
  });
  for (const p of AT_PATS) {
    const P = song.pats[p];
    if (!P.some(r => r.some(n => n != null)) && !song.order.includes(p)) continue;
    t += `\npattern ${p}\n`;
    P.forEach((row, r) => t += r.toString(16).toUpperCase().padStart(2, '0') + ' | ' + row.map(atCell).join(' ') + '\n');
  }
  return t;
}
function atFromText(text) {
  const s = atNewSong(); s.title = 'Untitled'; s.order = []; s.pats = { A: atEmpty(), B: atEmpty(), C: atEmpty(), D: atEmpty() }; s.inst = atDefaultInst();
  let p = null;
  for (const raw of String(text || '').replace(/```\w*/g, '').split('\n')) {
    const l = raw.trim(); if (!l) continue;
    let m;
    if ((m = l.match(/^title:\s*(.*)$/i))) s.title = m[1].trim() || 'Untitled';
    else if ((m = l.match(/^bpm:\s*(\d+)/i))) s.bpm = Math.max(40, Math.min(240, +m[1]));
    else if ((m = l.match(/^swing:\s*(\d+)/i))) s.swing = Math.min(60, +m[1]);
    else if ((m = l.match(/^volume:\s*(.*)$/i))) m[1].split(/\s+/).forEach((v, i) => { if (i < AT_TRACKS.length && !isNaN(+v)) s.vol[i] = Math.max(0, Math.min(1, +v / 100)); });
    else if ((m = l.match(/^sound\s+(\w+):\s*(\w+)\s*(.*)$/i))) {
      const c = AT_TRACKS.findIndex(x => x[0] === m[1].toLowerCase());
      if (c >= 0) {
        const k = AT_TRACKS[c][0], known = !!AT_PRESETS[k][m[2]], base = known ? m[2] : Object.keys(AT_PRESETS[k])[0];
        const I = { preset: known ? m[2] : 'custom', p: Object.assign({}, AT_PRESETS[k][base]) };
        for (const kv of m[3].split(/\s+/)) { const [a, b] = kv.split('='); if (a && b != null && b !== '') I.p[a] = isNaN(+b) ? b : +b; }
        s.inst[c] = I;
      }
    }
    else if ((m = l.match(/^order:\s*(.*)$/i))) s.order = m[1].split(/\s+/).map(x => x.toUpperCase()).filter(x => AT_PATS.includes(x));
    else if ((m = l.match(/^pattern\s+([A-D])\b/i))) p = m[1].toUpperCase();
    else if (p && (m = l.match(/^([0-9A-F]{2})\s*\|\s*(.*)$/i))) {
      const r = parseInt(m[1], 16); if (r >= AT_ROWS) continue;
      m[2].trim().split(/\s+/).slice(0, AT_TRACKS.length).forEach((cell, c) => {
        s.pats[p][r][c] = cell === '===' ? 'off' : /^[A-G][-#]\d$/.test(cell) ? atParseNote(cell) : null;
      });
    }
  }
  if (!s.order.length) s.order = ['A'];
  return s;
}

/* ---------- the synths ---------- */
let atNoiseBuf = null;
function atNoise(ctx) {
  if (atNoiseBuf && atNoiseBuf.sampleRate === ctx.sampleRate) return atNoiseBuf;
  atNoiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = atNoiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return atNoiseBuf;
}
const atHz = m => 440 * Math.pow(2, (m - 69) / 12);

// pulse wave with a movable width (the SID's signature): two saws, one delayed and flipped
function atPulse(ctx, freq, pw, pwm) {
  const a = ctx.createOscillator(), b = ctx.createOscillator(); a.type = b.type = 'sawtooth'; a.frequency.value = b.frequency.value = freq;
  const inv = ctx.createGain(); inv.gain.value = -1; const d = ctx.createDelay(0.1); const per = 1 / freq; d.delayTime.value = per * pw;
  const out = ctx.createGain(); out.gain.value = 0.6; a.connect(out); b.connect(d).connect(inv).connect(out);
  const nodes = [a, b];
  if (pwm > 0) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 0.8 + pwm * 3; lg.gain.value = per * Math.min(pw, 1 - pw) * 0.9 * pwm; l.connect(lg).connect(d.delayTime); nodes.push(l); }
  return { out, nodes, setFreq: (f, at) => { a.frequency.setValueAtTime(f, at); b.frequency.setValueAtTime(f, at); d.delayTime.setValueAtTime(pw / f, at); } };
}

// One output chain (master, delay) on a context: live playback or an offline render
class ATBus {
  constructor(ctx, level) {
    this.ctx = ctx; this.live = {};
    this.master = ctx.createGain(); this.master.gain.value = level;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.delay = ctx.createDelay(1); const fb = ctx.createGain(), wet = ctx.createGain();
    this.delay.delayTime.value = 0.3; fb.gain.value = 0.32; wet.gain.value = 0.22;
    this.delay.connect(fb).connect(this.delay); this.delay.connect(wet).connect(this.master);
  }
  stopVoice(c, t) {
    const v = this.live[c]; if (!v) return;
    try { v.g.gain.cancelScheduledValues(t); v.g.gain.setTargetAtTime(0, t, 0.04); v.o.forEach(o => o.stop(t + 0.3)); } catch (e) { /* already stopped */ }
    this.live[c] = null;
  }
  stopAll(t) { for (const c in this.live) this.stopVoice(+c, t); }

  // play note m on track c at time t, lasting len seconds (tonal tracks)
  trig(song, c, m, t, len, vol) {
    const ctx = this.ctx, out = this.master, g = ctx.createGain(); g.connect(out);
    const k = AT_TRACKS[c][0], P = song.inst[c].p;
    const fm = (carHz, ratio, index, dec, lvl, dest, type) => {
      const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), eg = ctx.createGain();
      car.type = type || 'sine'; car.frequency.value = carHz; mod.frequency.value = carHz * ratio;
      mg.gain.setValueAtTime(Math.max(1, carHz * index), t); mg.gain.exponentialRampToValueAtTime(1, t + dec);
      mod.connect(mg).connect(car.frequency); car.connect(eg).connect(dest);
      eg.gain.setValueAtTime(lvl, t); eg.gain.exponentialRampToValueAtTime(0.001, t + dec);
      car.start(t); mod.start(t); car.stop(t + dec + 0.05); mod.stop(t + dec + 0.05); return car;
    };
    const noiseHit = (dest, lvl, dec, start) => {
      const n = ctx.createBufferSource(); n.buffer = atNoise(ctx); const ng = ctx.createGain(); n.connect(ng).connect(dest);
      const s = start || t; ng.gain.setValueAtTime(lvl, s); ng.gain.exponentialRampToValueAtTime(0.001, s + dec); n.start(s); n.stop(s + dec + 0.05);
    };
    if (k === 'kick') {
      const p = Math.pow(2, (m - 36) / 12);
      if (P.sid) {
        const po = atPulse(ctx, P.pitch * p, 0.5, 0); const eg = ctx.createGain(); po.out.connect(eg).connect(g);
        po.nodes.forEach(n => { n.start(t); n.stop(t + P.decay + 0.05); });
        for (let i = 0; i < 8; i++) po.setFreq(Math.max(P.drop, P.pitch * p * Math.pow(0.72, i)), t + i * 0.02);
        eg.gain.setValueAtTime(vol * 0.7, t); eg.gain.exponentialRampToValueAtTime(0.001, t + P.decay); noiseHit(g, vol * P.click * 0.6, 0.02); return;
      }
      const body = fm(P.pitch * p, 1.5, P.fm, P.decay, vol, g);
      body.frequency.setValueAtTime(P.pitch * p, t); body.frequency.exponentialRampToValueAtTime(P.drop * p, t + 0.12);
      if (P.click > 0) fm(1200 * p, 2.7, 4, 0.018, vol * 0.35 * P.click, g);
      return;
    }
    if (k === 'snare') {
      const p = Math.pow(2, (m - 50) / 12);
      if (P.tone > 0) fm(P.tone * p, 2.3, P.fm, 0.12, vol * 0.55, g, P.sid ? 'square' : 'triangle');
      const f = ctx.createBiquadFilter(); f.type = P.sid ? 'highpass' : 'bandpass'; f.frequency.value = P.color * p; f.Q.value = 0.7; f.connect(g);
      const n = Math.max(1, Math.round(P.claps)); for (let i = 0; i < n; i++) noiseHit(f, vol * P.noise, i < n - 1 ? 0.012 : P.decay, t + i * 0.011);
      return;
    }
    if (k === 'hat') {
      const open = m % 12 === 6 || m % 12 === 8, dec = open ? Math.max(P.decay, 0.3) : P.decay, p = Math.pow(2, (m - 78) / 24);
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = P.color * p; hp.connect(g);
      if (P.metal > 0) for (const [hz, r] of [[540, 1.483], [800, 1.637], [1180, 2.414]]) fm(hz * p, r, 6, dec, vol * 0.12 * P.metal, hp, 'square');
      noiseHit(hp, vol * 0.4 * P.noise, dec);
      return;
    }
    // tonal tracks: one voice at a time per track
    this.stopVoice(c, t);
    m += 12 * (P.oct || 0);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = P.reso || 0; f.connect(g);
    const os = [], extra = [], base = atHz(m);
    const steps = AT_ARPS[P.arp] || [0], arp = steps.length > 1;
    const count = k === 'pad' && !arp ? 3 : 1, voices = [];
    for (let i = 0; i < count; i++) {
      const det = count > 1 ? [-1, 1, 0][i] * (P.detune || 0) : 0;
      if (P.wave === 'pulse') { const po = atPulse(ctx, base, P.pw, P.pwm); po.out.connect(f); po.nodes.forEach(n => os.push(n)); voices.push(po); }
      else { const o = ctx.createOscillator(); o.type = AT_WAVES.includes(P.wave) ? P.wave : 'sawtooth'; o.frequency.value = base; o.detune.value = det; o.connect(f); os.push(o); voices.push({ setFreq: (fr, at) => o.frequency.setValueAtTime(fr, at), osc: o }); }
    }
    const fmAmt = k === 'pad' ? P.shimmer : P.fm;
    if (fmAmt > 0 && voices[0].osc) {
      const mo = ctx.createOscillator(), mg = ctx.createGain(); mo.frequency.value = base * (k === 'lead' ? 3.5 : k === 'pad' ? 2 : 1);
      mg.gain.setValueAtTime(base * fmAmt, t); if (k !== 'pad') mg.gain.exponentialRampToValueAtTime(base * fmAmt * 0.15 + 1, t + 0.4);
      mo.connect(mg).connect(voices[0].osc.frequency); os.push(mo);
    }
    if (arp) { const end = t + (len || 1); let i = 0; for (let at = t; at < end && i < 400; at += 0.02, i++) voices.forEach(v => v.setFreq(base * Math.pow(2, steps[i % steps.length] / 12), at)); }
    if (P.vibrato > 0 && voices[0].osc) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 5.5; lg.gain.value = base * 0.008 * P.vibrato; l.connect(lg).connect(voices[0].osc.frequency); l.start(t + 0.12); extra.push(l); }
    if (k === 'bass') {
      f.frequency.setValueAtTime(P.cutoff, t); f.frequency.exponentialRampToValueAtTime(Math.max(80, P.cutoff * (1 - P.env)), t + P.decay);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol * 0.55, t + 0.005); g.gain.setTargetAtTime(vol * 0.32, t + 0.03, P.decay);
    }
    if (k === 'lead') {
      if (P.pluck) { f.frequency.setValueAtTime(P.cutoff, t); f.frequency.exponentialRampToValueAtTime(400, t + 0.25); } else f.frequency.value = P.cutoff;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol * 0.24, t + P.attack); g.gain.setTargetAtTime(P.pluck ? 0 : vol * 0.16, t + P.attack, P.pluck ? 0.12 : 0.25);
      if (P.delay > 0) { const s = ctx.createGain(); s.gain.value = P.delay; g.connect(s); s.connect(this.delay); }
    }
    if (k === 'pad') { f.frequency.value = P.cutoff; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol * (P.wave === 'pulse' ? 0.16 : 0.11), t + P.attack); }
    os.forEach(o => o.start(t)); os.push(...extra); this.live[c] = { g, o: os };
    if (len) { const end = t + len; g.gain.setTargetAtTime(0, end, (P.release || 0.1) / 3); os.forEach(o => o.stop(end + (P.release || 0.1) + 1)); }
  }
}

/* ---------- song timing ---------- */
const atStepDur = song => 60 / song.bpm / 4;
const atTonal = c => ['bass', 'lead', 'pad'].includes(AT_TRACKS[c][0]);
function atNoteLen(song, p, r, c) {   // until the next note or note off in that column
  const P = song.pats[p]; for (let i = r + 1; i < AT_ROWS; i++) if (P[i][c] != null) return (i - r) * atStepDur(song);
  return (AT_ROWS - r) * atStepDur(song);
}
function atPlayRow(bus, song, p, r, t) {
  song.pats[p][r].forEach((n, c) => {
    if (n == null || song.mute[c]) return;
    if (n === 'off') { bus.stopVoice(c, t); return; }
    bus.trig(song, c, n, t, atTonal(c) ? atNoteLen(song, p, r, c) : 0, song.vol[c]);
  });
}

// Live playback with a look-ahead scheduler. onStep(orderIndex, row, hits) fires in time with the sound.
class ATPlayer {
  constructor() { this.ctx = null; this.bus = null; this.playing = false; this.listeners = new Set(); this.owner = null; }
  audio() {
    if (!this.ctx) { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); this.bus = new ATBus(this.ctx, 0.5); }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(...a) { this.listeners.forEach(fn => { try { fn(...a); } catch (e) { console.error(e); } }); }
  play(song, owner) {
    this.stop(); this.audio();
    this.song = song; this.owner = owner || null; this.playing = true; this.step = 0; this.ord = 0; this.queue = [];
    this.next = this.ctx.currentTime + 0.06;
    this.bus.delay.delayTime.setValueAtTime(Math.min(0.9, atStepDur(song) * 3), this.ctx.currentTime);   // a dotted-eighth echo
    this.timer = window.setInterval(() => this.schedule(), 25); this.schedule();
    const tick = () => {
      if (!this.playing) return;
      const now = this.ctx.currentTime;
      while (this.queue.length && this.queue[0][0] <= now) { const [, oi, r, hits] = this.queue.shift(); this.emit('step', oi, r, hits); }
      this.raf = window.requestAnimationFrame(tick);
    };
    this.raf = window.requestAnimationFrame(tick);
    this.emit('play', owner);
  }
  schedule() {
    const s = this.song, sd = atStepDur(s);
    while (this.next < this.ctx.currentTime + 0.12) {
      if (this.ord >= s.order.length) this.ord = 0;
      const p = s.order[this.ord], sw = (this.step % 2) ? s.swing / 100 * sd * 0.5 : 0, t = this.next + sw;
      atPlayRow(this.bus, s, p, this.step, t);
      this.queue.push([t, this.ord, this.step, s.pats[p][this.step].map((n, c) => n != null && n !== 'off' && !s.mute[c])]);
      this.next += sd; this.step++;
      if (this.step >= AT_ROWS) { this.step = 0; this.ord = (this.ord + 1) % s.order.length; }
    }
  }
  stop() {
    if (!this.playing) return;
    this.playing = false; window.clearInterval(this.timer); window.cancelAnimationFrame(this.raf);
    this.bus.stopAll(this.ctx.currentTime);
    const owner = this.owner; this.owner = null;
    this.emit('stop', owner);
  }
  preview(song, c, n, len) { this.audio(); this.bus.trig(song, c, n, this.ctx.currentTime + 0.01, len || (atTonal(c) ? 0.35 : 0), song.vol[c]); }
}

/* ---------- exports ---------- */
async function atRenderWav(song) {
  const sr = 44100, sd = atStepDur(song), len = song.order.length * AT_ROWS * sd + 2.5;
  const ctx = new OfflineAudioContext(2, Math.ceil(sr * len), sr), bus = new ATBus(ctx, 0.5);
  bus.delay.delayTime.value = Math.min(0.9, sd * 3);
  let t = 0.05;
  for (const p of song.order) for (let r = 0; r < AT_ROWS; r++) { atPlayRow(bus, song, p, r, t + ((r % 2) ? song.swing / 100 * sd * 0.5 : 0)); t += sd; }
  const buf = await ctx.startRendering(), n = buf.length;
  const v = new DataView(new ArrayBuffer(44 + n * 4)), W = (o, s) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  W(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); W(8, 'WAVE'); W(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); W(36, 'data'); v.setUint32(40, n * 4, true);
  const L = buf.getChannelData(0), R = buf.getChannelData(1);
  for (let i = 0; i < n; i++) { v.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true); v.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true); }
  return { data: v.buffer, seconds: n / sr };
}
function atMidi(song) {
  const tpq = 96, tps = tpq / 4, vlq = n => { const b = [n & 127]; while ((n >>= 7)) b.unshift((n & 127) | 128); return b; };
  const tempo = Math.round(60000000 / song.bpm), trks = [[0, 255, 81, 3, (tempo >> 16) & 255, (tempo >> 8) & 255, tempo & 255, 0, 255, 47, 0]];
  AT_TRACKS.forEach(([k], c) => {
    const drum = c < 3, ch = drum ? 9 : c - 3, ev = []; let abs = 0;
    const shift = drum ? 0 : 12 * (song.inst[c].p.oct || 0);
    for (const p of song.order) {
      const P = song.pats[p];
      for (let r = 0; r < AT_ROWS; r++) {
        const n = P[r][c];
        if (n != null && n !== 'off' && !song.mute[c]) {
          const key = drum ? [36, 38, 42][c] : Math.max(0, Math.min(127, n + shift));
          const steps = drum ? 1 : Math.max(1, Math.round(atNoteLen(song, p, r, c) / atStepDur(song)));
          ev.push([abs, 0x90 | ch, key, 100], [abs + steps * tps - 1, 0x80 | ch, key, 0]);
        }
        abs += tps;
      }
    }
    ev.sort((a, b) => a[0] - b[0]); let last = 0; const bytes = [];
    ev.forEach(([t, s, key, vel]) => { bytes.push(...vlq(t - last), s, key, vel); last = t; });
    bytes.push(0, 255, 47, 0); trks.push(bytes);
  });
  const out = [77, 84, 104, 100, 0, 0, 0, 6, 0, 1, 0, trks.length, 0, tpq];
  trks.forEach(b => out.push(77, 84, 114, 107, (b.length >> 24) & 255, (b.length >> 16) & 255, (b.length >> 8) & 255, b.length & 255, ...b));
  return new Uint8Array(out);
}
