export const MERMAID_CDN = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js'

let loadPromise: Promise<void> | null = null

export function isMermaidReady(): boolean {
  return typeof window !== 'undefined' && Boolean(window.mermaid)
}

export function preloadMermaid(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (isMermaidReady()) return Promise.resolve()
  if (loadPromise) return loadPromise

  const existing = document.querySelector<HTMLScriptElement>(`script[src="${MERMAID_CDN}"]`)
  if (existing) {
    loadPromise = new Promise((resolve, reject) => {
      if (isMermaidReady()) {
        resolve()
        return
      }
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Mermaid failed to load')), { once: true })
    })
    return loadPromise
  }

  loadPromise = new Promise((resolve, reject) => {
    const link = document.createElement('link')
    link.rel = 'preload'
    link.as = 'script'
    link.href = MERMAID_CDN
    document.head.appendChild(link)

    const script = document.createElement('script')
    script.src = MERMAID_CDN
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Mermaid failed to load'))
    document.head.appendChild(script)
  })

  return loadPromise
}

const svgCache = new Map<string, string>()

export async function renderMermaidChart(
  chart: string,
  variant: string,
  id: string,
  initialize: (mermaid: NonNullable<Window['mermaid']>) => void
): Promise<string> {
  const cacheKey = `${variant}:${chart.trim()}`
  const cached = svgCache.get(cacheKey)
  if (cached) return cached

  await preloadMermaid()
  if (!window.mermaid) throw new Error('Mermaid is not available')

  initialize(window.mermaid)
  const { svg } = await window.mermaid.render(id, chart.trim())
  svgCache.set(cacheKey, svg)
  return svg
}