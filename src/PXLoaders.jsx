import React from 'react'

export default function PXLoader({
  fullScreen = false,
  label = 'Loading',
  sublabel = 'Preparing pixels...',
  size = 'md',
}) {
  const boxSize =
    size === 'sm' ? 'w-2.5 h-2.5' :
    size === 'lg' ? 'w-5 h-5' :
    'w-4 h-4'

  const textSize =
    size === 'sm' ? 'text-xs' :
    size === 'lg' ? 'text-base' :
    'text-sm'

  const content = (
    <div className="flex flex-col items-center justify-center gap-5">
      <div className="relative">
        <div className="grid grid-cols-2 gap-1.5">
          {[
            'bg-[#7c6fff]',
            'bg-[#40c9ff]',
            'bg-[#ff6b9d]',
            'bg-white'
          ].map((cls, i) => (
            <div
              key={i}
              className={`${boxSize} ${cls} rounded-[4px] animate-pulse`}
              style={{
                animationDelay: `${i * 0.15}s`,
                animationDuration: '1s',
              }}
            />
          ))}
        </div>

        <div className="absolute inset-0 blur-xl opacity-40">
          <div className="grid grid-cols-2 gap-1.5">
            {[
              'bg-[#7c6fff]',
              'bg-[#40c9ff]',
              'bg-[#ff6b9d]',
              'bg-white'
            ].map((cls, i) => (
              <div
                key={i}
                className={`${boxSize} ${cls} rounded-[4px] animate-pulse`}
                style={{
                  animationDelay: `${i * 0.15}s`,
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
              className={`${textSize} font-mono font-bold tracking-[0.35em]`}
              style={{
                color: i === 0 ? '#7c6fff' : '#40c9ff',
                animation: 'pxFloat 1.6s ease-in-out infinite',
                animationDelay: `${i * 0.2}s`,
              }}
            >
              {ch}
            </span>
          ))}
        </div>

        <div className="text-white/80 text-sm font-mono tracking-[0.25em] uppercase">
          {label}
        </div>

        <div className="text-white/35 text-[11px] font-mono tracking-[0.18em] uppercase text-center">
          {sublabel}
        </div>
      </div>
    </div>
  )

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-bg">
        {content}
      </div>
    )
  }

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
      {content}
    </div>
  )
}