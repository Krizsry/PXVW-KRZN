import { useRef, useState, useCallback, useEffect } from 'react'
import { getColorHex, getColor, PALETTES } from './colors'

const DIGITS = ['0','1','2','3','4','5','6','7','8','9']
const DEFAULT_COLS = 40
const DEFAULT_ROWS = 30
const DEFAULT_CELL = 16
const PALETTE_DEFAULT = 'coolWarm'

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
  let bestDigit = '0', bestDist = Infinity
  for (let d = 0; d <= 9; d++) {
    const rgb = getPaletteRGB(String(d), palette)
    if (!rgb) continue
    const dist = (r - rgb[0]) ** 2 + (g - rgb[1]) ** 2 + (b - rgb[2]) ** 2
    if (dist < bestDist) { bestDist = dist; bestDigit = String(d) }
  }
  return bestDigit
}

export default function MakerTab() {
  const [grid, setGrid]           = useState(() => makeGrid(DEFAULT_ROWS, DEFAULT_COLS))
  const [rows, setRowCount]       = useState(DEFAULT_ROWS)
  const [cols, setColCount]       = useState(DEFAULT_COLS)
  const [cellSize, setCellSize]   = useState(DEFAULT_CELL)
  const [palette, setPalette]     = useState(PALETTE_DEFAULT)
  const [activeDigit, setActive]  = useState('5')
  const [tool, setTool]           = useState('draw')
  const [painting, setPainting]   = useState(false)
  const [exportMsg, setExportMsg] = useState('')
  const [gridLines, setGridLines] = useState(true)

  // Image import
  const [importModal, setImportModal]     = useState(false)
  const [importPreview, setImportPreview] = useState(null)
  const [importImgEl, setImportImgEl]     = useState(null)
  const [importCols, setImportCols]       = useState(60)
  const [importRows, setImportRows]       = useState(40)
  const [importMode, setImportMode]       = useState('brightness')
  const [importing, setImporting]         = useState(false)
  const [dragOver, setDragOver]           = useState(false)
  const importFileRef  = useRef(null)
  const previewCvsRef  = useRef(null)
  const palRef         = useRef(PALETTE_DEFAULT)
  palRef.current       = palette

  const resize = (newR, newC) => {
    setGrid(prev => {
      const g = makeGrid(newR, newC)
      for (let r = 0; r < Math.min(prev.length, newR); r++)
        for (let c = 0; c < Math.min((prev[0]||[]).length, newC); c++)
          g[r][c] = prev[r][c]
      return g
    })
    setRowCount(newR); setColCount(newC)
  }

  const floodFill = (g, r, c, target, rep) => {
    if (target === rep) return null
    const next = g.map(row => [...row])
    const stack = [[r, c]]
    while (stack.length) {
      const [cr, cc] = stack.pop()
      if (cr < 0 || cr >= next.length || cc < 0 || cc >= next[0].length) continue
      if (next[cr][cc] !== target) continue
      next[cr][cc] = rep
      stack.push([cr-1,cc],[cr+1,cc],[cr,cc-1],[cr,cc+1])
    }
    return next
  }

  const applyCell = useCallback((r, c) => {
    if (r < 0 || r >= rows || c < 0 || c >= cols) return
    setGrid(prev => {
      const g = prev.map(row => [...row])
      if (tool === 'erase') { g[r][c] = null }
      else if (tool === 'fill') { const f = floodFill(g, r, c, prev[r][c], activeDigit); if (f) return f }
      else { g[r][c] = activeDigit }
      return g
    })
  }, [tool, activeDigit, rows, cols])

  const handleMouseDown  = (r, c) => { setPainting(true); applyCell(r, c) }
  const handleMouseEnter = (r, c) => { if (painting) applyCell(r, c) }

  useEffect(() => {
    const up = () => setPainting(false)
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  }, [])

  const clearAll = () => setGrid(makeGrid(rows, cols))

  const exportTxt = () => {
    const txt = grid.map(row => row.map(c => c ?? ' ').join('')).join('\n')
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([txt], { type: 'text/plain' })),
      download: 'pixel-art-krzn.txt'
    }); a.click()
    setExportMsg('Exported!'); setTimeout(() => setExportMsg(''), 2000)
  }

  const exportPng = () => {
    const ps = Math.max(cellSize, 4)
    const cvs = document.createElement('canvas')
    cvs.width = cols * ps; cvs.height = rows * ps
    const ctx = cvs.getContext('2d')
    ctx.fillStyle = '#07090e'; ctx.fillRect(0, 0, cvs.width, cvs.height)
    grid.forEach((row, r) => row.forEach((cell, c) => {
      if (!cell) return
      ctx.fillStyle = getColorHex(cell, palette)
      ctx.fillRect(c * ps, r * ps, ps, ps)
    }))
    cvs.toBlob(blob => {
      const a = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(blob), download: 'pixel-art-krzn.png'
      }); a.click()
      setExportMsg('PNG saved!'); setTimeout(() => setExportMsg(''), 2000)
    })
  }

  const copyTxt = () => {
    navigator.clipboard.writeText(grid.map(row => row.map(c => c ?? ' ').join('')).join('\n'))
    setExportMsg('Copied!'); setTimeout(() => setExportMsg(''), 2000)
  }

  // ── Image import ─────────────────────────────────────────────────────────
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

  const handleImportFile = (e) => { loadFile(e.target.files[0]); e.target.value = '' }
  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); loadFile(e.dataTransfer.files[0]) }

  const handleColsChange = (v) => {
    const c = Math.max(4, Math.min(200, +v || importCols))
    setImportCols(c)
    if (importImgEl) setImportRows(Math.max(4, Math.min(200, Math.round(c * importImgEl.height / importImgEl.width))))
  }

  // Live preview in modal
  useEffect(() => {
    if (!importImgEl || !previewCvsRef.current || !importModal) return
    const cvs = previewCvsRef.current
    const ctx = cvs.getContext('2d')
    const iC = Math.max(4, Math.min(200, importCols))
    const iR = Math.max(4, Math.min(200, importRows))
    cvs.width = iC; cvs.height = iR
    ctx.drawImage(importImgEl, 0, 0, iC, iR)
    const imgData = ctx.getImageData(0, 0, iC, iR)
    const d = imgData.data
    for (let r = 0; r < iR; r++) {
      for (let c = 0; c < iC; c++) {
        const i = (r * iC + c) * 4
        const digit = importMode === 'palette'
          ? closestDigitByPalette(d[i], d[i+1], d[i+2], d[i+3], palRef.current)
          : rgbToDigit(d[i], d[i+1], d[i+2], d[i+3])
        if (digit === null) { d[i+3] = 0; continue }
        const col = getColor(digit, palRef.current)
        const m = col.match(/\d+/g)
        d[i] = +m[0]; d[i+1] = +m[1]; d[i+2] = +m[2]; d[i+3] = 255
      }
    }
    ctx.putImageData(imgData, 0, 0)
  }, [importImgEl, importCols, importRows, importMode, importModal, palette])

  const applyImport = () => {
    if (!importImgEl) return
    setImporting(true)
    setTimeout(() => {
      const iC = Math.max(4, Math.min(200, importCols))
      const iR = Math.max(4, Math.min(200, importRows))
      const cvs = document.createElement('canvas')
      cvs.width = iC; cvs.height = iR
      const ctx = cvs.getContext('2d')
      ctx.drawImage(importImgEl, 0, 0, iC, iR)
      const d = ctx.getImageData(0, 0, iC, iR).data
      const newGrid = makeGrid(iR, iC)
      for (let r = 0; r < iR; r++)
        for (let c = 0; c < iC; c++) {
          const i = (r * iC + c) * 4
          newGrid[r][c] = importMode === 'palette'
            ? closestDigitByPalette(d[i], d[i+1], d[i+2], d[i+3], palRef.current)
            : rgbToDigit(d[i], d[i+1], d[i+2], d[i+3])
        }
      setGrid(newGrid); setRowCount(iR); setColCount(iC)
      setImporting(false); setImportModal(false)
      setImportPreview(null); setImportImgEl(null)
    }, 10)
  }

  const TOOL_BTNS = [
    { id: 'draw',  icon: '✏', label: 'Draw'  },
    { id: 'erase', icon: '◻', label: 'Erase' },
    { id: 'fill',  icon: '▣', label: 'Fill'  },
  ]

  return (
    <div className="flex flex-col h-full relative">

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-surface border-b border-white/5 flex-shrink-0 flex-wrap gap-y-2">

        {/* IMG import */}
        <button
          onClick={() => importFileRef.current?.click()}
          title="Import image → pixel art"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold tracking-wider transition-all hover:-translate-y-px flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,#ff6b9d,#7c6fff)', color: '#fff' }}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <path d="M21 15l-5-5L5 21"/>
          </svg>
          IMG → PX
        </button>
        <input ref={importFileRef} type="file" accept="image/*" className="hidden" onChange={handleImportFile} />

        <div className="w-px h-6 bg-white/5 mx-0.5 flex-shrink-0" />

        {/* Draw tools */}
        <div className="flex items-center gap-1 bg-surface2 rounded-lg p-0.5 flex-shrink-0">
          {TOOL_BTNS.map(t => (
            <button key={t.id} onClick={() => setTool(t.id)}
              className={`px-3 py-1 rounded-md text-xs font-mono font-bold transition-all duration-150 ${tool === t.id ? 'bg-accent text-white' : 'text-white/40 hover:text-white/70'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-white/5 mx-0.5 flex-shrink-0" />

        {/* Digit picker */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-[10px] font-mono font-bold text-white/30 uppercase tracking-widest mr-1">Digit</span>
          {DIGITS.map(d => (
            <button key={d} onClick={() => { setActive(d); setTool('draw') }}
              className={`w-7 h-7 rounded-md text-xs font-mono font-bold transition-all border ${activeDigit===d&&tool!=='erase'?'border-white/60 scale-110':'border-transparent hover:scale-105'}`}
              style={{ background: getColorHex(d,palette)||'#1a1f2e', color:'#fff', textShadow:'0 1px 3px rgba(0,0,0,.8)' }}>
              {d}
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-white/5 mx-0.5 flex-shrink-0" />

        {/* Palette */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] font-mono font-bold text-white/30 uppercase tracking-widest">PAL</span>
          <select value={palette} onChange={e => setPalette(e.target.value)}
            className="px-2 py-1.5 bg-surface2 border border-white/5 rounded-lg text-xs font-mono text-white/80 focus:outline-none focus:border-accent w-32">
            {Object.entries(PALETTES).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>

        {/* Cell size */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] font-mono font-bold text-white/30 uppercase tracking-widest">SIZE</span>
          <input type="range" min="4" max="40" value={cellSize} onChange={e=>setCellSize(+e.target.value)} className="w-20 accent-accent" />
          <span className="text-[10px] font-mono text-white/30 w-6">{cellSize}</span>
        </div>

        {/* Grid toggle */}
        <button onClick={() => setGridLines(g=>!g)}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all border flex-shrink-0 ${gridLines?'bg-accent/10 border-accent/30 text-accent':'bg-surface2 border-white/5 text-white/30'}`}>
          GRID
        </button>

        {/* Canvas size */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <input type="number" min="4" max="200" value={cols}
            onChange={e=>resize(rows,Math.max(4,Math.min(200,+e.target.value||cols)))}
            className="w-14 px-2 py-1.5 bg-surface2 border border-white/5 rounded-lg text-xs font-mono text-white/80 focus:outline-none focus:border-accent" title="Columns"/>
          <span className="text-white/20 text-xs font-mono">×</span>
          <input type="number" min="4" max="200" value={rows}
            onChange={e=>resize(Math.max(4,Math.min(200,+e.target.value||rows)),cols)}
            className="w-14 px-2 py-1.5 bg-surface2 border border-white/5 rounded-lg text-xs font-mono text-white/80 focus:outline-none focus:border-accent" title="Rows"/>
        </div>

        <div className="w-px h-6 bg-white/5 mx-0.5 flex-shrink-0" />

        <button onClick={clearAll} className="px-3 py-1.5 bg-surface2 border border-white/5 hover:border-red-500/30 hover:text-red-400 rounded-lg text-xs font-mono font-bold text-white/40 transition-all flex-shrink-0">CLEAR</button>
        <button onClick={copyTxt}  className="px-3 py-1.5 bg-surface2 border border-white/5 hover:border-accent/40 hover:text-white rounded-lg text-xs font-mono font-bold text-white/40 transition-all flex-shrink-0">COPY TXT</button>
        <button onClick={exportTxt} className="px-3 py-1.5 bg-surface2 border border-white/5 hover:border-accent2/40 hover:text-accent2 rounded-lg text-xs font-mono font-bold text-white/40 transition-all flex-shrink-0">↓ TXT</button>
        <button onClick={exportPng} className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all hover:-translate-y-px flex-shrink-0"
          style={{ background:'linear-gradient(135deg,#7c6fff,#40c9ff)', color:'#fff' }}>↓ PNG</button>

        {exportMsg && <span className="text-xs font-mono text-accent2 animate-fade-in">{exportMsg}</span>}
      </div>

      {/* ── Drawing area ── */}
      <div
        className="flex-1 overflow-auto bg-bg grid-pattern"
        style={{ cursor: tool==='erase'?'cell':'crosshair' }}
        onDragOver={e=>{e.preventDefault();setDragOver(true)}}
        onDragLeave={()=>setDragOver(false)}
        onDrop={handleDrop}
      >
        {dragOver && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-bg/90 border-2 border-dashed border-accent/50 pointer-events-none">
            <svg className="w-12 h-12 text-accent/60 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <path d="M21 15l-5-5L5 21"/>
            </svg>
            <p className="text-sm font-mono text-accent/80 tracking-widest uppercase">Drop image to convert</p>
          </div>
        )}

        <div className="p-6 flex items-start justify-center min-h-full">
          <div className="relative select-none" style={{
            display:'grid',
            gridTemplateColumns:`repeat(${cols},${cellSize}px)`,
            gridTemplateRows:`repeat(${rows},${cellSize}px)`,
            border:'1px solid rgba(255,255,255,0.06)',
          }}>
            {grid.map((row,r) => row.map((cell,c) => (
              <div key={`${r}-${c}`}
                onMouseDown={()=>handleMouseDown(r,c)}
                onMouseEnter={()=>handleMouseEnter(r,c)}
                className="hover:brightness-125"
                style={{
                  width:cellSize, height:cellSize,
                  background: cell!==null ? getColorHex(cell,palette)||'transparent' : 'transparent',
                  outline: gridLines?'0.5px solid rgba(255,255,255,0.04)':'none',
                  transition:'background 0.04s',
                }}
              />
            )))}
          </div>
        </div>
      </div>

      {/* ── Image Import Modal ── */}
      {importModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-bg/85 backdrop-blur-sm">
          <div className="bg-surface border border-white/8 rounded-2xl w-full max-w-2xl mx-4 overflow-hidden animate-slide-up shadow-2xl">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{background:'linear-gradient(135deg,#ff6b9d,#7c6fff)'}}>
                  <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <path d="M21 15l-5-5L5 21"/>
                  </svg>
                </div>
                <span className="text-sm font-mono font-bold text-white/80 tracking-wider">Image → Pixel Art</span>
              </div>
              <button
                onClick={()=>{setImportModal(false);setImportPreview(null);setImportImgEl(null)}}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-all font-mono">✕</button>
            </div>

            {/* Previews */}
            <div className="p-5 grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-mono text-white/25 uppercase tracking-widest mb-2">Original</p>
                <div className="rounded-xl overflow-hidden bg-surface2 border border-white/5 flex items-center justify-center" style={{height:180}}>
                  {importPreview
                    ? <img src={importPreview} alt="src" className="max-w-full max-h-full object-contain"/>
                    : <span className="text-white/20 text-xs font-mono">No image</span>}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-mono text-white/25 uppercase tracking-widest mb-2">
                  Preview — {importCols}×{importRows} px
                </p>
                <div className="rounded-xl overflow-hidden bg-surface2 border border-white/5 flex items-center justify-center" style={{height:180}}>
                  <canvas ref={previewCvsRef}
                    style={{imageRendering:'pixelated',maxWidth:'100%',maxHeight:'100%',width:'auto',height:'auto'}}/>
                </div>
              </div>
            </div>

            {/* Options */}
            <div className="px-5 pb-5 flex flex-col gap-3">

              {/* Mode */}
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest w-14 flex-shrink-0">Mode</span>
                <div className="flex items-center gap-1 bg-surface2 rounded-lg p-0.5">
                  {[
                    {id:'brightness', label:'Brightness'},
                    {id:'palette',    label:'Match Palette'},
                  ].map(m => (
                    <button key={m.id} onClick={()=>setImportMode(m.id)}
                      className={`px-3 py-1 rounded-md text-xs font-mono font-bold transition-all ${importMode===m.id?'bg-accent text-white':'text-white/40 hover:text-white/70'}`}>
                      {m.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] font-mono text-white/20 leading-relaxed flex-1">
                  {importMode==='brightness'
                    ? 'Pixel brightness → digit 0–9. Works great for photos.'
                    : 'Matches each pixel to the closest digit color in the active palette.'}
                </p>
              </div>

              {/* Width slider */}
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest w-14 flex-shrink-0">Width</span>
                <input type="range" min="8" max="150" value={importCols}
                  onChange={e=>handleColsChange(e.target.value)} className="flex-1 accent-accent"/>
                <span className="text-xs font-mono text-white/50 w-8 text-right">{importCols}</span>
                <span className="text-white/20 text-xs font-mono">×</span>
                <input type="number" min="4" max="200" value={importRows}
                  onChange={e=>setImportRows(Math.max(4,Math.min(200,+e.target.value||importRows)))}
                  className="w-14 px-2 py-1 bg-surface2 border border-white/5 rounded-lg text-xs font-mono text-white/70 focus:outline-none focus:border-accent"/>
                <span className="text-[10px] font-mono text-white/20">rows</span>
              </div>

              {/* Buttons */}
              <div className="flex items-center gap-3 pt-1">
                <button onClick={applyImport} disabled={importing}
                  className="flex-1 py-2.5 rounded-xl text-sm font-mono font-bold tracking-wider transition-all hover:-translate-y-px disabled:opacity-50"
                  style={{background:'linear-gradient(135deg,#ff6b9d,#7c6fff)',color:'#fff'}}>
                  {importing ? 'Converting…' : `Convert → ${importCols}×${importRows}`}
                </button>
                <button
                  onClick={()=>{setImportModal(false);setImportPreview(null);setImportImgEl(null)}}
                  className="px-5 py-2.5 bg-surface2 border border-white/5 hover:border-white/15 rounded-xl text-xs font-mono text-white/40 hover:text-white/70 transition-all">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
