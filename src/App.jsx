import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import './styles.css'

const ICON_SPECS = [
  { name: 'favicon-16x16.png',          size: 16,  context: 'Browser tab',           group: 'favicon' },
  { name: 'favicon-32x32.png',          size: 32,  context: 'Browser tab · retina',  group: 'favicon' },
  { name: 'favicon-48x48.png',          size: 48,  context: 'Windows tile',          group: 'favicon' },
  { name: 'apple-touch-icon.png',       size: 180, context: 'iOS home screen',       group: 'apple'   },
  { name: 'android-chrome-192x192.png', size: 192, context: 'Android launcher',      group: 'android' },
  { name: 'android-chrome-512x512.png', size: 512, context: 'Android splash · PWA',  group: 'android' },
]

const ICO_SIZES = [16, 32, 48]
const MAX_UPLOAD_MB = 8
const ACCEPT_TYPES = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml'

const BG_PRESETS = [
  { id: 'transparent', label: 'None',   value: 'transparent' },
  { id: 'white',       label: 'White',  value: '#ffffff' },
  { id: 'black',       label: 'Black',  value: '#0a0a0c' },
  { id: 'indigo',      label: 'Indigo', value: '#6366f1' },
]

export default function App() {
  const [source, setSource] = useState(null) // { name, image (HTMLImageElement), width, height, dataUrl }
  const [background, setBackground] = useState('transparent')
  const [padding, setPadding] = useState(0)     // % of size
  const [radius, setRadius] = useState(0)       // % of half-size (0 = square, 50 = full circle)
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState('')
  const [previews, setPreviews] = useState({}) // { name: dataUrl }
  const [busy, setBusy] = useState(false)
  const [downloadState, setDownloadState] = useState('idle')
  const [copyState, setCopyState] = useState('idle')
  const fileInputRef = useRef(null)

  const handleFile = useCallback(async (file) => {
    setError('')
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file (PNG, JPG, SVG, WebP, or GIF).')
      return
    }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setError(`File is too large — keep it under ${MAX_UPLOAD_MB} MB.`)
      return
    }
    try {
      const dataUrl = await fileToDataUrl(file)
      const image = await loadImage(dataUrl)
      setSource({ name: file.name, image, width: image.naturalWidth, height: image.naturalHeight, dataUrl })
    } catch {
      setError('Could not read that image. Try another file.')
    }
  }, [])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files?.[0]
    handleFile(file)
  }, [handleFile])

  const onFileInput = (e) => handleFile(e.target.files?.[0])

  const handleReset = () => {
    setSource(null)
    setPreviews({})
    setError('')
    setBackground('transparent')
    setPadding(0)
    setRadius(0)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Rebuild previews whenever source or settings change
  useEffect(() => {
    if (!source) { setPreviews({}); return }
    let cancelled = false
    setBusy(true)
    ;(async () => {
      const next = {}
      for (const spec of ICON_SPECS) {
        const canvas = renderIcon(source.image, spec.size, { background, padding, radius })
        next[spec.name] = canvas.toDataURL('image/png')
        if (cancelled) return
      }
      if (!cancelled) {
        setPreviews(next)
        setBusy(false)
      }
    })()
    return () => { cancelled = true }
  }, [source, background, padding, radius])

  const opts = useMemo(() => ({ background, padding, radius }), [background, padding, radius])

  const handleDownloadOne = async (spec) => {
    if (!source) return
    const canvas = renderIcon(source.image, spec.size, opts)
    const blob = await canvasToBlob(canvas)
    downloadBlob(blob, spec.name)
  }

  const handleDownloadIco = async () => {
    if (!source) return
    const canvases = ICO_SIZES.map(sz => renderIcon(source.image, sz, opts))
    const blob = await buildIco(canvases)
    downloadBlob(blob, 'favicon.ico')
  }

  const handleDownloadZip = async () => {
    if (!source) return
    setDownloadState('working')
    try {
      const files = []
      for (const spec of ICON_SPECS) {
        const canvas = renderIcon(source.image, spec.size, opts)
        const blob = await canvasToBlob(canvas)
        files.push({ name: spec.name, blob })
      }
      const icoCanvases = ICO_SIZES.map(sz => renderIcon(source.image, sz, opts))
      const icoBlob = await buildIco(icoCanvases)
      files.push({ name: 'favicon.ico', blob: icoBlob })

      files.push({ name: 'site.webmanifest', blob: new Blob([buildManifest()], { type: 'application/json' }) })
      files.push({ name: 'README.txt', blob: new Blob([buildReadme()], { type: 'text/plain' }) })

      const zip = await buildStoredZip(files)
      downloadBlob(zip, 'favicon-pack.zip')
      setDownloadState('done')
      setTimeout(() => setDownloadState('idle'), 1600)
    } catch {
      setError('Something went wrong while packing your icons.')
      setDownloadState('idle')
    }
  }

  const handleCopySnippet = async () => {
    try {
      await navigator.clipboard.writeText(HTML_SNIPPET)
      setCopyState('done')
      setTimeout(() => setCopyState('idle'), 1400)
    } catch {
      setCopyState('idle')
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="header-left">
            <div>
              <h1 className="header-title">Favicon Generator</h1>
              <p className="header-sub">One logo. Every icon your website needs — in one click.</p>
            </div>
          </div>
          <div className="header-right">
            {source && (
              <button className="icon-btn header-icon-btn" onClick={handleReset} aria-label="Start over" title="Start over">
                <IconTrash />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="main">
        {!source ? (
          <DropZone
            dragActive={dragActive}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
            onDragLeave={() => setDragActive(false)}
            onDrop={onDrop}
            onPick={() => fileInputRef.current?.click()}
          />
        ) : (
          <>
            <section className="split">
              <SourceCard source={source} onChange={() => fileInputRef.current?.click()} onRemove={handleReset} />
              <SettingsCard
                background={background}
                setBackground={setBackground}
                padding={padding}
                setPadding={setPadding}
                radius={radius}
                setRadius={setRadius}
              />
            </section>

            <BrowserTabPreview name={source.name} dataUrl={previews['favicon-32x32.png']} />

            <PreviewGrid previews={previews} onDownload={handleDownloadOne} busy={busy} />

            <DownloadBar
              onDownloadZip={handleDownloadZip}
              onDownloadIco={handleDownloadIco}
              onCopySnippet={handleCopySnippet}
              state={downloadState}
              copyState={copyState}
              disabled={busy || Object.keys(previews).length === 0}
            />

            <HtmlSnippetCard />
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_TYPES}
          onChange={onFileInput}
          style={{ display: 'none' }}
          aria-hidden="true"
        />

        {error && (
          <p className="inline-error" role="alert">
            <IconInfo /> {error}
          </p>
        )}
      </main>

      <footer className="credit">
        Coded by{' '}
        <a href="https://instagram.com/berkindev" target="_blank" rel="noopener noreferrer" className="credit-link">
          berkindev
        </a>
      </footer>
    </div>
  )
}

/* ─── Components ──────────────────────────────────── */

function DropZone({ dragActive, onDragOver, onDragLeave, onDrop, onPick }) {
  return (
    <section
      className={`dropzone${dragActive ? ' is-active' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onPick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick() } }}
      aria-label="Drop or click to upload your logo"
    >
      <div className="dropzone-glow" />
      <div className="dropzone-icon">
        <IconUpload />
      </div>
      <h2 className="dropzone-title">Drop your logo here</h2>
      <p className="dropzone-sub">
        PNG, JPG, WebP, GIF, or SVG — square images work best. Max {MAX_UPLOAD_MB} MB.
      </p>
      <div className="dropzone-hints">
        <span className="hint-chip"><IconLightning /> 8 sizes generated instantly</span>
        <span className="hint-chip"><IconLock /> 100% on-device</span>
      </div>
      <button className="btn-primary dropzone-cta" type="button">Choose image</button>
    </section>
  )
}

function SourceCard({ source, onChange, onRemove }) {
  return (
    <div className="card">
      <div className="card-label"><span>Source</span></div>
      <div className="source-row">
        <div className="source-thumb">
          <img src={source.dataUrl} alt="Uploaded logo preview" />
        </div>
        <div className="source-meta">
          <div className="source-name" title={source.name}>{source.name}</div>
          <div className="source-dims">{source.width} × {source.height} px</div>
          <div className="source-actions">
            <button className="btn-secondary" onClick={onChange} type="button">Replace</button>
            <button className="btn-ghost" onClick={onRemove} type="button">Remove</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SettingsCard({ background, setBackground, padding, setPadding, radius, setRadius }) {
  return (
    <div className="card">
      <div className="card-label"><span>Adjust</span></div>

      <div className="setting">
        <label className="setting-label">Background</label>
        <div className="chip-row">
          {BG_PRESETS.map(p => (
            <button
              key={p.id}
              type="button"
              className={`bg-chip${background === p.value ? ' is-active' : ''}`}
              onClick={() => setBackground(p.value)}
              aria-pressed={background === p.value}
              aria-label={`Background ${p.label}`}
            >
              <span
                className={`bg-swatch${p.value === 'transparent' ? ' is-transparent' : ''}`}
                style={p.value === 'transparent' ? undefined : { background: p.value }}
              />
              {p.label}
            </button>
          ))}
          <label className="bg-chip bg-chip-custom" title="Custom color">
            <input
              type="color"
              value={background.startsWith('#') ? background : '#111115'}
              onChange={(e) => setBackground(e.target.value)}
              aria-label="Custom background color"
            />
            <span className="bg-swatch" style={{ background: background.startsWith('#') ? background : '#111115' }} />
            Custom
          </label>
        </div>
      </div>

      <div className="setting">
        <label className="setting-label" htmlFor="padding-range">
          Padding <span className="setting-value">{padding}%</span>
        </label>
        <input
          id="padding-range"
          type="range"
          min="0"
          max="30"
          step="1"
          value={padding}
          onChange={(e) => setPadding(Number(e.target.value))}
          className="range"
        />
      </div>

      <div className="setting">
        <label className="setting-label" htmlFor="radius-range">
          Rounded corners <span className="setting-value">{radius === 50 ? 'circle' : `${radius}%`}</span>
        </label>
        <input
          id="radius-range"
          type="range"
          min="0"
          max="50"
          step="1"
          value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
          className="range"
        />
      </div>
    </div>
  )
}

function BrowserTabPreview({ name, dataUrl }) {
  const shortName = name?.replace(/\.[^.]+$/, '') ?? 'your-site'
  return (
    <div className="tab-preview" aria-label="Browser tab preview">
      <div className="tab-preview-bar">
        <span className="tab tab-active">
          {dataUrl
            ? <img src={dataUrl} alt="" className="tab-fav" width={14} height={14} />
            : <span className="tab-fav placeholder" />}
          <span className="tab-title">{shortName || 'your-site'}</span>
          <span className="tab-close">×</span>
        </span>
        <span className="tab tab-inactive">
          <span className="tab-fav placeholder" />
          <span className="tab-title">Docs</span>
        </span>
        <span className="tab tab-inactive">
          <span className="tab-fav placeholder" />
          <span className="tab-title">Dashboard</span>
        </span>
        <span className="tab-plus">+</span>
      </div>
      <div className="tab-preview-hint">Live preview — how your favicon looks in a browser tab</div>
    </div>
  )
}

function PreviewGrid({ previews, onDownload, busy }) {
  return (
    <div className="card">
      <div className="card-label">
        <span>Preview</span>
        {busy && <span className="badge-busy">Rendering…</span>}
      </div>
      <div className="preview-grid">
        {ICON_SPECS.map(spec => (
          <div key={spec.name} className={`preview-cell group-${spec.group}`}>
            <div className="preview-canvas">
              {previews[spec.name] && (
                <img
                  src={previews[spec.name]}
                  alt={`${spec.size}×${spec.size} preview`}
                  className="preview-img"
                  style={{ width: displaySize(spec.size), height: displaySize(spec.size) }}
                />
              )}
            </div>
            <div className="preview-meta">
              <div className="preview-name">{spec.name}</div>
              <div className="preview-context">{spec.context} · {spec.size}px</div>
            </div>
            <button
              className="icon-btn preview-download"
              onClick={() => onDownload(spec)}
              aria-label={`Download ${spec.name}`}
              title={`Download ${spec.name}`}
            >
              <IconDownload />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function DownloadBar({ onDownloadZip, onDownloadIco, onCopySnippet, state, copyState, disabled }) {
  return (
    <div className="download-bar">
      <button
        className="btn-primary btn-primary-lg"
        onClick={onDownloadZip}
        disabled={disabled || state === 'working'}
      >
        <IconArchive />
        {state === 'working' ? 'Packing…' : state === 'done' ? 'Downloaded' : 'Download full pack (.zip)'}
      </button>
      <button className="btn-secondary" onClick={onDownloadIco} disabled={disabled}>
        <IconIco /> favicon.ico
      </button>
      <button className="btn-secondary" onClick={onCopySnippet}>
        {copyState === 'done' ? <IconCheck /> : <IconCopy />}
        {copyState === 'done' ? 'Copied' : 'Copy <head> snippet'}
      </button>
    </div>
  )
}

function HtmlSnippetCard() {
  return (
    <div className="card snippet-card">
      <div className="card-label"><span>HTML snippet</span></div>
      <pre className="snippet"><code>{HTML_SNIPPET}</code></pre>
    </div>
  )
}

/* ─── HTML snippet ────────────────────────────────── */

const HTML_SNIPPET = `<link rel="icon" type="image/x-icon" href="/favicon.ico">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">`

function buildManifest() {
  return JSON.stringify({
    name: '',
    short_name: '',
    icons: [
      { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    theme_color: '#ffffff',
    background_color: '#ffffff',
    display: 'standalone',
  }, null, 2)
}

function buildReadme() {
  return `Favicon pack — generated by Favicon Generator (The Build Log).

Drop these files at the root of your site and paste the snippet below
into <head>:

${HTML_SNIPPET}

Files:
  favicon.ico                     — 16/32/48 multi-size, legacy IE + edge cases
  favicon-16x16.png               — browser tab
  favicon-32x32.png               — browser tab (retina)
  favicon-48x48.png               — Windows tile / DevTools
  apple-touch-icon.png            — iOS home screen (180×180)
  android-chrome-192x192.png      — Android launcher
  android-chrome-512x512.png      — Android splash / PWA
  site.webmanifest                — Progressive Web App manifest
`
}

/* ─── Image utilities ─────────────────────────────── */

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image load failed'))
    img.src = src
  })
}

function renderIcon(image, size, { background, padding, radius }) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  const rPx = (radius / 100) * (size / 2)
  const hasBg = background !== 'transparent'

  if (rPx > 0) {
    roundedPath(ctx, 0, 0, size, size, rPx)
    if (hasBg) {
      ctx.fillStyle = background
      ctx.fill()
    }
    ctx.save()
    ctx.clip()
  } else if (hasBg) {
    ctx.fillStyle = background
    ctx.fillRect(0, 0, size, size)
  }

  const pad = (padding / 100) * size
  const box = size - pad * 2
  const iw = image.naturalWidth || image.width
  const ih = image.naturalHeight || image.height
  const scale = Math.min(box / iw, box / ih)
  const dw = iw * scale
  const dh = ih * scale
  const dx = (size - dw) / 2
  const dy = (size - dh) / 2
  ctx.drawImage(image, dx, dy, dw, dh)

  if (rPx > 0) ctx.restore()

  return canvas
}

function roundedPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y,     x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x,     y + h, rr)
  ctx.arcTo(x,     y + h, x,     y,     rr)
  ctx.arcTo(x,     y,     x + w, y,     rr)
  ctx.closePath()
}

function canvasToBlob(canvas) {
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
}

function displaySize(size) {
  const capped = Math.min(size, 96)
  return `${capped}px`
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/* ─── ICO writer (multi-size, PNG-embedded) ───────── */

async function buildIco(canvases) {
  const buffers = []
  for (const c of canvases) {
    const blob = await canvasToBlob(c)
    buffers.push(new Uint8Array(await blob.arrayBuffer()))
  }
  const headerSize = 6
  const entrySize = 16
  const dirSize = headerSize + entrySize * canvases.length
  const total = dirSize + buffers.reduce((a, b) => a + b.length, 0)
  const out = new Uint8Array(total)
  const view = new DataView(out.buffer)

  view.setUint16(0, 0, true)
  view.setUint16(2, 1, true)
  view.setUint16(4, canvases.length, true)

  let offset = dirSize
  for (let i = 0; i < canvases.length; i++) {
    const eOff = headerSize + i * entrySize
    const s = canvases[i].width
    const len = buffers[i].length
    view.setUint8(eOff + 0, s >= 256 ? 0 : s)
    view.setUint8(eOff + 1, s >= 256 ? 0 : s)
    view.setUint8(eOff + 2, 0)
    view.setUint8(eOff + 3, 0)
    view.setUint16(eOff + 4, 1, true)
    view.setUint16(eOff + 6, 32, true)
    view.setUint32(eOff + 8, len, true)
    view.setUint32(eOff + 12, offset, true)
    out.set(buffers[i], offset)
    offset += len
  }
  return new Blob([out], { type: 'image/vnd.microsoft.icon' })
}

/* ─── Stored ZIP writer (no compression) ──────────── */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}

async function buildStoredZip(files) {
  const encoder = new TextEncoder()
  const chunks = []
  const central = []
  let offset = 0

  for (const file of files) {
    const data = new Uint8Array(await file.blob.arrayBuffer())
    const nameBytes = encoder.encode(file.name)
    const crc = crc32(data)
    const size = data.length

    const lfh = new Uint8Array(30 + nameBytes.length)
    const lv = new DataView(lfh.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(4, 20, true)
    lv.setUint16(6, 0, true)
    lv.setUint16(8, 0, true)          // method = stored
    lv.setUint16(10, 0, true)          // mod time
    lv.setUint16(12, 0x21, true)       // mod date (1980-01-01)
    lv.setUint32(14, crc, true)
    lv.setUint32(18, size, true)
    lv.setUint32(22, size, true)
    lv.setUint16(26, nameBytes.length, true)
    lv.setUint16(28, 0, true)
    lfh.set(nameBytes, 30)

    chunks.push(lfh)
    chunks.push(data)

    const cd = new Uint8Array(46 + nameBytes.length)
    const cv = new DataView(cd.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(4, 20, true)
    cv.setUint16(6, 20, true)
    cv.setUint16(8, 0, true)
    cv.setUint16(10, 0, true)
    cv.setUint16(12, 0, true)
    cv.setUint16(14, 0x21, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, size, true)
    cv.setUint32(24, size, true)
    cv.setUint16(28, nameBytes.length, true)
    cv.setUint16(30, 0, true)
    cv.setUint16(32, 0, true)
    cv.setUint16(34, 0, true)
    cv.setUint16(36, 0, true)
    cv.setUint32(38, 0, true)
    cv.setUint32(42, offset, true)
    cd.set(nameBytes, 46)
    central.push(cd)

    offset += lfh.length + data.length
  }

  const cdStart = offset
  let cdSize = 0
  for (const cd of central) {
    chunks.push(cd)
    cdSize += cd.length
  }

  const eocd = new Uint8Array(22)
  const ev = new DataView(eocd.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(4, 0, true)
  ev.setUint16(6, 0, true)
  ev.setUint16(8, central.length, true)
  ev.setUint16(10, central.length, true)
  ev.setUint32(12, cdSize, true)
  ev.setUint32(16, cdStart, true)
  ev.setUint16(20, 0, true)
  chunks.push(eocd)

  return new Blob(chunks, { type: 'application/zip' })
}

/* ─── Icons ───────────────────────────────────────── */

function IconUpload() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 15V4" />
      <path d="M7 9l5-5 5 5" />
      <path d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" />
    </svg>
  )
}

function IconDownload() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2v8" />
      <path d="M4.5 6.5L8 10l3.5-3.5" />
      <path d="M2.5 12.5v.5a1 1 0 001 1h9a1 1 0 001-1v-.5" />
    </svg>
  )
}

function IconArchive() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="3" width="13" height="3" rx="0.6" />
      <path d="M2.5 6v7a1 1 0 001 1h9a1 1 0 001-1V6" />
      <path d="M6.5 9h3" />
    </svg>
  )
}

function IconIco() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="2.5" width="11" height="11" rx="2" />
      <circle cx="8" cy="8" r="2.2" />
    </svg>
  )
}

function IconCopy() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="5" width="8.5" height="8.5" rx="1.5" />
      <path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8.5L6.5 12L13 4.5" />
    </svg>
  )
}

function IconTrash() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 4.5h11" />
      <path d="M5 4.5V3a1 1 0 011-1h4a1 1 0 011 1v1.5" />
      <path d="M4 4.5l.7 8.6a1 1 0 001 .9h4.6a1 1 0 001-.9l.7-8.6" />
    </svg>
  )
}

function IconLightning() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 2L3.5 9.5H8L7 14l5.5-7.5H8L9 2z" />
    </svg>
  )
}

function IconLock() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 015 0v2" />
    </svg>
  )
}

function IconInfo() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="8" cy="8" r="6"/>
      <line x1="8" y1="7.5" x2="8" y2="11"/>
      <circle cx="8" cy="5.2" r="0.6" fill="currentColor"/>
    </svg>
  )
}
