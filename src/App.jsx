import { useState } from 'react'
import ViewerTab from './ViewerTab'
import MakerTab from './MakerTab'

const TABS = [
  { id: 'viewer', label: 'Viewer', icon: '◈' },
  { id: 'maker',  label: 'Maker',  icon: '◉' },
]

export default function App() {
  const [tab, setTab] = useState('viewer')

  return (
    <div className="flex flex-col h-screen bg-bg text-white overflow-hidden">

      {/* ── Header ── */}
      <header className="flex items-center px-5 py-0 bg-surface border-b border-white/[0.04] flex-shrink-0 h-12">

        {/* Logo */}
        <div className="flex items-center gap-2.5 mr-6">
          <div className="flex items-center gap-0.5">
            {['P','X','V','W'].map((ch, i) => (
              <span
                key={i}
                className="text-sm font-mono font-bold tracking-widest"
                style={{
                  color: ['#7c6fff','#40c9ff','#ff6b9d','#7c6fff'][i],
                  animationDelay: `${i * 0.1}s`,
                }}
              >
                {ch}
              </span>
            ))}
          </div>
          <div className="w-px h-4 bg-white/10" />
          <span className="text-[10px] font-mono text-white/20 tracking-[0.25em] uppercase">Pixel Viewer</span>
        </div>

        {/* Tabs */}
        <div className="flex items-end h-full gap-0">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 h-full text-xs font-mono font-bold tracking-widest uppercase transition-all duration-150 border-b-2 ${
                tab === t.id
                  ? 'border-accent text-white'
                  : 'border-transparent text-white/30 hover:text-white/60 hover:border-white/20'
              }`}
            >
              <span className="text-[11px]">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* KRZN Credit */}
        <div className="flex items-center gap-2">
          <div className="h-4 w-px bg-white/5" />
          <span className="text-[10px] font-mono text-white/15 tracking-widest">MADE BY</span>
          <span
            className="text-[11px] font-mono font-bold tracking-widest shimmer-text"
            style={{ letterSpacing: '0.2em' }}
          >
            KRZN
          </span>
        </div>
      </header>

      {/* ── Tab content ── */}
      <main className="flex-1 overflow-hidden">
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
