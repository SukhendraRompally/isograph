import { azureClient, DEPLOYMENT } from '@/lib/azureClient'
import {
  IsographPost,
  PostAnalytics,
  StyleModel,
  UserReflectionResult,
  StyleModelDelta,
  STYLE_LABELS,
  UserProfile,
} from '@/types'

// Delta cap per dimension per reflection cycle
const MAX_DELTA = 0.15

export async function runUserReflection(
  profile: UserProfile,
  posts: IsographPost[],
  analytics: PostAnalytics[],
  currentStyle: StyleModel
): Promise<UserReflectionResult> {
  // Only include posts that have analytics data
  const postsWithData = posts.filter(post => {
    const hasAnalytics = analytics.some(a => a.postId === post.id)
    const hasContent = !!(post.publishedContent ?? post.generatedContent)
    return hasAnalytics && hasContent
  })

  if (postsWithData.length === 0) {
    return {
      userId: profile.id,
      userName: profile.displayName,
      insights: ['Not enough performance data yet. Keep publishing to unlock reflection.'],
      deltas: [],
      updatedStyleModel: currentStyle,
      summary: 'Reflection skipped — no posts with analytics data found.',
    }
  }

  const styleDescription = Object.entries(STYLE_LABELS).map(([key, val]) => {
    const current = currentStyle[key as keyof StyleModel]
    return `${val.label}: ${current.toFixed(2)} (${current < 0.33 ? val.low : current > 0.66 ? val.high : 'balanced'})`
  }).join('\n')

  const postSummaries = postsWithData.map(post => {
    const perf = analytics.find(a => a.postId === post.id)
    const published = post.publishedContent ?? post.generatedContent ?? ''
    const generated = post.generatedContent ?? ''
    return {
      published: published.slice(0, 300) + (published.length > 300 ? '...' : ''),
      generated: generated.slice(0, 300) + (generated.length > 300 ? '...' : ''),
      wasEdited: post.wasEdited,
      styleUsed: post.styleModelUsed,
      performance: perf ? {
        engagementRate: perf.engagementRate,
        impressions: perf.impressions,
        clicks: perf.clicks,
        comments: perf.comments,
        reactions: perf.reactions,
      } : null,
    }
  })

  const prompt = `You are the Reflection Agent for Isograph. Analyse the performance of recent LinkedIn posts for a user and recommend precise updates to their style model.

## User: ${profile.displayName}
**Headline:** ${profile.headline ?? 'Professional'}
**Industry:** ${profile.industry ?? 'Not specified'}

**Current Style Model:**
${styleDescription}

## Posts and Performance Data
${postSummaries.map((s, i) => `
### Post ${i + 1}
**Published content:** ${s.published}${s.wasEdited && s.generated !== s.published ? `\n**Originally generated:** ${s.generated}\n**Note:** The user edited this post before publishing — the published version reflects their corrections to tone, length, or style. Weight this edit signal heavily.` : ''}
**Performance:** ${s.performance?.engagementRate}% engagement, ${s.performance?.impressions} impressions, ${s.performance?.clicks} clicks, ${s.performance?.comments} comments, ${s.performance?.reactions} reactions
${s.styleUsed ? `**Style used:** tone=${s.styleUsed.tone.toFixed(2)}, brevity=${s.styleUsed.brevity.toFixed(2)}, hookIntensity=${s.styleUsed.hookIntensity.toFixed(2)}, expertiseDepth=${s.styleUsed.expertiseDepth.toFixed(2)}, evidenceStyle=${s.styleUsed.evidenceStyle.toFixed(2)}, ctaFriction=${s.styleUsed.ctaFriction.toFixed(2)}, perspective=${s.styleUsed.perspective.toFixed(2)}, vocabularyRigor=${s.styleUsed.vocabularyRigor.toFixed(2)}` : ''}
`).join('\n')}

Style dimensions (0.0 to 1.0):
- tone: 0=formal → 1=casual/direct
- brevity: 0=long-form → 1=short/punchy
- hookIntensity: 0=ease in → 1=bold claim opening
- expertiseDepth: 0=general professionals → 1=deep specialists
- evidenceStyle: 0=stories/examples → 1=data/numbers
- ctaFriction: 0=thought-provoking close → 1=direct ask
- perspective: 0=I/we (what I do) → 1=you (what you face)
- vocabularyRigor: 0=plain language → 1=industry terms

Return JSON only:
{
  "insights": ["2-3 specific observations about what drove performance — cite specific posts"],
  "deltas": [
    {
      "dimension": "dimensionName",
      "currentValue": <0-1>,
      "suggestedValue": <0-1>,
      "reason": "one sentence grounded in the data"
    }
  ],
  "summary": "2-3 sentence plain English summary of what changed and why"
}

Max 4 deltas. Only include dimensions where you have clear evidence. Human edits are the strongest signal.`

  try {
    const response = await azureClient.chat.completions.create({
      model: DEPLOYMENT,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
      temperature: 0.3,
    })

    const text = response.choices[0]?.message?.content ?? '{}'
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { insights: [], deltas: [], summary: '' }

    const updatedStyle = { ...currentStyle }
    const styleDeltaResults: StyleModelDelta[] = []

    for (const delta of result.deltas ?? []) {
      const dim = delta.dimension as keyof StyleModel
      if (!(dim in updatedStyle)) continue

      const before = updatedStyle[dim]
      const raw = Math.max(0, Math.min(1, delta.suggestedValue))
      // Enforce delta cap ±0.15 per cycle
      const cappedDelta = Math.max(-MAX_DELTA, Math.min(MAX_DELTA, raw - before))
      const after = Math.max(0, Math.min(1, before + cappedDelta))
      updatedStyle[dim] = after

      styleDeltaResults.push({
        dimension: dim,
        before,
        after,
        delta: after - before,
        reason: delta.reason,
      })
    }

    return {
      userId: profile.id,
      userName: profile.displayName,
      insights: result.insights ?? [],
      deltas: styleDeltaResults,
      updatedStyleModel: updatedStyle,
      summary: result.summary ?? 'Reflection complete.',
    }
  } catch {
    return {
      userId: profile.id,
      userName: profile.displayName,
      insights: ['Could not complete reflection analysis.'],
      deltas: [],
      updatedStyleModel: currentStyle,
      summary: 'Reflection skipped due to an error.',
    }
  }
}
