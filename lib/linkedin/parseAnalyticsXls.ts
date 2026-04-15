/**
 * Client-side parser for LinkedIn Creator Analytics XLS export.
 *
 * Actual sheet structure (observed from real export):
 *
 * "Top Posts" tab — two side-by-side tables on the same sheet:
 *   Left:  Post URL | Post Publish Date | Engagements
 *   Right: Post URL | Post Publish Date | Impressions
 *   (independently sorted; no post text in this export)
 *
 * "Demographics" tab — flat 3-column table:
 *   Top Demographics | Value | Percentage
 *   Company | Amazon | < 1%
 *   Location | Greater Bengaluru Area | 10%
 *   ...
 *
 * Usage (browser only — dynamic import xlsx):
 *   const XLSX = await import('xlsx')
 *   const wb = XLSX.read(buffer, { type: 'array' })
 *   const result = parseLinkedInAnalyticsXls(wb, XLSX.utils)
 */

export interface XlsWorkbook {
  SheetNames: string[]
  Sheets: Record<string, unknown>
}

export interface TopPost {
  url: string
  text: string           // empty — not available in analytics export
  publishedDate: string
  impressions: number
  engagements: number    // total interactions (LinkedIn "Engagements" column)
  reactions: number
  comments: number
  reposts: number
  clicks: number
  engagementRate: number // 0–100 (e.g. 4.2 = 4.2%)
}

export interface DemographicSegment {
  category: string
  segments: { name: string; pct: number }[]
}

export interface AnalyticsImportData {
  topPosts: TopPost[]
  demographics: DemographicSegment[]
  totalImpressions: number
  avgEngagementRate: number
  periodSummary: {
    impressions: number
    reactions: number
    comments: number
    reposts: number
    newFollowers: number
  }
}

// ─── Main entry point ────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseLinkedInAnalyticsXls(wb: XlsWorkbook, xlsxUtils: any): AnalyticsImportData {
  const topPosts = parseTopPostsSheet(wb, xlsxUtils)
  const demographics = parseDemographicsSheet(wb, xlsxUtils)
  const periodSummary = parseEngagementSheet(wb, xlsxUtils)

  const totalImpressions = topPosts.reduce((s, p) => s + p.impressions, 0)
  const avgEngagementRate =
    topPosts.length > 0
      ? topPosts.reduce((s, p) => s + p.engagementRate, 0) / topPosts.length
      : 0

  return { topPosts, demographics, totalImpressions, avgEngagementRate, periodSummary }
}

// ─── Top Posts tab ───────────────────────────────────────────────────────────
// Layout: two side-by-side tables.
//   Left cols:  Post URL | Post Publish Date | Engagements
//   (gap col)
//   Right cols: Post URL | Post Publish Date | Impressions
// We find the header row, locate both "Post URL" columns, and merge by URL.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseTopPostsSheet(wb: XlsWorkbook, xlsxUtils: any): TopPost[] {
  const sheet = findSheet(wb, ['top post', 'posts'])
  if (!sheet) return []

  const rows = xlsxUtils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][]
  if (rows.length < 2) return []

  // Find the header row — contains "Post URL"
  const headerIdx = rows.findIndex(row =>
    (row as unknown[]).some(c => typeof c === 'string' && c.toLowerCase().includes('post url'))
  )
  if (headerIdx === -1) return []

  const headers = (rows[headerIdx] as string[]).map(h =>
    typeof h === 'string' ? h.toLowerCase().trim() : ''
  )

  // There are TWO "Post URL" columns — find both
  const firstUrlCol = headers.findIndex(h => h.includes('post url'))
  const secondUrlCol = headers.findIndex((h, i) => i > firstUrlCol && h.includes('post url'))

  // Engagements is near the first URL col; Impressions near the second
  const engCol = headers.findIndex(h => h.includes('engagement'))
  const impCol = headers.findIndex((h, i) =>
    i > (secondUrlCol > -1 ? secondUrlCol : firstUrlCol + 1) && h.includes('impression')
  )
  // Also check for impressions column even if only one URL col exists
  const impColFallback = headers.findIndex(h => h.includes('impression'))

  const actualImpCol = impCol >= 0 ? impCol : impColFallback

  // Date columns (take first occurrence per table)
  const dateCol1 = headers.findIndex((h, i) => i > firstUrlCol && h.includes('date'))
  const dateCol2 = secondUrlCol >= 0
    ? headers.findIndex((h, i) => i > secondUrlCol && h.includes('date'))
    : -1

  // Build maps: URL → metric
  const engMap = new Map<string, number>()
  const impMap = new Map<string, number>()
  const dateMap = new Map<string, string>()

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] as unknown[]

    // Left table: URL → engagements
    if (firstUrlCol >= 0) {
      const url = String(row[firstUrlCol] ?? '').trim()
      if (url && url.startsWith('http')) {
        if (engCol >= 0) engMap.set(url, toNum(row[engCol]))
        if (dateCol1 >= 0) dateMap.set(url, String(row[dateCol1] ?? ''))
      }
    }

    // Right table: URL → impressions
    if (secondUrlCol >= 0) {
      const url = String(row[secondUrlCol] ?? '').trim()
      if (url && url.startsWith('http')) {
        if (actualImpCol >= 0) impMap.set(url, toNum(row[actualImpCol]))
        if (!dateMap.has(url) && dateCol2 >= 0) {
          dateMap.set(url, String(row[dateCol2] ?? ''))
        }
      }
    } else if (actualImpCol >= 0 && firstUrlCol >= 0) {
      // Single table with both columns
      const url = String(row[firstUrlCol] ?? '').trim()
      if (url && url.startsWith('http')) {
        impMap.set(url, toNum(row[actualImpCol]))
      }
    }
  }

  // Merge both maps by URL (avoid Set/Map iterator spread for TS compat)
  const urlSet: Record<string, true> = {}
  engMap.forEach((_, k) => { urlSet[k] = true })
  impMap.forEach((_, k) => { urlSet[k] = true })
  const posts: TopPost[] = []

  for (const url of Object.keys(urlSet)) {
    if (!url) continue
    const engagements = engMap.get(url) ?? 0
    const impressions = impMap.get(url) ?? 0
    const engagementRate = impressions > 0
      ? Math.round((engagements / impressions) * 10000) / 100
      : 0

    posts.push({
      url,
      text: '',   // Not available in analytics export
      publishedDate: dateMap.get(url) ?? '',
      impressions,
      engagements,
      reactions: engagements,  // "Engagements" covers all interactions
      comments: 0,
      reposts: 0,
      clicks: 0,
      engagementRate,
    })
  }

  // Sort by impressions descending
  return posts.sort((a, b) => b.impressions - a.impressions).slice(0, 50)
}

// ─── Demographics tab ────────────────────────────────────────────────────────
// Flat 3-column table:
//   Top Demographics | Value | Percentage
//   Company          | Amazon | < 1%
//   Location         | Greater Bengaluru Area | 10%

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseDemographicsSheet(wb: XlsWorkbook, xlsxUtils: any): DemographicSegment[] {
  const sheet = findSheet(wb, ['demographic'])
  if (!sheet) return []

  const rows = xlsxUtils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][]

  // Find header row
  const headerIdx = rows.findIndex(row =>
    (row as unknown[]).some(c =>
      typeof c === 'string' && c.toLowerCase().includes('demographic')
    )
  )
  if (headerIdx === -1) return []

  // Group by category (col 0): { Company: [...], Location: [...], ... }
  const categoryMap = new Map<string, { name: string; pct: number }[]>()

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] as unknown[]
    const category = String(row[0] ?? '').trim()
    const value    = String(row[1] ?? '').trim()
    const pctStr   = String(row[2] ?? '').trim()

    if (!category || !value) continue

    // Parse: "10%" → 10, "< 1%" → 0.5
    const pct = pctStr.includes('<')
      ? 0.5
      : parseFloat(pctStr.replace('%', '').trim()) || 0

    if (!categoryMap.has(category)) categoryMap.set(category, [])
    categoryMap.get(category)!.push({ name: value, pct })
  }

  const result: DemographicSegment[] = []
  categoryMap.forEach((segments, category) => {
    result.push({ category, segments: segments.slice(0, 8) })
  })
  return result
}

// ─── Engagement tab (period totals) ─────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseEngagementSheet(wb: XlsWorkbook, xlsxUtils: any): AnalyticsImportData['periodSummary'] {
  const summary = { impressions: 0, reactions: 0, comments: 0, reposts: 0, newFollowers: 0 }

  const engSheet = findSheet(wb, ['engagement'])
  if (engSheet) {
    const rows = xlsxUtils.sheet_to_json(engSheet, { header: 1, defval: '' }) as unknown[][]
    const headerIdx = rows.findIndex(r =>
      (r as unknown[]).some(c => typeof c === 'string' && /impression|reaction|engagement/i.test(c))
    )
    if (headerIdx >= 0) {
      const headers = (rows[headerIdx] as string[]).map(h => String(h).toLowerCase())
      const col = (p: string) => headers.findIndex(h => h.includes(p))
      const impCol     = col('impression')
      const reactCol   = col('reaction')
      const commentCol = col('comment')
      const repostCol  = col('repost')

      for (let i = headerIdx + 1; i < rows.length; i++) {
        const row = rows[i] as unknown[]
        if (impCol >= 0)     summary.impressions += toNum(row[impCol])
        if (reactCol >= 0)   summary.reactions   += toNum(row[reactCol])
        if (commentCol >= 0) summary.comments    += toNum(row[commentCol])
        if (repostCol >= 0)  summary.reposts     += toNum(row[repostCol])
      }
    }
  }

  const follSheet = findSheet(wb, ['follower'])
  if (follSheet) {
    const rows = xlsxUtils.sheet_to_json(follSheet, { header: 1, defval: '' }) as unknown[][]
    const headerIdx = rows.findIndex(r =>
      (r as unknown[]).some(c => typeof c === 'string' && /follower|new/i.test(c))
    )
    if (headerIdx >= 0) {
      const headers = (rows[headerIdx] as string[]).map(h => String(h).toLowerCase())
      const newFollCol = headers.findIndex(h => h.includes('new'))
      if (newFollCol >= 0) {
        for (let i = headerIdx + 1; i < rows.length; i++) {
          summary.newFollowers += toNum((rows[i] as unknown[])[newFollCol])
        }
      }
    }
  }

  return summary
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function findSheet(wb: XlsWorkbook, patterns: string[]): unknown | null {
  const name = wb.SheetNames.find(n =>
    patterns.some(p => n.toLowerCase().includes(p))
  )
  return name ? (wb.Sheets as Record<string, unknown>)[name] : null
}

function toNum(v: unknown): number {
  if (typeof v === 'number') return isNaN(v) ? 0 : v
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[,%]/g, ''))
    return isNaN(n) ? 0 : n
  }
  return 0
}
