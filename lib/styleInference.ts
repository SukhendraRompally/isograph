import { azureClient, DEPLOYMENT } from '@/lib/azureClient'
import { StyleModel } from '@/types'
import { defaultStyleModel } from '@/lib/styleModel'
import type { TopPost } from '@/lib/linkedin/parseAnalyticsXls'

/**
 * Infer a StyleModel from a sample of post texts.
 * Used during onboarding when the user uploads a LinkedIn CSV export.
 * Result is blended 70/30 with onboarding answers (revealed behavior vs. intent).
 */
export async function inferStyleFromPosts(postTexts: string[]): Promise<StyleModel> {
  // Filter to posts with enough signal (>50 words), take up to 20
  const usablePosts = postTexts
    .filter(text => text.split(/\s+/).length >= 50)
    .slice(0, 20)

  if (usablePosts.length < 3) {
    // Not enough posts to infer style — return neutral model
    return defaultStyleModel()
  }

  const postsForPrompt = usablePosts.map((text, i) =>
    `--- Post ${i + 1} ---\n${text.slice(0, 500)}`
  ).join('\n\n')

  const prompt = `You are a writing style analyst. Analyse the LinkedIn posts below and infer a StyleModel describing the author's natural writing patterns.

## Posts
${postsForPrompt}

## Style Dimensions (all values 0.0 to 1.0)
- tone: 0=formal/precise → 1=casual/direct
- brevity: 0=long-form (develops ideas) → 1=short/punchy (gets to the point)
- hookIntensity: 0=eases into topics → 1=leads with bold claims
- expertiseDepth: 0=writes for general professionals → 1=writes for deep domain specialists
- evidenceStyle: 0=uses stories/examples → 1=uses data/specific numbers
- ctaFriction: 0=ends with thought-provoking question → 1=ends with direct ask
- perspective: 0=I/we framing (what I do) → 1=you framing (what you're facing)
- vocabularyRigor: 0=plain language always → 1=uses industry terms where precise

## Instructions
Carefully read all posts and estimate each dimension based on observable patterns, not assumptions.
If a dimension varies a lot across posts, choose 0.5.

Return JSON only — no explanation:
{
  "tone": <0-1>,
  "brevity": <0-1>,
  "hookIntensity": <0-1>,
  "expertiseDepth": <0-1>,
  "evidenceStyle": <0-1>,
  "ctaFriction": <0-1>,
  "perspective": <0-1>,
  "vocabularyRigor": <0-1>
}`

  try {
    const response = await azureClient.chat.completions.create({
      model: DEPLOYMENT,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.2,
    })

    const text = response.choices[0]?.message?.content ?? ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return defaultStyleModel()

    const raw = JSON.parse(jsonMatch[0])
    const inferred: StyleModel = {
      tone:            clamp(raw.tone ?? 0.5),
      brevity:         clamp(raw.brevity ?? 0.5),
      hookIntensity:   clamp(raw.hookIntensity ?? 0.5),
      expertiseDepth:  clamp(raw.expertiseDepth ?? 0.5),
      evidenceStyle:   clamp(raw.evidenceStyle ?? 0.5),
      ctaFriction:     clamp(raw.ctaFriction ?? 0.5),
      perspective:     clamp(raw.perspective ?? 0.5),
      vocabularyRigor: clamp(raw.vocabularyRigor ?? 0.5),
    }
    return inferred
  } catch {
    return defaultStyleModel()
  }
}

/**
 * Blend onboarding answers (intent) and CSV inference (revealed behavior).
 * Weight: 70% onboarding, 30% inferred from posts.
 */
export function blendStyleModels(
  onboarding: StyleModel,
  inferred: StyleModel,
  onboardingWeight = 0.7
): StyleModel {
  const inferredWeight = 1 - onboardingWeight
  const dims = Object.keys(onboarding) as (keyof StyleModel)[]
  return dims.reduce((acc, dim) => {
    acc[dim] = clamp(onboarding[dim] * onboardingWeight + inferred[dim] * inferredWeight)
    return acc
  }, {} as StyleModel)
}

/**
 * Parse the "Content" column from a LinkedIn Posts CSV export.
 * Exported CSV has columns: Date, ShareCommentary, ShareLink, SharedUrl, MediaUrl, Visibility
 * The share text is in ShareCommentary.
 */
export function parseLinkedInCsvPosts(csvText: string): string[] {
  const lines = csvText.split('\n')
  if (lines.length < 2) return []

  // Find header row (case-insensitive search for ShareCommentary)
  const headerLine = lines.findIndex(l => l.toLowerCase().includes('sharecommentary'))
  if (headerLine === -1) return []

  const headers = parseCsvLine(lines[headerLine]).map(h => h.toLowerCase().trim())
  const contentIdx = headers.findIndex(h => h === 'sharecommentary')
  if (contentIdx === -1) return []

  return lines
    .slice(headerLine + 1)
    .map(line => parseCsvLine(line)[contentIdx]?.trim() ?? '')
    .filter(text => text.length > 0)
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}

/**
 * Infer a StyleModel from LinkedIn Top Posts with engagement weighting.
 * Posts with higher engagement rate count more — they represent what
 * actually resonates with the audience, not just what the author writes.
 *
 * Weighting strategy:
 *   - Compute median engagement rate across all posts
 *   - Posts at 2× median or above → weight 3
 *   - Posts at 1–2× median        → weight 2
 *   - Posts below median          → weight 1
 * This prevents one viral outlier from dominating while still rewarding
 * consistently high-performing patterns.
 */
export async function inferStyleFromAnalytics(posts: TopPost[]): Promise<StyleModel> {
  const usable = posts.filter(p => p.text.split(/\s+/).length >= 30).slice(0, 30)
  if (usable.length < 2) return defaultStyleModel()

  // Calculate median engagement rate for weighting
  const rates = usable.map(p => p.engagementRate).sort((a, b) => a - b)
  const median = rates[Math.floor(rates.length / 2)] || 1

  // Build weighted post list for the prompt
  const weightedPosts = usable.map(p => {
    const weight = p.engagementRate >= median * 2 ? 3
      : p.engagementRate >= median ? 2
      : 1
    return { post: p, weight }
  })

  // Expand posts by weight (repeat high-performers so GPT sees them more)
  const expandedTexts: string[] = []
  for (const { post, weight } of weightedPosts) {
    for (let i = 0; i < weight; i++) {
      expandedTexts.push(post.text.slice(0, 600))
    }
  }
  // Shuffle to avoid position bias, then take up to 25
  const shuffled = expandedTexts.sort(() => Math.random() - 0.5).slice(0, 25)

  const postsForPrompt = shuffled.map((text, i) =>
    `--- Post ${i + 1} ---\n${text}`
  ).join('\n\n')

  // Include engagement context so GPT knows which style performed
  const topByEngagement = [...usable]
    .sort((a, b) => b.engagementRate - a.engagementRate)
    .slice(0, 3)
  const engagementContext = topByEngagement.map(p =>
    `"${p.text.slice(0, 120)}..." → ${p.engagementRate.toFixed(1)}% engagement`
  ).join('\n')

  const prompt = `You are a writing style analyst. Analyse the LinkedIn posts below and infer a StyleModel.
These posts are engagement-weighted: higher-performing posts appear more often.

## Top-performing posts by engagement rate
${engagementContext}

## Post sample (engagement-weighted)
${postsForPrompt}

## Style Dimensions (all values 0.0 to 1.0)
- tone: 0=formal/precise → 1=casual/direct
- brevity: 0=long-form (develops ideas) → 1=short/punchy (gets to the point)
- hookIntensity: 0=eases into topics → 1=leads with bold claims
- expertiseDepth: 0=writes for general professionals → 1=writes for deep domain specialists
- evidenceStyle: 0=uses stories/examples → 1=uses data/specific numbers
- ctaFriction: 0=ends with thought-provoking question → 1=ends with direct ask
- perspective: 0=I/we framing (what I do) → 1=you framing (what you're facing)
- vocabularyRigor: 0=plain language always → 1=uses industry terms where precise

## Instructions
Bias toward the style of the TOP-PERFORMING posts (highest engagement). These are what the audience responds to.
If a dimension varies a lot, choose 0.5.

Return JSON only — no explanation:
{
  "tone": <0-1>,
  "brevity": <0-1>,
  "hookIntensity": <0-1>,
  "expertiseDepth": <0-1>,
  "evidenceStyle": <0-1>,
  "ctaFriction": <0-1>,
  "perspective": <0-1>,
  "vocabularyRigor": <0-1>
}`

  try {
    const response = await azureClient.chat.completions.create({
      model: DEPLOYMENT,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.2,
    })

    const text = response.choices[0]?.message?.content ?? ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return defaultStyleModel()

    const raw = JSON.parse(jsonMatch[0])
    return {
      tone:            clamp(raw.tone ?? 0.5),
      brevity:         clamp(raw.brevity ?? 0.5),
      hookIntensity:   clamp(raw.hookIntensity ?? 0.5),
      expertiseDepth:  clamp(raw.expertiseDepth ?? 0.5),
      evidenceStyle:   clamp(raw.evidenceStyle ?? 0.5),
      ctaFriction:     clamp(raw.ctaFriction ?? 0.5),
      perspective:     clamp(raw.perspective ?? 0.5),
      vocabularyRigor: clamp(raw.vocabularyRigor ?? 0.5),
    }
  } catch {
    return defaultStyleModel()
  }
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value))
}
