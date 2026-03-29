import { useRef, useState, useEffect, useCallback } from 'react'
import { getColor, PALETTES } from './colors'

const BUFFER = 3
const MIN_ZOOM = 0.25
const MAX_ZOOM = 8

function PXInlineLoader({ label = 'Loading', sublabel = 'Rendering pixels...' }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#05070b]/78 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-5">
        <div className="relative">
          <div className="grid grid-cols-2 gap-1.5">
            {[
              'bg-[#7c6fff]',
              'bg-[#40c9ff]',
              'bg-[#ff6b9d]',
              'bg-white',
            ].map((cls, i) => (
              <div
                key={i}
                className={`w-4 h-4 rounded-[4px] ${cls} animate-pulse`}
                style={{
                  animationDelay: `${i * 0.14}s`,
                  animationDuration: '1s',
                }}
              />
            ))}
          </div>

          <div className="absolute inset-0 blur-xl opacity-35">
            <div className="grid grid-cols-2 gap-1.5">
              {[
                'bg-[#7c6fff]',
                'bg-[#40c9ff]',
                'bg-[#ff6b9d]',
                'bg-white',
              ].map((cls, i) => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-[4px] ${cls} animate-pulse`}
                  style={{
                    animationDelay: `${i * 0.14}s`,
                    animationDuration: '1s',
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-1">
            {['P', 'X'].map((ch, i) => (
              <span
                key={i}
                className="text-sm font-mono font-bold tracking-[0.35em]"
                style={{
                  color: i === 0 ? '#7c6fff' : '#40c9ff',
                  animation: 'pxFloat 1.6s ease-in-out infinite',
                  animationDelay: `${i * 0.18}s`,
                }}
              >
                {ch}
              </span>
            ))}
          </div>

          <div className="text-[11px] font-mono font-bold tracking-[0.28em] uppercase text-white/90">
            {label}
          </div>

          <div className="text-[10px] font-mono tracking-[0.18em] uppercase text-white/35 text-center">
            {sublabel}
          </div>
        </div>
      </div>
    </div>
  )
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

function getDistance(a, b) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.hypot(dx, dy)
}

function getMidpoint(a, b) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  }
}

export default function ViewerTab() {
  const fileInputRef = useRef(null)
  const viewerRef = useRef(null)
  const canvasRef = useRef(null)

  const [rows, setRows] = useState([])
  const [maxCols, setMaxCols] = useState(0)
  const [pixelSize, setPixelSz] = useState(12)
  const [palette, setPalette] = useState('coolWarm')
  const [info, setInfo] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [fileName, setFileName] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [busyText, setBusyText] = useState('Rendering pixels...')
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  const rowsRef = useRef([])
  const maxColsRef = useRef(0)
  const pxRef = useRef(12)
  const palRef = useRef('coolWarm')

  const pointersRef = useRef(new Map())
  const actionRef = useRef(null)

  rowsRef.current = rows
  maxColsRef.current = maxCols
  pxRef.current = pixelSize
  palRef.current = palette

  const effectiveCell = pixelSize * zoom

  const centerView = useCallback((targetZoom = zoom) => {
    const viewer = viewerRef.current
    const rs = rowsRef.current
    const mc = maxColsRef.current
    const ps = pxRef.current

    if (!viewer || !rs.length) return

    const vw = viewer.clientWidth
    const vh = viewer.clientHeight
    const totalW = mc * ps * targetZoom
    const totalH = rs.length * ps * targetZoom

    setOffset({
      x: Math.round((vw - totalW) / 2),
      y: Math.round((vh - totalH) / 2),
    })
  }, [zoom])

  const draw = useCallback(() => {
    const rs = rowsRef.current
    if (!rs.length) return

    const viewer = viewerRef.current
    const canvas = canvasRef.current
    if (!viewer || !canvas) return

    const dpr = window.devicePixelRatio || 1
    const vW = viewer.clientWidth
    const vH = viewer.clientHeight
    const ps = pxRef.current * zoom
    const basePx = pxRef.current
    const mc = maxColsRef.current
    const pal = palRef.current

    canvas.width = Math.max(1, Math.floor(vW * dpr))
    canvas.height = Math.max(1, Math.floor(vH * dpr))
    canvas.style.width = `${vW}px`
    canvas.style.height = `${vH}px`

    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, vW, vH)
    ctx.imageSmoothingEnabled = false

    const startCol = clamp(Math.floor((-offset.x) / ps) - BUFFER, 0, mc)
    const endCol = clamp(Math.ceil((vW - offset.x) / ps) + BUFFER, 0, mc)
    const startRow = clamp(Math.floor((-offset.y) / ps) - BUFFER, 0, rs.length)
    const endRow = clamp(Math.ceil((vH - offset.y) / ps) + BUFFER, 0, rs.length)

    for (let r = startRow; r < endRow; r++) {
      const row = rs[r]
      const y = offset.y + r * ps

      for (let c = startCol; c < endCol; c++) {
        const ch = row[c]
        if (!ch || ch < '0' || ch > '9') continue
        ctx.fillStyle = getColor(ch, pal)
        ctx.fillRect(offset.x + c * ps, y, ps, ps)
      }
    }

    const palLabel = PALETTES[pal]?.label || pal
    setInfo(
      `${rs.length.toLocaleString()} rows · ${mc} cols · ${startRow}–${Math.max(startRow, endRow - 1)} · ${palLabel} · ${Math.round(zoom * 100)}% · px ${basePx}`
    )
  }, [offset.x, offset.y, zoom])

  useEffect(() => {
    const onResize = () => {
      draw()
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [draw])

  useEffect(() => {
    draw()
  }, [draw, rows, maxCols, pixelSize, palette, zoom, offset])

  const handleFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    try {
      setIsBusy(true)
      setBusyText('Parsing file...')
      setFileName(file.name)

      const text = await file.text()

      setBusyText('Building pixel map...')
      const raw = text
        .split(/\r?\n/)
        .map(l => l.replace(/\r/g, ''))
        .filter(l => l.length)

      const mc = raw.reduce((m, l) => Math.max(m, l.length), 0)
      const rs = raw.map(l => l.padEnd(mc, ' '))

      maxColsRef.current = mc
      rowsRef.current = rs

      setMaxCols(mc)
      setRows(rs)
      setLoaded(true)

      setBusyText('Rendering viewport...')
      setZoom(1)

      requestAnimationFrame(() => {
        centerView(1)
        requestAnimationFrame(() => {
          draw()
          setIsBusy(false)
        })
      })
    } catch (err) {
      console.error(err)
      setIsBusy(false)
    }
  }

  const handlePxChange = (v) => {
    const val = Math.min(50, Math.max(1, parseInt(v) || 12))
    setPixelSz(val)
    pxRef.current = val
    requestAnimationFrame(() => {
      draw()
    })
  }

  const handlePaletteChange = (v) => {
    setPalette(v)
    palRef.current = v
    draw()
  }

  const handleRedraw = () => {
    if (!loaded) return

    setBusyText('Refreshing pixels...')
    setIsBusy(true)

    requestAnimationFrame(() => {
      draw()
      requestAnimationFrame(() => {
        setIsBusy(false)
      })
    })
  }

  const zoomAtPoint = useCallback((nextZoomRaw, clientX, clientY) => {
    const viewer = viewerRef.current
    if (!viewer) return

    const rect = viewer.getBoundingClientRect()
    const px = clientX - rect.left
    const py = clientY - rect.top

    setZoom(prevZoom => {
      const nextZoom = clamp(nextZoomRaw, MIN_ZOOM, MAX_ZOOM)
      const scaleRatio = nextZoom / prevZoom

      setOffset(prevOffset => ({
        x: px - (px - prevOffset.x) * scaleRatio,
        y: py - (py - prevOffset.y) * scaleRatio,
      }))

      return nextZoom
    })
  }, [])

  const resetView = () => {
    setZoom(1)
    requestAnimationFrame(() => centerView(1))
  }

  const handlePointerDown = (e) => {
    const viewer = viewerRef.current
    if (!viewer || !loaded) return

    canvasRef.current?.setPointerCapture?.(e.pointerId)
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()]
      actionRef.current = {
        type: 'pinch',
        startDistance: getDistance(a, b),
        startZoom: zoom,
        startOffsetX: offset.x,
        startOffsetY: offset.y,
        midpoint: getMidpoint(a, b),
      }
      return
    }

    actionRef.current = {
      type: 'pan',
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startOffsetX: offset.x,
      startOffsetY: offset.y,
    }
  }

  const handlePointerMove = (e) => {
    if (!loaded) return

    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    }

    if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()]
      const pinch = actionRef.current?.type === 'pinch' ? actionRef.current : null
      if (!pinch || !viewerRef.current) return

      const nextDistance = Math.max(1, getDistance(a, b))
      const midpoint = getMidpoint(a, b)
      const viewerRect = viewerRef.current.getBoundingClientRect()
      const nextZoom = clamp((nextDistance / pinch.startDistance) * pinch.startZoom, MIN_ZOOM, MAX_ZOOM)
      const ratio = nextZoom / pinch.startZoom

      setZoom(nextZoom)
      setOffset({
        x: midpoint.x - viewerRect.left - (pinch.midpoint.x - viewerRect.left - pinch.startOffsetX) * ratio,
        y: midpoint.y - viewerRect.top - (pinch.midpoint.y - viewerRect.top - pinch.startOffsetY) * ratio,
      })
      return
    }

    if (e.pointerType === 'mouse' && (e.buttons & 1) !== 1) {
      if (actionRef.current?.type === 'pan') {
        actionRef.current = null
      }
      return
    }

    if (actionRef.current?.type === 'pan') {
      const pan = actionRef.current
      if (pan.pointerId !== e.pointerId) return

      setOffset({
        x: pan.startOffsetX + (e.clientX - pan.startX),
        y: pan.startOffsetY + (e.clientY - pan.startY),
      })
    }
  }

  const stopInteraction = useCallback((pointerId) => {
    if (pointerId !== undefined) {
      pointersRef.current.delete(pointerId)
    }
    actionRef.current = null
  }, [])

  const handlePointerUp = (e) => {
    canvasRef.current?.releasePointerCapture?.(e.pointerId)
    stopInteraction(e.pointerId)
  }

  const handleLostPointerCapture = (e) => {
    stopInteraction(e.pointerId)
  }

  const handleWheel = (e) => {
    if (!loaded) return
    if (!e.ctrlKey && !e.metaKey) return

    e.preventDefault()
    const delta = -e.deltaY
    const factor = delta > 0 ? 1.1 : 0.9
    zoomAtPoint(zoom * factor, e.clientX, e.clientY)
  }

  useEffect(() => {
    const hardStop = () => {
      actionRef.current = null
      pointersRef.current.clear()
    }

    window.addEventListener('mouseup', hardStop)
    window.addEventListener('blur', hardStop)

    return () => {
      window.removeEventListener('mouseup', hardStop)
      window.removeEventListener('blur', hardStop)
    }
  }, [])

  const legendDots = Array.from({ length: 10 }, (_, i) => ({
    digit: i,
    color: getColor(String(i), palette),
  }))

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-surface border-b border-white/5 flex-shrink-0 flex-wrap">
        <label
          htmlFor="fileInputViewer"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer text-xs font-mono font-bold tracking-wider transition-all duration-150 hover:-translate-y-px flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #7c6fff, #40c9ff)' }}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M12 12V4M8 8l4-4 4 4"/>
          </svg>
          {fileName ? fileName.slice(0, 16) + (fileName.length > 16 ? '…' : '') : 'Load .txt'}
        </label>

        <input
          ref={fileInputRef}
          id="fileInputViewer"
          type="file"
          accept=".txt"
          className="hidden"
          onChange={handleFile}
        />

        <div className="w-px h-6 bg-white/5 mx-1 flex-shrink-0" />

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] font-mono font-bold text-white/30 uppercase tracking-widest">PX</span>
          <input
            type="number"
            min="1"
            max="50"
            value={pixelSize}
            onChange={e => handlePxChange(e.target.value)}
            className="w-16 px-2 py-1.5 bg-surface2 border border-white/5 rounded-lg text-xs font-mono text-white/80 focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] font-mono font-bold text-white/30 uppercase tracking-widest">PAL</span>
          <select
            value={palette}
            onChange={e => handlePaletteChange(e.target.value)}
            className="px-2 py-1.5 bg-surface2 border border-white/5 rounded-lg text-xs font-mono text-white/80 focus:outline-none focus:border-accent transition-colors w-36"
          >
            {Object.entries(PALETTES).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setZoom(z => clamp(z / 1.2, MIN_ZOOM, MAX_ZOOM))}
            className="px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all border flex-shrink-0 bg-surface2 border-white/5 text-white/70"
          >
            −
          </button>
          <div className="px-2 py-1.5 bg-surface2 border border-white/5 rounded-lg text-[10px] font-mono text-white/60 min-w-[58px] text-center">
            {Math.round(zoom * 100)}%
          </div>
          <button
            onClick={() => setZoom(z => clamp(z * 1.2, MIN_ZOOM, MAX_ZOOM))}
            className="px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all border flex-shrink-0 bg-surface2 border-white/5 text-white/70"
          >
            +
          </button>
          <button
            onClick={resetView}
            className="px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all border flex-shrink-0 bg-surface2 border-white/5 text-white/70"
          >
            RESET
          </button>
        </div>

        <button
          onClick={handleRedraw}
          className="px-3 py-1.5 bg-surface2 border border-white/5 hover:border-accent/40 hover:bg-accent/5 rounded-lg text-xs font-mono font-bold text-white/60 hover:text-white/90 transition-all duration-150 hover:-translate-y-px flex-shrink-0"
        >
          ↻ REDRAW
        </button>

        {info && (
          <span className="ml-auto text-[10px] font-mono text-white/25 flex-shrink-0 tracking-wider">
            {info}
          </span>
        )}
      </div>

      <div
        ref={viewerRef}
        className="flex-1 overflow-hidden relative bg-bg grid-pattern"
        style={{ touchAction: 'none', WebkitOverflowScrolling: 'touch' }}
        onWheel={handleWheel}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 block"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onLostPointerCapture={handleLostPointerCapture}
        />

        {isBusy && (
          <PXInlineLoader
            label="Loading PX"
            sublabel={busyText}
          />
        )}

        {!loaded && !isBusy && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 pointer-events-none animate-fade-in">
            <div className="w-16 h-16 border-2 border-dashed border-white/10 rounded-2xl flex items-center justify-center">
              <svg className="w-7 h-7 opacity-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
                <rect x="14" y="14" width="7" height="7" rx="1"/>
              </svg>
            </div>

            <p className="text-xs font-mono text-white/25 tracking-widest uppercase">
              Load a .txt file to visualize
            </p>

            <div className="flex gap-1.5 mt-1">
              {legendDots.map(({ digit, color }) => (
                <div
                  key={digit}
                  className="w-3 h-3 rounded-sm"
                  style={{ background: color || '#1a1f2e' }}
                  title={digit}
                />
              ))}
            </div>
          </div>
        )}

        {loaded && !isBusy && (
          <div className="absolute bottom-3 right-3 z-20 pointer-events-none">
            <div className="px-2.5 py-1.5 rounded-lg bg-black/35 border border-white/10 text-[10px] font-mono text-white/60 backdrop-blur-sm">
              Mobile: drag to move · pinch to zoom
            </div>
          </div>
        )}
      </div>
    </div>
  )
}