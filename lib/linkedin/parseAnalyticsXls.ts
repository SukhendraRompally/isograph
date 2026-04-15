/**
 * Client-side parser for LinkedIn Creator Analytics XLS export.
 *
 * LinkedIn exports an Excel file with 5 tabs:
 *   Discover     — impressions + profile views over time
 *   Engagement   — reactions, comments, reposts, engagement rate over time
 *   Top Posts    — per-post text + metrics (core for style inference)
 *   Followers    — follower growth over time
 *   Demographics — audience breakdown by job function, industry, seniority, location
 *
 * Usage (browser only — dynamic import xlsx):
 *   const XLSX = await import('xlsx')
 *   const wb = XLSX.read(buffer, { type: 'array' })
 *   const result = parseLinkedInAnalyticsXls(wb)
 */

// We type the workbook loosely so this file doesn't import xlsx at the module level
// (avoids SSR issues — xlsx is dynamic-imported by the component).
export interface XlsWorkbook {
  SheetNames: string[]
  Sheets: Record<string, unknown>
}

export interface TopPost {
  text: string
  publishedDate: string
  impressions: number
  reactions: number
  comments: number
  reposts: number
  clicks: number
  engagementRate: number   // 0–100 (e.g. 4.2 = 4.2%)
}

export interface DemographicSegment {
  category: string    // e.g. "Job function", "Industry", "Seniority"
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

function parseTopPostsSheet(
  wb: XlsWorkbook,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  xlsxUtils: any
): TopPost[] {
  const sheet = findSheet(wb, ['top posts', 'top post', 'posts'])
  if (!sheet) return []

  const rows = xlsxUtils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][]
  if (rows.length < 2) return []

  // Find the header row — LinkedIn sometimes puts metadata rows at the top
  const headerRowIdx = rows.findIndex(row =>
    row.some(cell => typeof cell === 'string' && /impression|post|engagement/i.test(cell))
  )
  if (headerRowIdx === -1) return []

  const headers = (rows[headerRowIdx] as string[]).map(h =>
    typeof h === 'string' ? h.toLowerCase().trim() : ''
  )

  const col = (patterns: string[]) =>
    headers.findIndex(h => patterns.some(p => h.includes(p)))

  const postCol        = col(['post', 'content', 'text', 'sharecommentary'])
  const dateCol        = col(['date', 'published', 'created'])
  const impressionsCol = col(['impression'])
  const reactionsCol   = col(['reaction', 'like'])
  const commentsCol    = col(['comment'])
  const repostsCol     = col(['repost', 'share'])
  const clicksCol      = col(['click'])
  const engagementCol  = col(['engagement rate', 'engagement'])

  if (postCol === -1) return []

  const posts: TopPost[] = []

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i] as unknown[]
    const text = String(row[postCol] ?? '').trim()
    if (!text || text.length < 20) continue

    const impressions   = toNum(impressionsCol >= 0 ? row[impressionsCol] : 0)
    const reactions     = toNum(reactionsCol  >= 0 ? row[reactionsCol]   : 0)
    const comments      = toNum(commentsCol   >= 0 ? row[commentsCol]    : 0)
    const reposts       = toNum(repostsCol    >= 0 ? row[repostsCol]     : 0)
    const clicks        = toNum(clicksCol     >= 0 ? row[clicksCol]      : 0)

    // Engagement rate: use explicit column if available, else calculate
    let engagementRate: number
    if (engagementCol >= 0 && row[engagementCol] !== '' && row[engagementCol] != null) {
      const raw = toNum(row[engagementCol])
      // LinkedIn sometimes exports as 0.042 (fraction) or 4.2 (percent)
      engagementRate = raw < 1 ? raw * 100 : raw
    } else if (impressions > 0) {
      engagementRate = ((reactions + comments + reposts + clicks) / impressions) * 100
    } else {
      engagementRate = 0
    }

    posts.push({
      text,
      publishedDate: dateCol >= 0 ? String(row[dateCol] ?? '') : '',
      impressions,
      reactions,
      comments,
      reposts,
      clicks,
      engagementRate: Math.round(engagementRate * 100) / 100,
    })
  }

  // Sort by impressions descending, take top 50
  return posts
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 50)
}

// ─── Demographics tab ────────────────────────────────────────────────────────

function parseDemographicsSheet(
  wb: XlsWorkbook,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  xlsxUtils: any
): DemographicSegment[] {
  const sheet = findSheet(wb, ['demographic', 'audience'])
  if (!sheet) return []

  const rows = xlsxUtils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][]
  const segments: DemographicSegment[] = []

  // LinkedIn demographics sheet has stacked mini-tables:
  // Row: "Job function"  (category header)
  // Row: "Software"  42%
  // Row: "Marketing" 28%
  // ... blank row ...
  // Row: "Industry"
  // etc.

  let currentCategory = ''
  let currentSegments: { name: string; pct: number }[] = []

  const CATEGORY_PATTERNS = [
    'job function', 'industry', 'seniority', 'location', 'company size',
    'country', 'region', 'function',
  ]

  for (const rawRow of rows) {
    const row = rawRow as unknown[]
    const first = String(row[0] ?? '').trim()
    const second = String(row[1] ?? '').trim()

    if (!first) {
      // Blank row — save current category and start fresh
      if (currentCategory && currentSegments.length > 0) {
        segments.push({ category: currentCategory, segments: currentSegments.slice(0, 8) })
        currentCategory = ''
        currentSegments = []
      }
      continue
    }

    const isCategory = CATEGORY_PATTERNS.some(p => first.toLowerCase().includes(p))
    if (isCategory && !second) {
      // Save previous if exists
      if (currentCategory && currentSegments.length > 0) {
        segments.push({ category: currentCategory, segments: currentSegments.slice(0, 8) })
      }
      currentCategory = first
      currentSegments = []
      continue
    }

    // Data row: name + percentage
    if (currentCategory && first && (second.includes('%') || !isNaN(parseFloat(second)))) {
      const pct = parseFloat(second.replace('%', ''))
      if (!isNaN(pct)) {
        currentSegments.push({ name: first, pct })
      }
    }
  }

  // Don't forget last category
  if (currentCategory && currentSegments.length > 0) {
    segments.push({ category: currentCategory, segments: currentSegments.slice(0, 8) })
  }

  return segments
}

// ─── Engagement tab (period totals) ─────────────────────────────────────────

function parseEngagementSheet(
  wb: XlsWorkbook,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  xlsxUtils: any
): AnalyticsImportData['periodSummary'] {
  const summary = { impressions: 0, reactions: 0, comments: 0, reposts: 0, newFollowers: 0 }

  // Try Engagement sheet
  const engSheet = findSheet(wb, ['engagement'])
  if (engSheet) {
    const rows = xlsxUtils.sheet_to_json(engSheet, { header: 1, defval: '' }) as unknown[][]
    const headerIdx = rows.findIndex(r =>
      r.some(c => typeof c === 'string' && /impression|reaction|engagement/i.test(c))
    )
    if (headerIdx >= 0) {
      const headers = (rows[headerIdx] as string[]).map(h => String(h).toLowerCase())
      const col = (p: string) => headers.findIndex(h => h.includes(p))
      const impCol = col('impression')
      const reactCol = col('reaction')
      const commentCol = col('comment')
      const repostCol = col('repost')

      for (let i = headerIdx + 1; i < rows.length; i++) {
        const row = rows[i] as unknown[]
        if (impCol >= 0)   summary.impressions += toNum(row[impCol])
        if (reactCol >= 0) summary.reactions   += toNum(row[reactCol])
        if (commentCol >= 0) summary.comments  += toNum(row[commentCol])
        if (repostCol >= 0) summary.reposts    += toNum(row[repostCol])
      }
    }
  }

  // Try Followers sheet
  const follSheet = findSheet(wb, ['follower'])
  if (follSheet) {
    const rows = xlsxUtils.sheet_to_json(follSheet, { header: 1, defval: '' }) as unknown[][]
    const headerIdx = rows.findIndex(r =>
      r.some(c => typeof c === 'string' && /follower|new/i.test(c))
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
