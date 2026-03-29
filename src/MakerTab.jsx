import { useRef, useState, useCallback, useEffect } from 'react'
import { getColorHex, getColor, PALETTES } from './colors'

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']
const DEFAULT_COLS = 40
const DEFAULT_ROWS = 30
const DEFAULT_CELL = 16
const PALETTE_DEFAULT = 'coolWarm'
const MIN_ZOOM = 0.3
const MAX_ZOOM = 8

function makeGrid(r, c) {
  return Array.from({ length: r }, () => Array(c).fill(null))
}

function rgbToDigit(r, g, b, a) {
  if (a < 30) return null
  const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return String(Math.round(brightness * 9))
}

function getPaletteRGB(digit, palette) {
  const col = getColor(digit, palette)
  if (!col) return null
  const m = col.match(/\d+/g)
  return m ? [+m[0], +m[1], +m[2]] : null
}

function closestDigitByPalette(r, g, b, a, palette) {
  if (a < 30) return null
  let bestDigit = '0'
  let bestDist = Infinity

  for (let d = 0; d <= 9; d++) {
    const rgb = getPaletteRGB(String(d), palette)
    if (!rgb) continue
    const dist = (r - rgb[0]) ** 2 + (g - rgb[1]) ** 2 + (b - rgb[2]) ** 2
    if (dist < bestDist) {
      bestDist = dist
      bestDigit = String(d)
    }
  }

  return bestDigit
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

export default function MakerTab() {
  const [grid, setGrid] = useState(() => makeGrid(DEFAULT_ROWS, DEFAULT_COLS))
  const [rows, setRowCount] = useState(DEFAULT_ROWS)
  const [cols, setColCount] = useState(DEFAULT_COLS)
  const [cellSize, setCellSize] = useState(DEFAULT_CELL)
  const [palette, setPalette] = useState(PALETTE_DEFAULT)
  const [activeDigit, setActive] = useState('5')
  const [tool, setTool] = useState('draw')
  const [exportMsg, setExportMsg] = useState('')
  const [gridLines, setGridLines] = useState(true)
  const [dragOver, setDragOver] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [hoverCell, setHoverCell] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  const [importModal, setImportModal] = useState(false)
  const [importPreview, setImportPreview] = useState(null)
  const [importImgEl, setImportImgEl] = useState(null)
  const [importCols, setImportCols] = useState(60)
  const [importRows, setImportRows] = useState(40)
  const [importMode, setImportMode] = useState('brightness')
  const [importing, setImporting] = useState(false)

  const importFileRef = useRef(null)
  const previewCvsRef = useRef(null)
  const viewerRef = useRef(null)
  const canvasRef = useRef(null)
  const palRef = useRef(PALETTE_DEFAULT)

  const pointersRef = useRef(new Map())
  const actionRef = useRef(null)
  const lastPaintedRef = useRef(null)

  palRef.current = palette

  const effectiveCell = cellSize * zoom

  const TOOLBAR_BUTTON =
    'px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all border flex-shrink-0'

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    if (isMobile && cellSize > 24) setCellSize(20)
  }, [isMobile, cellSize])

  const centerView = useCallback((targetZoom = zoom) => {
    const viewer = viewerRef.current
    if (!viewer) return

    const vw = viewer.clientWidth
    const vh = viewer.clientHeight
    const gridW = cols * cellSize * targetZoom
    const gridH = rows * cellSize * targetZoom

    setOffset({
      x: Math.round((vw - gridW) / 2),
      y: Math.round((vh - gridH) / 2),
    })
  }, [cols, rows, cellSize, zoom])

  useEffect(() => {
    centerView(zoom)
  }, [centerView])

  useEffect(() => {
    const onResize = () => {
      const canvas = canvasRef.current
      const viewer = viewerRef.current
      if (!canvas || !viewer) return
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.max(1, Math.floor(viewer.clientWidth * dpr))
      canvas.height = Math.max(1, Math.floor(viewer.clientHeight * dpr))
      canvas.style.width = `${viewer.clientWidth}px`
      canvas.style.height = `${viewer.clientHeight}px`
      centerView(zoom)
    }

    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [centerView, zoom])

  useEffect(() => {
    const hardStop = () => {
      actionRef.current = null
      lastPaintedRef.current = null
      pointersRef.current.clear()
      setHoverCell(null)
    }

    window.addEventListener('mouseup', hardStop)
    window.addEventListener('blur', hardStop)

    return () => {
      window.removeEventListener('mouseup', hardStop)
      window.removeEventListener('blur', hardStop)
    }
  }, [])

  const resize = useCallback((newR, newC) => {
    const safeR = clamp(newR, 4, 200)
    const safeC = clamp(newC, 4, 200)

    setGrid(prev => {
      const g = makeGrid(safeR, safeC)
      for (let r = 0; r < Math.min(prev.length, safeR); r++) {
        for (let c = 0; c < Math.min((prev[0] || []).length, safeC); c++) {
          g[r][c] = prev[r][c]
        }
      }
      return g
    })

    setRowCount(safeR)
    setColCount(safeC)
  }, [])

  const clearAll = () => setGrid(makeGrid(rows, cols))

  const applyCell = useCallback((r, c) => {
    if (r < 0 || c < 0 || r >= rows || c >= cols) return

    setGrid(prev => {
      const next = prev.map(row => [...row])
      next[r][c] = tool === 'erase' ? null : activeDigit
      return next
    })
  }, [rows, cols, tool, activeDigit])

  const exportTxt = () => {
    const text = grid
      .map(row => row.map(cell => (cell === null ? ' ' : cell)).join('').replace(/\s+$/g, ''))
      .join('\n')

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'pxvw-output.txt'
    a.click()
    URL.revokeObjectURL(a.href)

    setExportMsg('TXT exported')
    setTimeout(() => setExportMsg(''), 2000)
  }

  const copyTxt = async () => {
    const text = grid
      .map(row => row.map(cell => (cell === null ? ' ' : cell)).join('').replace(/\s+$/g, ''))
      .join('\n')

    try {
      await navigator.clipboard.writeText(text)
      setExportMsg('TXT copied')
    } catch {
      setExportMsg('Copy failed')
    }
    setTimeout(() => setExportMsg(''), 2000)
  }

  const exportPng = () => {
    const cvs = document.createElement('canvas')
    cvs.width = cols
    cvs.height = rows
    const ctx = cvs.getContext('2d')

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const digit = grid[r]?.[c]
        if (digit === null) continue
        ctx.fillStyle = getColor(digit, palette)
        ctx.fillRect(c, r, 1, 1)
      }
    }

    const scaled = document.createElement('canvas')
    const scale = 16
    scaled.width = cols * scale
    scaled.height = rows * scale
    const sctx = scaled.getContext('2d')
    sctx.imageSmoothingEnabled = false
    sctx.drawImage(cvs, 0, 0, scaled.width, scaled.height)

    const a = document.createElement('a')
    a.href = scaled.toDataURL('image/png')
    a.download = 'pxvw-output.png'
    a.click()

    setExportMsg('PNG exported')
    setTimeout(() => setExportMsg(''), 2000)
  }

  const loadFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return

    const url = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      setImportImgEl(img)
      setImportPreview(url)
      const aspect = img.height / img.width
      const c = 60
      setImportCols(c)
      setImportRows(Math.max(4, Math.round(c * aspect)))
    }

    img.src = url
    setImportModal(true)
  }

  const handleImportFile = (e) => {
    loadFile(e.target.files[0])
    e.target.value = ''
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    loadFile(e.dataTransfer.files[0])
  }

  const handleColsChange = (v) => {
    const c = clamp(+v || importCols, 4, 200)
    setImportCols(c)
    if (importImgEl) {
      setImportRows(clamp(Math.round(c * importImgEl.height / importImgEl.width), 4, 200))
    }
  }

  useEffect(() => {
    if (!importImgEl || !previewCvsRef.current || !importModal) return

    const cvs = previewCvsRef.current
    const ctx = cvs.getContext('2d')
    const iC = clamp(importCols, 4, 200)
    const iR = clamp(importRows, 4, 200)

    cvs.width = iC
    cvs.height = iR

    ctx.drawImage(importImgEl, 0, 0, iC, iR)
    const imgData = ctx.getImageData(0, 0, iC, iR)
    const d = imgData.data

    for (let r = 0; r < iR; r++) {
      for (let c = 0; c < iC; c++) {
        const i = (r * iC + c) * 4
        const digit = importMode === 'palette'
          ? closestDigitByPalette(d[i], d[i + 1], d[i + 2], d[i + 3], palRef.current)
          : rgbToDigit(d[i], d[i + 1], d[i + 2], d[i + 3])

        if (digit === null) {
          d[i + 3] = 0
          continue
        }

        const col = getColor(digit, palRef.current)
        const m = col.match(/\d+/g)
        d[i] = +m[0]
        d[i + 1] = +m[1]
        d[i + 2] = +m[2]
        d[i + 3] = 255
      }
    }

    ctx.putImageData(imgData, 0, 0)
  }, [importImgEl, importCols, importRows, importMode, importModal, palette])

  const applyImport = () => {
    if (!importImgEl) return

    setImporting(true)

    setTimeout(() => {
      const iC = clamp(importCols, 4, 200)
      const iR = clamp(importRows, 4, 200)

      const cvs = document.createElement('canvas')
      cvs.width = iC
      cvs.height = iR

      const ctx = cvs.getContext('2d')
      ctx.drawImage(importImgEl, 0, 0, iC, iR)

      const imgData = ctx.getImageData(0, 0, iC, iR)
      const d = imgData.data

      const next = makeGrid(iR, iC)

      for (let r = 0; r < iR; r++) {
        for (let c = 0; c < iC; c++) {
          const i = (r * iC + c) * 4
          next[r][c] = importMode === 'palette'
            ? closestDigitByPalette(d[i], d[i + 1], d[i + 2], d[i + 3], palRef.current)
            : rgbToDigit(d[i], d[i + 1], d[i + 2], d[i + 3])
        }
      }

      setGrid(next)
      setRowCount(iR)
      setColCount(iC)
      setImportModal(false)
      setImportPreview(null)
      setImportImgEl(null)
      setImporting(false)
      setExportMsg('Image converted')
      setTimeout(() => setExportMsg(''), 2000)

      setZoom(1)
      requestAnimationFrame(() => centerView(1))
    }, 40)
  }

  const getCellFromClientPoint = useCallback((clientX, clientY) => {
    const viewer = viewerRef.current
    if (!viewer) return null

    const rect = viewer.getBoundingClientRect()
    const localX = clientX - rect.left
    const localY = clientY - rect.top

    const gx = (localX - offset.x) / effectiveCell
    const gy = (localY - offset.y) / effectiveCell

    const c = Math.floor(gx)
    const r = Math.floor(gy)

    if (r < 0 || c < 0 || r >= rows || c >= cols) return null
    return { r, c }
  }, [offset, effectiveCell, rows, cols])

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

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const viewer = viewerRef.current
    if (!canvas || !viewer) return

    const dpr = window.devicePixelRatio || 1
    const width = viewer.clientWidth
    const height = viewer.clientHeight

    canvas.width = Math.max(1, Math.floor(width * dpr))
    canvas.height = Math.max(1, Math.floor(height * dpr))
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    ctx.imageSmoothingEnabled = false

    const startCol = clamp(Math.floor((-offset.x) / effectiveCell) - 1, 0, cols)
    const endCol = clamp(Math.ceil((width - offset.x) / effectiveCell) + 1, 0, cols)
    const startRow = clamp(Math.floor((-offset.y) / effectiveCell) - 1, 0, rows)
    const endRow = clamp(Math.ceil((height - offset.y) / effectiveCell) + 1, 0, rows)

    for (let r = startRow; r < endRow; r++) {
      for (let c = startCol; c < endCol; c++) {
        const digit = grid[r]?.[c]
        if (digit === null) continue
        ctx.fillStyle = getColor(digit, palette)
        ctx.fillRect(
          offset.x + c * effectiveCell,
          offset.y + r * effectiveCell,
          effectiveCell,
          effectiveCell
        )
      }
    }

    if (gridLines && effectiveCell >= 8) {
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'
      ctx.lineWidth = 1

      for (let c = startCol; c <= endCol; c++) {
        const x = Math.round(offset.x + c * effectiveCell) + 0.5
        ctx.beginPath()
        ctx.moveTo(x, Math.max(0, offset.y + startRow * effectiveCell))
        ctx.lineTo(x, Math.min(height, offset.y + endRow * effectiveCell))
        ctx.stroke()
      }

      for (let r = startRow; r <= endRow; r++) {
        const y = Math.round(offset.y + r * effectiveCell) + 0.5
        ctx.beginPath()
        ctx.moveTo(Math.max(0, offset.x + startCol * effectiveCell), y)
        ctx.lineTo(Math.min(width, offset.x + endCol * effectiveCell), y)
        ctx.stroke()
      }
    }

    if (hoverCell && hoverCell.r >= 0 && hoverCell.c >= 0 && hoverCell.r < rows && hoverCell.c < cols) {
      ctx.strokeStyle = tool === 'erase'
        ? 'rgba(255,95,95,0.95)'
        : tool === 'move'
          ? 'rgba(64,201,255,0.95)'
          : 'rgba(255,255,255,0.95)'
      ctx.lineWidth = 1.5
      ctx.strokeRect(
        offset.x + hoverCell.c * effectiveCell + 0.75,
        offset.y + hoverCell.r * effectiveCell + 0.75,
        effectiveCell - 1.5,
        effectiveCell - 1.5
      )
    }
  }, [grid, rows, cols, effectiveCell, palette, gridLines, hoverCell, tool, offset])

  useEffect(() => {
    drawCanvas()
  }, [drawCanvas])

  const startPan = (clientX, clientY) => {
    actionRef.current = {
      type: 'pan',
      startX: clientX,
      startY: clientY,
      startOffsetX: offset.x,
      startOffsetY: offset.y,
    }
  }

  const stopInteraction = useCallback((pointerId) => {
    if (pointerId !== undefined) {
      pointersRef.current.delete(pointerId)
    }

    actionRef.current = null
    lastPaintedRef.current = null

    if (pointersRef.current.size === 0) {
      setHoverCell(null)
    }
  }, [])

  const handlePointerDown = (e) => {
    const viewer = viewerRef.current
    if (!viewer) return

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

    if (tool === 'move') {
      actionRef.current = {
        type: 'pan',
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startOffsetX: offset.x,
        startOffsetY: offset.y,
      }
      return
    }

    const cell = getCellFromClientPoint(e.clientX, e.clientY)
    setHoverCell(cell)

    if (!cell) {
      actionRef.current = null
      return
    }

    e.preventDefault()
    actionRef.current = {
      type: 'paint',
      pointerId: e.pointerId,
    }
    lastPaintedRef.current = `${cell.r}-${cell.c}`
    applyCell(cell.r, cell.c)
  }

  const handlePointerMove = (e) => {
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    }

    if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()]
      const pinch = actionRef.current?.type === 'pinch' ? actionRef.current : null
      if (!pinch) return

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

    const cell = getCellFromClientPoint(e.clientX, e.clientY)
    setHoverCell(cell)

    if (e.pointerType === 'mouse' && (e.buttons & 1) !== 1) {
      if (actionRef.current?.type === 'paint') {
        actionRef.current = null
        lastPaintedRef.current = null
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
      return
    }

    if (actionRef.current?.type === 'paint') {
      if (actionRef.current.pointerId !== e.pointerId) return
      if (!cell) return

      const key = `${cell.r}-${cell.c}`
      if (lastPaintedRef.current !== key) {
        lastPaintedRef.current = key
        applyCell(cell.r, cell.c)
      }
    }
  }

  const handlePointerUp = (e) => {
    canvasRef.current?.releasePointerCapture?.(e.pointerId)
    stopInteraction(e.pointerId)
  }

  const handleLostPointerCapture = (e) => {
    stopInteraction(e.pointerId)
  }

  const handleWheel = (e) => {
    if (!viewerRef.current) return

    if (!e.ctrlKey && !e.metaKey) return
    e.preventDefault()

    const delta = -e.deltaY
    const factor = delta > 0 ? 1.1 : 0.9
    zoomAtPoint(zoom * factor, e.clientX, e.clientY)
  }

  const closeImportModal = () => {
    setImportModal(false)
    setImportPreview(null)
    setImportImgEl(null)
  }

  const tabs = [
    { id: 'draw', label: 'Draw', icon: '✦' },
    { id: 'erase', label: 'Erase', icon: '⌫' },
    { id: 'move', label: 'Move', icon: '✥' },
  ]

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 md:px-4 py-2.5 bg-surface border-b border-white/5 flex-shrink-0 overflow-x-auto">
        <div className="flex items-center gap-1 flex-shrink-0">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              className={`${TOOLBAR_BUTTON} ${
                tool === t.id
                  ? 'bg-accent text-white border-accent/30'
                  : 'bg-surface2 border-white/5 text-white/40 hover:text-white/70'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-white/5 mx-0.5 flex-shrink-0" />

        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-[10px] font-mono font-bold text-white/30 uppercase tracking-widest mr-1">Digit</span>
          {DIGITS.map(d => (
            <button
              key={d}
              onClick={() => { setActive(d); setTool('draw') }}
              className={`w-7 h-7 rounded-md text-xs font-mono font-bold transition-all border ${
                activeDigit === d && tool !== 'erase'
                  ? 'border-white/60 scale-110'
                  : 'border-transparent hover:scale-105'
              }`}
              style={{
                background: getColorHex(d, palette) || '#1a1f2e',
                color: '#fff',
                textShadow: '0 1px 3px rgba(0,0,0,0.8)',
              }}
            >
              {d}
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-white/5 mx-0.5 flex-shrink-0" />

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] font-mono font-bold text-white/30 uppercase tracking-widest">PAL</span>
          <select
            value={palette}
            onChange={e => setPalette(e.target.value)}
            className="px-2 py-1.5 bg-surface2 border border-white/5 rounded-lg text-xs font-mono text-white/80 focus:outline-none focus:border-accent w-32"
          >
            {Object.entries(PALETTES).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] font-mono font-bold text-white/30 uppercase tracking-widest">SIZE</span>
          <input
            type="range"
            min="4"
            max="40"
            value={cellSize}
            onChange={e => setCellSize(+e.target.value)}
            className="w-20 accent-accent"
          />
          <span className="text-[10px] font-mono text-white/30 w-6">{cellSize}</span>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setZoom(z => clamp(z / 1.2, MIN_ZOOM, MAX_ZOOM))}
            className={`${TOOLBAR_BUTTON} bg-surface2 border-white/5 text-white/70`}
          >
            −
          </button>
          <div className="px-2 py-1.5 bg-surface2 border border-white/5 rounded-lg text-[10px] font-mono text-white/60 min-w-[58px] text-center">
            {Math.round(zoom * 100)}%
          </div>
          <button
            onClick={() => setZoom(z => clamp(z * 1.2, MIN_ZOOM, MAX_ZOOM))}
            className={`${TOOLBAR_BUTTON} bg-surface2 border-white/5 text-white/70`}
          >
            +
          </button>
          <button
            onClick={resetView}
            className={`${TOOLBAR_BUTTON} bg-surface2 border-white/5 text-white/70`}
          >
            RESET
          </button>
        </div>

        <button
          onClick={() => setGridLines(g => !g)}
          className={`${TOOLBAR_BUTTON} ${
            gridLines
              ? 'bg-accent/10 border-accent/30 text-accent'
              : 'bg-surface2 border-white/5 text-white/30'
          }`}
        >
          GRID
        </button>

        <div className="flex items-center gap-1 flex-shrink-0">
          <input
            type="number"
            min="4"
            max="200"
            value={cols}
            onChange={e => resize(rows, Math.max(4, Math.min(200, +e.target.value || cols)))}
            className="w-14 px-2 py-1.5 bg-surface2 border border-white/5 rounded-lg text-xs font-mono text-white/80 focus:outline-none focus:border-accent"
            title="Columns"
          />
          <span className="text-white/20 text-xs font-mono">×</span>
          <input
            type="number"
            min="4"
            max="200"
            value={rows}
            onChange={e => resize(Math.max(4, Math.min(200, +e.target.value || rows)), cols)}
            className="w-14 px-2 py-1.5 bg-surface2 border border-white/5 rounded-lg text-xs font-mono text-white/80 focus:outline-none focus:border-accent"
            title="Rows"
          />
        </div>

        <div className="w-px h-6 bg-white/5 mx-0.5 flex-shrink-0" />

        <button
          onClick={() => importFileRef.current?.click()}
          className={`${TOOLBAR_BUTTON} bg-surface2 border-white/5 text-white/40 hover:text-white`}
        >
          IMG
        </button>
        <input
          ref={importFileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImportFile}
        />

        <button
          onClick={clearAll}
          className="px-3 py-1.5 bg-surface2 border border-white/5 hover:border-red-500/30 hover:text-red-400 rounded-lg text-xs font-mono font-bold text-white/40 transition-all flex-shrink-0"
        >
          CLEAR
        </button>

        <button
          onClick={copyTxt}
          className="px-3 py-1.5 bg-surface2 border border-white/5 hover:border-accent/40 hover:text-white rounded-lg text-xs font-mono font-bold text-white/40 transition-all flex-shrink-0"
        >
          COPY TXT
        </button>

        <button
          onClick={exportTxt}
          className="px-3 py-1.5 bg-surface2 border border-white/5 hover:border-accent2/40 hover:text-accent2 rounded-lg text-xs font-mono font-bold text-white/40 transition-all flex-shrink-0"
        >
          ↓ TXT
        </button>

        <button
          onClick={exportPng}
          className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all hover:-translate-y-px flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,#7c6fff,#40c9ff)', color: '#fff' }}
        >
          ↓ PNG
        </button>

        {exportMsg && (
          <span className="text-xs font-mono text-accent2 animate-fade-in flex-shrink-0">
            {exportMsg}
          </span>
        )}
      </div>

      <div
        ref={viewerRef}
        className="flex-1 relative bg-bg grid-pattern overflow-hidden"
        style={{
          cursor: tool === 'move' ? 'grab' : tool === 'erase' ? 'cell' : 'crosshair',
          touchAction: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onWheel={handleWheel}
      >
        {dragOver && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-bg/90 border-2 border-dashed border-accent/50 pointer-events-none">
            <svg className="w-12 h-12 text-accent/60 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            <p className="text-sm font-mono text-accent/80 tracking-widest uppercase">
              Drop image to convert
            </p>
          </div>
        )}

        <canvas
          ref={canvasRef}
          className="absolute inset-0 block"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onLostPointerCapture={handleLostPointerCapture}
          onPointerLeave={() => {
            if (pointersRef.current.size === 0) setHoverCell(null)
          }}
        />

        <div className="absolute bottom-3 right-3 z-20 pointer-events-none">
          <div className="px-2.5 py-1.5 rounded-lg bg-black/35 border border-white/10 text-[10px] font-mono text-white/60 backdrop-blur-sm">
            Mobile: pinch to zoom · Move tool to pan
          </div>
        </div>
      </div>

      {importModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-bg/85 backdrop-blur-sm">
          <div className="bg-surface border border-white/8 rounded-2xl w-full max-w-2xl mx-3 md:mx-4 overflow-hidden animate-slide-up shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg,#ff6b9d,#7c6fff)' }}
                >
                  <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                </div>
                <span className="text-sm font-mono font-bold text-white/80 tracking-wider">
                  Image → Pixel Art
                </span>
              </div>

              <button
                onClick={closeImportModal}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-all font-mono"
              >
                ✕
              </button>
            </div>

            <div className="p-4 md:p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-mono text-white/25 uppercase tracking-widest mb-2">Original</p>
                <div className="rounded-xl overflow-hidden bg-surface2 border border-white/5 flex items-center justify-center h-[180px]">
                  {importPreview ? (
                    <img src={importPreview} alt="Import preview" className="max-w-full max-h-full object-contain" />
                  ) : (
                    <span className="text-white/20 text-xs font-mono">No preview</span>
                  )}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-mono text-white/25 uppercase tracking-widest mb-2">Converted Preview</p>
                <div className="rounded-xl overflow-hidden bg-surface2 border border-white/5 flex items-center justify-center h-[180px] p-3">
                  <canvas
                    ref={previewCvsRef}
                    className="max-w-full max-h-full object-contain"
                    style={{ imageRendering: 'pixelated' }}
                  />
                </div>
              </div>
            </div>

            <div className="px-4 md:px-5 pb-5 flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-mono text-white/25 uppercase tracking-widest mb-1.5">
                    Columns
                  </label>
                  <input
                    type="number"
                    min="4"
                    max="200"
                    value={importCols}
                    onChange={e => handleColsChange(e.target.value)}
                    className="w-full px-3 py-2 bg-surface2 border border-white/5 rounded-lg text-xs font-mono text-white/80 focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-white/25 uppercase tracking-widest mb-1.5">
                    Rows
                  </label>
                  <input
                    type="number"
                    min="4"
                    max="200"
                    value={importRows}
                    onChange={e => setImportRows(clamp(+e.target.value || importRows, 4, 200))}
                    className="w-full px-3 py-2 bg-surface2 border border-white/5 rounded-lg text-xs font-mono text-white/80 focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-white/25 uppercase tracking-widest mb-1.5">
                    Mode
                  </label>
                  <select
                    value={importMode}
                    onChange={e => setImportMode(e.target.value)}
                    className="w-full px-3 py-2 bg-surface2 border border-white/5 rounded-lg text-xs font-mono text-white/80 focus:outline-none focus:border-accent"
                  >
                    <option value="brightness">Brightness</option>
                    <option value="palette">Palette Match</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={closeImportModal}
                  className="px-3 py-2 bg-surface2 border border-white/5 rounded-lg text-xs font-mono font-bold text-white/50 hover:text-white transition-all"
                >
                  Cancel
                </button>

                <button
                  onClick={applyImport}
                  disabled={importing}
                  className="px-3 py-2 rounded-lg text-xs font-mono font-bold text-white disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#7c6fff,#40c9ff)' }}
                >
                  {importing ? 'Converting...' : 'Apply Import'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}