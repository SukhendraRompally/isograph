import { azureClient, DEPLOYMENT } from '@/lib/azureClient'
import { UserProfile, PersonalOpportunity } from '@/types'
import { fetchRedditSignals } from '@/lib/sources/reddit'
import { fetchNewsSignals } from '@/lib/sources/news'

export async function runScoutForUser(profile: UserProfile): Promise<PersonalOpportunity[]> {
  const [redditSignals, newsSignals] = await Promise.all([
    fetchRedditSignals(profile),
    fetchNewsSignals(profile),
  ])

  const allSignals = [...redditSignals, ...newsSignals]

  const signalText = allSignals.map(s =>
    `[${s.source.toUpperCase()}] ${s.title}\n  → ${s.summary}${s.engagementSignal ? ` (${s.engagementSignal})` : ''}`
  ).join('\n\n')

  const prompt = `You are the Scout agent for Isograph, a personal content intelligence platform.

Your job is to find the best LinkedIn content opportunities for a specific user, tailored to their background, industry, and interests.

## User Context
**Name:** ${profile.displayName}
**Headline:** ${profile.headline ?? 'Not specified'}
**Industry:** ${profile.industry ?? 'Not specified'}
**Interests:** ${profile.interests.join(', ') || 'Not specified'}
**Location:** ${profile.location ?? 'Not specified'}

## Raw Signals Gathered Today
${signalText}

## Your Task
Find the 3 best content opportunities from the signals above, tailored specifically to this person's expertise and audience.

Each opportunity must be:
1. Genuinely relevant to this person's industry and interests (not generic)
2. Timely based on the real signals above
3. Positioned for a personal LinkedIn post — first-person voice, professional insight
4. Distinct from each other — different topics or angles

Return a JSON array with exactly 3 objects:
[
  {
    "id": "opp-1",
    "topic": "concise topic title (5-8 words)",
    "hook": "the specific angle that makes this timely and relevant (1 sentence)",
    "why": "why this fits this person's background and what they can uniquely say about it (1-2 sentences)",
    "signalStrength": <0-100>,
    "personalFit": <0-100>,
    "sourceSignals": ["1-2 specific signals from above that drove this"],
    "trendingTerms": ["2-3 trending terms"]
  }
]

Return only the JSON array, no other text.`

  const response = await azureClient.chat.completions.create({
    model: DEPLOYMENT,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 2000,
    temperature: 0.7,
  })

  const text = response.choices[0]?.message?.content ?? ''
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) throw new Error('Could not parse Scout response as JSON')

  const now = new Date().toISOString()
  const raw = JSON.parse(jsonMatch[0]) as Array<{
    id: string
    topic: string
    hook: string
    why: string
    signalStrength: number
    personalFit: number
    sourceSignals: string[]
    trendingTerms: string[]
  }>

  return raw.map((opp, i) => ({
    ...opp,
    id: `opp-${profile.id}-${Date.now()}-${i + 1}`,
    userId: profile.id,
    status: 'new' as const,
    scoutedAt: now,
  }))
}
