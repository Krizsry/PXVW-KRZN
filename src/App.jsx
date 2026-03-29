import { useEffect, useState } from 'react'
import ViewerTab from './ViewerTab'
import MakerTab from './MakerTab'
import PXLoader from './PXLoaders'

const TABS = [
  { id: 'viewer', label: 'Viewer', icon: '◈' },
  { id: 'maker', label: 'Maker', icon: '◉' },
]

export default function App() {
  const [tab, setTab] = useState('viewer')
  const [bootLoading, setBootLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setBootLoading(false)
    }, 1400)

    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="flex flex-col h-screen bg-bg text-white overflow-hidden">
      {bootLoading && (
        <PXLoader
          fullScreen
          label="Loading PXVW"
          sublabel="Initializing interface..."
          size="lg"
        />
      )}

      {/* ── Header ── */}
      <header className="flex items-center gap-2 px-3 sm:px-5 py-0 bg-surface border-b border-white/[0.04] flex-shrink-0 h-12 min-w-0">
        {/* Logo */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <div className="flex items-center gap-0.5">
            {['P', 'X', 'V', 'W'].map((ch, i) => (
              <span
                key={i}
                className="text-xs sm:text-sm font-mono font-bold tracking-[0.14em] sm:tracking-widest"
                style={{
                  color: ['#7c6fff', '#40c9ff', '#ff6b9d', '#7c6fff'][i],
                  animationDelay: `${i * 0.1}s`,
                }}
              >
                {ch}
              </span>
            ))}
          </div>

          <div className="w-px h-4 bg-white/10 hidden sm:block" />
          <span className="hidden sm:block text-[9px] sm:text-[10px] font-mono text-white/20 tracking-[0.18em] sm:tracking-[0.25em] uppercase">
            Pixel Viewer
          </span>
        </div>

        {/* Tabs */}
        <div className="flex-1 min-w-0 h-full overflow-x-auto no-scrollbar">
          <div className="flex items-end h-full gap-0 min-w-max">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1 px-3 sm:px-4 h-full text-[10px] sm:text-xs font-mono font-bold tracking-[0.12em] sm:tracking-widest uppercase transition-all duration-150 border-b-2 shrink-0 ${
                  tab === t.id
                    ? 'border-accent text-white'
                    : 'border-transparent text-white/30 hover:text-white/60 hover:border-white/20'
                }`}
              >
                <span className="text-[10px] sm:text-[11px]">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* KRZN Credit */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div className="h-4 w-px bg-white/5" />
          <span className="text-[8px] sm:text-[10px] font-mono text-white/15 tracking-[0.12em] sm:tracking-widest">
            MADE BY
          </span>
          <span
            className="text-[9px] sm:text-[11px] font-mono font-bold tracking-[0.14em] sm:tracking-widest shimmer-text"
            style={{ letterSpacing: '0.14em' }}
          >
            KRZN
          </span>
        </div>
      </header>

      {/* ── Tab content ── */}
      <main className="flex-1 min-h-0 overflow-hidden">
        <div className={`h-full ${tab === 'viewer' ? 'block' : 'hidden'}`}>
          <ViewerTab />
        </div>
        <div className={`h-full ${tab === 'maker' ? 'block' : 'hidden'}`}>
          <MakerTab />
        </div>
      </main>
    </div>
  )
}