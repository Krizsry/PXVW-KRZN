import { useRef, useState, useEffect, useCallback } from 'react'
import { getColor, PALETTES } from './colors'

const BUFFER = 25

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

export default function ViewerTab() {
  const fileInputRef   = useRef(null)
  const viewerRef      = useRef(null)
  const viewerInnerRef = useRef(null)
  const canvasWrapRef  = useRef(null)
  const canvasRef      = useRef(null)

  const [rows, setRows]           = useState([])
  const [maxCols, setMaxCols]     = useState(0)
  const [pixelSize, setPixelSz]   = useState(12)
  const [palette, setPalette]     = useState('coolWarm')
  const [info, setInfo]           = useState('')
  const [loaded, setLoaded]       = useState(false)
  const [fileName, setFileName]   = useState('')
  const [isBusy, setIsBusy]       = useState(false)
  const [busyText, setBusyText]   = useState('Rendering pixels...')

  const rowsRef      = useRef([])
  const maxColsRef   = useRef(0)
  const pxRef        = useRef(12)
  const palRef       = useRef('coolWarm')

  rowsRef.current    = rows
  maxColsRef.current = maxCols
  pxRef.current      = pixelSize
  palRef.current     = palette

  const updateLayout = useCallback(() => {
    const ps = pxRef.current
    const mc = maxColsRef.current
    const rs = rowsRef.current
    const viewer = viewerRef.current
    if (!viewer) return

    const totalW = mc * ps
    const totalH = rs.length * ps

    if (canvasWrapRef.current) {
      canvasWrapRef.current.style.width  = totalW + 'px'
      canvasWrapRef.current.style.height = totalH + 'px'
    }

    if (viewerInnerRef.current) {
      viewerInnerRef.current.style.minHeight =
        Math.max(viewer.clientHeight, totalH + 40) + 'px'
    }
  }, [])

  const draw = useCallback(() => {
    const rs = rowsRef.current
    if (!rs.length) return

    const viewer = viewerRef.current
    const canvas = canvasRef.current
    if (!viewer || !canvas) return

    const ctx = canvas.getContext('2d')
    const ps = pxRef.current
    const mc = maxColsRef.current
    const pal = palRef.current

    const scrollTop  = viewer.scrollTop
    const scrollLeft = viewer.scrollLeft
    const vH = viewer.clientHeight
    const vW = viewer.clientWidth

    const startRow = Math.max(0, Math.floor(scrollTop / ps) - BUFFER)
    const endRow   = Math.min(rs.length, Math.ceil((scrollTop + vH) / ps) + BUFFER)
    const startCol = Math.max(0, Math.floor(scrollLeft / ps) - BUFFER)
    const endCol   = Math.min(mc, Math.ceil((scrollLeft + vW) / ps) + BUFFER)

    const drawW = Math.max(1, (endCol - startCol) * ps)
    const drawH = Math.max(1, (endRow - startRow) * ps)

    canvas.width  = drawW
    canvas.height = drawH
    canvas.style.position = 'absolute'
    canvas.style.left = `${startCol * ps}px`
    canvas.style.top  = `${startRow * ps}px`

    ctx.clearRect(0, 0, drawW, drawH)

    for (let r = startRow; r < endRow; r++) {
      const row = rs[r]
      const y = (r - startRow) * ps

      for (let c = startCol; c < endCol; c++) {
        const ch = row[c]
        if (!ch || ch < '0' || ch > '9') continue
        ctx.fillStyle = getColor(ch, pal)
        ctx.fillRect((c - startCol) * ps, y, ps, ps)
      }
    }

    const palLabel = PALETTES[pal]?.label || pal
    setInfo(`${rs.length.toLocaleString()} rows · ${mc} cols · ${startRow}–${endRow - 1} · ${palLabel}`)
  }, [])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    const onScroll = () => draw()
    viewer.addEventListener('scroll', onScroll)
    return () => viewer.removeEventListener('scroll', onScroll)
  }, [draw])

  useEffect(() => {
    const onResize = () => {
      updateLayout()
      draw()
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [updateLayout, draw])

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

      requestAnimationFrame(() => {
        if (viewerRef.current) {
          viewerRef.current.scrollTop = 0
          viewerRef.current.scrollLeft = 0
        }

        updateLayout()
        draw()

        requestAnimationFrame(() => {
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
    updateLayout()
    draw()
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
      updateLayout()
      draw()

      requestAnimationFrame(() => {
        setIsBusy(false)
      })
    })
  }

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
            <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 12V4M8 8l4-4 4 4"/>
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

      <div ref={viewerRef} className="flex-1 overflow-auto relative bg-bg grid-pattern">
        <div ref={viewerInnerRef} className="min-w-full min-h-full flex items-start justify-center">
          <div ref={canvasWrapRef} className="relative">
            <canvas ref={canvasRef} />
          </div>
        </div>

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
      </div>
    </div>
  )
}