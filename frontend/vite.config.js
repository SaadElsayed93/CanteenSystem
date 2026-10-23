import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function oklchToRgb(lStr, cStr, hStr, alphaStr) {
  let L = parseFloat(lStr);
  if (lStr.includes('%')) L = L / 100;
  const C = parseFloat(cStr);
  const H = parseFloat(hStr);

  const hRad = (H * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);

  const l_ = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m_ = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s_ = Math.pow(L - 0.0894841775 * a - 1.2914855480 * b, 3);

  let rLin = +4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_;
  let gLin = -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_;
  let bLin = -0.0041960863 * l_ - 0.7034186147 * m_ + 1.7076147010 * s_;

  function gamma(x) {
    if (x <= 0.0031308) return 12.92 * x;
    return 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
  }

  const r = Math.min(255, Math.max(0, Math.round(gamma(rLin) * 255)));
  const g = Math.min(255, Math.max(0, Math.round(gamma(gLin) * 255)));
  const bVal = Math.min(255, Math.max(0, Math.round(gamma(bLin) * 255)));

  if (alphaStr !== undefined && alphaStr !== null && alphaStr !== '') {
    let aVal = parseFloat(alphaStr);
    if (alphaStr.includes('%')) aVal = aVal / 100;
    return `rgba(${r}, ${g}, ${bVal}, ${aVal})`;
  }
  return '#' + [r, g, bVal].map(x => x.toString(16).padStart(2, '0')).join('');
}

function legacyCssFallbackPlugin() {
  return {
    name: 'legacy-css-fallback',
    enforce: 'post',
    generateBundle(_, bundle) {
      const oklchRegex = /oklch\(\s*([0-9.]+%?)\s+([0-9.]+)\s+([0-9.]+)(?:\s*\/\s*([0-9.]+%?))?\s*\)/gi;
      for (const fileName of Object.keys(bundle)) {
        const file = bundle[fileName];
        if (fileName.endsWith('.css') && file.type === 'asset' && typeof file.source === 'string') {
          file.source = file.source.replace(oklchRegex, (_, l, c, h, a) => {
            return oklchToRgb(l, c, h, a);
          });
        }
      }
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), legacyCssFallbackPlugin()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  build: {
    target: ['es2015', 'chrome80', 'firefox78', 'edge80'],
  }
})
