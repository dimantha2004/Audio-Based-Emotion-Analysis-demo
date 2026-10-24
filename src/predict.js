export const EMOTIONS = [
  { label: 'Neutral', emoji: '😐' },
  { label: 'Calm', emoji: '😌' },
  { label: 'Happy', emoji: '😄' },
  { label: 'Sad', emoji: '😢' },
  { label: 'Angry', emoji: '😠' },
  { label: 'Fearful', emoji: '😨' },
  { label: 'Disgust', emoji: '🤢' },
  { label: 'Surprised', emoji: '😲' },
]

// ponytail: mocked prediction, swap for fetch('/predict') to a FastAPI backend when the real model is wired
export function predict(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer)
  // FNV-1a over at most ~1M sampled bytes, so the same file always gives the same result
  const step = Math.max(1, Math.floor(bytes.length / 1e6))
  let h = 0x811c9dc5
  for (let i = 0; i < bytes.length; i += step) h = Math.imul(h ^ bytes[i], 0x01000193)

  // mulberry32 PRNG seeded by the hash
  const rand = () => {
    h = (h + 0x6d2b79f5) | 0
    let t = Math.imul(h ^ (h >>> 15), 1 | h)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  // softmax with sharpening so one class clearly wins
  const exps = EMOTIONS.map(() => Math.exp(rand() * 9))
  const sum = exps.reduce((a, b) => a + b, 0)
  return EMOTIONS.map((e, i) => ({ ...e, p: exps[i] / sum })).sort((a, b) => b.p - a.p)
}

// self-check: `npm test` (node src/predict.js)
if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('predict.js')) {
  const buf = new Uint8Array(5000).map((_, i) => (i * 31) % 256).buffer
  const a = predict(buf)
  const b = predict(buf)
  const total = a.reduce((s, r) => s + r.p, 0)
  if (Math.abs(total - 1) > 1e-9) throw new Error(`probabilities sum to ${total}`)
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error('not deterministic')
  if (a.length !== EMOTIONS.length || a[0].p < a[1].p) throw new Error('bad ordering')
  console.log('predict ok:', a[0].label, (a[0].p * 100).toFixed(1) + '%')
}
