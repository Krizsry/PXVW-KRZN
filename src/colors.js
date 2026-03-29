export const PALETTES = {
  coolWarm: {
    label: 'Cool → Warm',
    stops: [
      [70,140,255],[60,180,255],[50,210,230],[60,220,170],[120,220,110],
      [200,220,70],[255,200,60],[255,150,45],[255,95,45],[255,60,60]
    ],
  },
  grayscale: { label: 'Grayscale' },
  heatDark:  { label: 'Heat Dark' },
  neon: {
    label: 'Neon',
    stops: [
      [20,255,220],[0,200,255],[80,120,255],[140,60,255],
      [220,20,255],[255,20,180],[255,60,60],[255,140,20],
      [200,255,20],[60,255,100]
    ],
  },
  sunset: {
    label: 'Sunset',
    stops: [
      [20,20,60],[40,20,100],[80,20,140],[150,30,120],
      [210,60,80],[255,100,60],[255,160,40],[255,200,80],
      [255,230,140],[255,245,200]
    ],
  },
  candy: {
    label: 'Candy',
    stops: [
      [255,182,255],[255,140,200],[255,100,160],[255,80,120],
      [200,80,200],[160,60,220],[100,80,255],[60,160,255],
      [40,220,200],[100,255,180]
    ],
  },
  matrix: {
    label: 'Matrix',
    stops: [
      [0,20,0],[0,40,0],[0,70,0],[0,100,10],[0,140,20],
      [0,180,40],[20,220,60],[60,255,80],[120,255,120],[200,255,180]
    ],
  },
}

function lerp(a, b, t) { return Math.round(a + (b - a) * t) }

export function getColor(char, palette) {
  if (char < '0' || char > '9') return null
  const n = +char
  const t = n / 9

  if (palette === 'grayscale') {
    const s = Math.round(235 - t * 210)
    return `rgb(${s},${s},${s})`
  }
  if (palette === 'heatDark') {
    return `rgb(${lerp(20,255,t)},${lerp(40,140,t)},${lerp(80,20,t)})`
  }

  const p = PALETTES[palette]
  if (p?.stops) return `rgb(${p.stops[n].join(',')})`

  // fallback coolWarm
  return `rgb(${PALETTES.coolWarm.stops[n].join(',')})`
}

export function getColorHex(char, palette) {
  const rgb = getColor(char, palette)
  if (!rgb) return null
  const m = rgb.match(/\d+/g)
  return '#' + m.map(v => parseInt(v).toString(16).padStart(2,'0')).join('')
}
