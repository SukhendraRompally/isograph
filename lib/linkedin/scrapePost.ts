/**
 * Server-side scraper for LinkedIn post content.
 *
 * LinkedIn renders post text in og:description meta tags for public posts.
 * This is the same data social sharing previews use — it's intentionally
 * public-facing, but we still treat it carefully:
 *   - Rate limited: 1 request per second to avoid triggering blocks
 *   - Timeout: 8s per request
 *   - Failures are silent — a missing post just gets skipped
 *
 * Long-term replacement: LinkedIn API r_member_social scope (pending approval)
 * gives full post text programmatically.
 */

const RATE_LIMIT_MS = 1100  // ~1 req/sec

export interface ScrapedPost {
  url: string
  text: string       // extracted post content (may be truncated at ~300 chars)
  success: boolean
}

/**
 * Fetch content for a batch of LinkedIn post URLs.
 * Returns results in the same order as input, with empty text for failures.
 */
export async function scrapeLinkedInPosts(
  urls: string[],
  onProgress?: (done: number, total: number) => void
): Promise<ScrapedPost[]> {
  const results: ScrapedPost[] = []

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]
    const text = await fetchPostText(url)
    results.push({ url, text, success: text.length > 0 })
    onProgress?.(i + 1, urls.length)

    // Rate limit — skip delay after last request
    if (i < urls.length - 1) {
      await sleep(RATE_LIMIT_MS)
    }
  }

  return results
}

/**
 * Fetch a single LinkedIn post URL and extract the post text.
 * Returns empty string on any failure.
 */
async function fetchPostText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        // Use a widely-recognised UA — LinkedIn serves clean HTML to these
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
          'AppleWebKit/537.36 (KHTML, like Gecko) ' +
          'Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) return ''

    const html = await res.text()
    return extractPostText(html)
  } catch {
    return ''
  }
}

/**
 * Extract post text from LinkedIn HTML.
 * Tries multiple extraction strategies in order of reliability.
 */
function extractPostText(html: string): string {
  // Strategy 1: og:description (most reliable — LinkedIn puts full post here for SEO)
  const ogPatterns = [
    /<meta\s+property="og:description"\s+content="([^"]+)"/i,
    /<meta\s+content="([^"]+)"\s+property="og:description"/i,
  ]
  for (const pattern of ogPatterns) {
    const match = html.match(pattern)
    if (match?.[1]) {
      const text = decodeHtmlEntities(match[1]).trim()
      if (text.length > 30) return text
    }
  }

  // Strategy 2: <meta name="description">
  const metaPatterns = [
    /<meta\s+name="description"\s+content="([^"]+)"/i,
    /<meta\s+content="([^"]+)"\s+name="description"/i,
  ]
  for (const pattern of metaPatterns) {
    const match = html.match(pattern)
    if (match?.[1]) {
      const text = decodeHtmlEntities(match[1]).trim()
      if (text.length > 30) return text
    }
  }

  // Strategy 3: JSON-LD articleBody or description
  const jsonLdMatch = html.match(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i)
  if (jsonLdMatch) {
    try {
      const data = JSON.parse(jsonLdMatch[1])
      const text = data.articleBody || data.description || ''
      if (text.length > 30) return decodeHtmlEntities(text).trim()
    } catch {
      // ignore JSON parse errors
    }
  }

  return ''
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
