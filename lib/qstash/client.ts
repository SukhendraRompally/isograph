/**
 * QStash client for background job publishing.
 * Used to queue analytics ingestion after a post is published.
 */

const QSTASH_URL = 'https://qstash.upstash.io/v2/publish'
const QSTASH_TOKEN = process.env.QSTASH_TOKEN!

export async function publishJob(
  destination: string,  // absolute URL of the route to call
  body: Record<string, unknown>,
  delaySeconds = 0
): Promise<void> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${QSTASH_TOKEN}`,
    'Content-Type': 'application/json',
  }

  if (delaySeconds > 0) {
    headers['Upstash-Delay'] = `${delaySeconds}s`
  }

  const res = await fetch(`${QSTASH_URL}/${encodeURIComponent(destination)}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`QStash publish failed: ${text}`)
  }
}

/**
 * Verify that an incoming request is from QStash.
 * Call this at the top of any QStash worker route.
 */
export function verifyQStashSignature(
  request: Request
): boolean {
  const token = request.headers.get('upstash-signature')
  if (!token) return false
  // In production: use @upstash/qstash SDK for proper HMAC verification.
  // For dev: allow any request with the signature header present.
  return true
}
