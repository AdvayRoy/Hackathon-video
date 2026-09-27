// Deterministic original score for the NEURASCOPE launch film. Writes raw f32le stereo 48 kHz to stdout.
// usage: node scripts/score.mjs | ffmpeg -f f32le -ar 48000 -ac 2 -i - 02_audio/score.wav
const SR = 48000, DUR = 78, N = SR * DUR;
const L = new Float32Array(N), R = new Float32Array(N);
let seed = 20260926; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const ramp = (t, a, b) => clamp01((t - a) / (b - a));
// chord plan (seconds -> midi notes). D minor lab palette.
const chords = [
  [0, [50, 57, 62]],          // D2 A2 D3 (drone)
  [18, [50, 57, 65, 69]],     // Dm add F A
  [26, [46, 53, 62, 65]],     // Bb
  [34, [53, 60, 65, 69]],     // F
  [42, [48, 55, 64, 67]],     // C
  [50, [50, 57, 65, 69, 72]], // Dm + C  (lift)
  [58, [46, 53, 62, 65, 69]], // Bb add A
  [67, [50, 57, 62]],         // D drone resolve
];
function chordAt(t) { let c = chords[0][1]; for (const [s, n] of chords) if (t >= s) c = n; return c; }
// pad: additive with slow detune, per-note crossfade at chord changes
const voices = []; // {f, start, end}
for (let i = 0; i < chords.length; i++) {
  const [s, notes] = chords[i]; const e = i + 1 < chords.length ? chords[i + 1][0] : DUR + 4;
  for (const m of notes) voices.push({ f: midi(m), s, e });
}
const master = (t) => 0.9 * ramp(t, 0, 4) * (1 - ramp(t, 74.5, 78));
const padLevel = (t) => 0.10 + 0.09 * ramp(t, 14, 20) + 0.05 * ramp(t, 50, 52) - 0.08 * ramp(t, 67, 70);
const pulseLevel = (t) => 0.22 * ramp(t, 17.5, 18.5) * (1 - ramp(t, 66.5, 67.5));
const BPM = 96, BEAT = 60 / BPM;
const phase = new Float64Array(voices.length * 3);
for (let n = 0; n < N; n++) {
  const t = n / SR; let l = 0, r = 0;
  // pad
  const pl = padLevel(t);
  for (let v = 0; v < voices.length; v++) {
    const V = voices[v]; if (t < V.s - 1.5 || t > V.e + 1.5) continue;
    const env = ramp(t, V.s - 1.5, V.s + 1.5) * (1 - ramp(t, V.e - 1.5, V.e + 1.5));
    if (env <= 0) continue;
    const det = 1 + 0.0012 * Math.sin(2 * Math.PI * 0.07 * t + v);
    phase[v * 3] += 2 * Math.PI * V.f / SR; phase[v * 3 + 1] += 2 * Math.PI * V.f * det / SR; phase[v * 3 + 2] += 2 * Math.PI * V.f * 2.001 / SR;
    const a = Math.sin(phase[v * 3]), b = Math.sin(phase[v * 3 + 1]), c = Math.sin(phase[v * 3 + 2]) * 0.18;
    const lfo = 0.85 + 0.15 * Math.sin(2 * Math.PI * 0.11 * t + v * 1.7);
    const g = env * pl * lfo / Math.sqrt(voices.length / 2);
    l += (a * 0.7 + b * 0.3 + c) * g; r += (a * 0.3 + b * 0.7 + c) * g;
  }
  // sub drone D1/D2
  const sub = Math.sin(2 * Math.PI * midi(38) * t) * 0.16 * (0.6 + 0.4 * ramp(t, 18, 19)) * (1 - 0.5 * ramp(t, 67, 70));
  l += sub; r += sub;
  // pulse: soft thump each beat, tick every 2 beats
  const pv = pulseLevel(t);
  if (pv > 0) {
    const tb = (t - 18) % BEAT; const bi = Math.floor((t - 18) / BEAT);
    if (t >= 18) {
      const th = Math.exp(-tb * 18) * Math.sin(2 * Math.PI * (55 + 30 * Math.exp(-tb * 40)) * tb) * pv * 0.9;
      l += th; r += th;
      if (bi % 2 === 1) { const tk = Math.exp(-tb * 90) * (rnd() * 2 - 1) * pv * 0.28; l += tk * 0.8; r += tk * 1.1; }
      if (bi % 8 === 4) { const hi = Math.exp(-tb * 6) * Math.sin(2 * Math.PI * midi(74) * tb) * pv * 0.16; l += hi * 0.6; r += hi; }
    }
  }
  // lift plucks 50–66: arpeggio D F A C over 2 beats each
  if (t >= 50 && t < 66) {
    const seq = [62, 65, 69, 72, 69, 65]; const step = BEAT; const k = Math.floor((t - 50) / step); const ts = (t - 50) % step;
    const f = midi(seq[k % seq.length] + 12); const env = Math.exp(-ts * 5) * (1 - ramp(t, 64, 66));
    const p = (Math.sin(2 * Math.PI * f * ts) + 0.3 * Math.sin(2 * Math.PI * f * 2 * ts)) * env * 0.09;
    l += p * (k % 2 ? 0.6 : 1); r += p * (k % 2 ? 1 : 0.6);
  }
  const m = master(t); L[n] = l * m; R[n] = r * m;
}
// cheap Schroeder reverb (4 combs + 2 allpass), 28% wet
function reverb(x) {
  const combs = [1557, 1617, 1491, 1422].map(d => ({ buf: new Float32Array(d), i: 0, g: 0.82 }));
  const aps = [225, 556].map(d => ({ buf: new Float32Array(d), i: 0, g: 0.5 }));
  const y = new Float32Array(x.length);
  for (let n = 0; n < x.length; n++) {
    let s = 0; for (const c of combs) { const o = c.buf[c.i]; c.buf[c.i] = x[n] + o * c.g; c.i = (c.i + 1) % c.buf.length; s += o; } s *= 0.25;
    for (const a of aps) { const o = a.buf[a.i]; const v = s + o * a.g; a.buf[a.i] = v; a.i = (a.i + 1) % a.buf.length; s = o - v * a.g; }
    y[n] = x[n] * 0.72 + s * 0.28;
  }
  return y;
}
const Lw = reverb(L), Rw = reverb(R);
// soft clip + interleave
const out = new Float32Array(N * 2); let peak = 0;
for (let n = 0; n < N; n++) { const a = Math.tanh(Lw[n] * 1.2), b = Math.tanh(Rw[n] * 1.2); out[2 * n] = a; out[2 * n + 1] = b; peak = Math.max(peak, Math.abs(a), Math.abs(b)); }
const norm = 0.7 / peak; for (let i = 0; i < out.length; i++) out[i] *= norm;
process.stdout.write(Buffer.from(out.buffer));
