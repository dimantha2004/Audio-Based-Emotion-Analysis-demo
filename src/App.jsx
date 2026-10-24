import { useEffect, useRef, useState } from 'react'
import { predict } from './predict.js'

const MAX_BYTES = 200 * 1024 * 1024

function drawWaveform(canvas, audioBuffer) {
  const ctx = canvas.getContext('2d')
  const w = (canvas.width = canvas.clientWidth * devicePixelRatio)
  const h = (canvas.height = canvas.clientHeight * devicePixelRatio)
  const data = audioBuffer.getChannelData(0)
  const per = Math.max(1, Math.floor(data.length / w))
  ctx.clearRect(0, 0, w, h)
  ctx.strokeStyle = '#4c9bff'
  ctx.beginPath()
  for (let x = 0; x < w; x++) {
    let min = 1, max = -1
    for (let i = x * per; i < (x + 1) * per && i < data.length; i++) {
      if (data[i] < min) min = data[i]
      if (data[i] > max) max = data[i]
    }
    ctx.moveTo(x + 0.5, ((1 - max) / 2) * h)
    ctx.lineTo(x + 0.5, ((1 - min) / 2) * h)
  }
  ctx.stroke()
}

export default function App() {
  const [file, setFile] = useState(null)
  const [url, setUrl] = useState(null)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [status, setStatus] = useState('idle') // idle | analyzing | done
  const [results, setResults] = useState(null)
  const inputRef = useRef(null)
  const canvasRef = useRef(null)

  useEffect(() => () => url && URL.revokeObjectURL(url), [url])

  useEffect(() => {
    if (!file) return
    let cancelled = false
    const audioCtx = new AudioContext()
    file
      .arrayBuffer()
      .then((buf) => audioCtx.decodeAudioData(buf))
      .then((decoded) => !cancelled && drawWaveform(canvasRef.current, decoded))
      .catch(() => !cancelled && setError('Could not decode this WAV file.'))
      .finally(() => audioCtx.close())
    return () => { cancelled = true }
  }, [file])

  function pick(f) {
    if (!f) return
    setStatus('idle')
    setResults(null)
    if (!f.name.toLowerCase().endsWith('.wav')) return setError(`"${f.name}" is not a WAV file.`)
    if (f.size > MAX_BYTES) return setError('File exceeds the 200MB limit.')
    setError('')
    setFile(f)
    setUrl(URL.createObjectURL(f))
  }

  async function analyze() {
    setStatus('analyzing')
    const [res] = await Promise.all([file.arrayBuffer().then(predict), new Promise((r) => setTimeout(r, 1500))])
    setResults(res)
    setStatus('done')
  }

  const top = results?.[0]

  return (
    <main>
      <h1>🛡️ SecureMind</h1>
      <h3>Audio-Based Emotion Analysis</h3>
      <p>Analyze speech recordings using our trained CNN-LSTM acoustic emotion classification model.</p>
      <hr />

      <h2>Upload Audio</h2>
      <label className="label" htmlFor="wav">Choose a WAV recording</label>
      <div
        className={`dropzone${dragging ? ' dragging' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files[0]) }}
      >
        <button className="btn" onClick={() => inputRef.current.click()}>⤒ Upload</button>
        <span className="muted">200MB per file • WAV</span>
        <input
          id="wav" ref={inputRef} type="file" accept=".wav,audio/wav" hidden
          onChange={(e) => { pick(e.target.files[0]); e.target.value = '' }}
        />
      </div>
      {error && <p className="error">{error}</p>}

      {file && !error && (
        <section className="card">
          <div className="file-row">
            <span>🎵 {file.name}</span>
            <span className="muted">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
          </div>
          <audio controls src={url} />
          <canvas ref={canvasRef} className="wave" />
          <button className="btn primary" onClick={analyze} disabled={status === 'analyzing'}>
            {status === 'analyzing' ? <><span className="spinner" /> Analyzing with CNN-LSTM…</> : 'Analyze Emotion'}
          </button>
        </section>
      )}

      {status === 'done' && top && (
        <section className="card">
          <h2>Prediction</h2>
          <div className="top">
            <span className="emoji">{top.emoji}</span>
            <div>
              <div className="top-label">{top.label}</div>
              <div className="muted">Confidence: {(top.p * 100).toFixed(1)}%</div>
            </div>
          </div>
          {results.map((r) => (
            <div className="bar-row" key={r.label}>
              <span className="bar-name">{r.emoji} {r.label}</span>
              <div className="bar"><div style={{ width: `${r.p * 100}%` }} /></div>
              <span className="bar-pct">{(r.p * 100).toFixed(1)}%</span>
            </div>
          ))}
        </section>
      )}

      <hr />
      <footer className="muted">SecureMind Research Prototype | CNN-LSTM + MFCC | Audio Component</footer>
    </main>
  )
}
