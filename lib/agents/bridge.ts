import { azureClient, DEPLOYMENT } from '@/lib/azureClient'
import { UserProfile, ContentOpportunity, StyleModel } from '@/types'
import { styleModelToPromptInstructions } from '@/lib/styleModel'

// Derive a hard word-count target and max_tokens from the brevity dimension
function brevityToWordCount(brevity: number): { target: string; maxTokens: number } {
  if (brevity > 0.7) return { target: '60–100 words', maxTokens: 180 }
  if (brevity > 0.5) return { target: '100–160 words', maxTokens: 280 }
  if (brevity > 0.3) return { target: '150–220 words', maxTokens: 380 }
  return { target: '200–320 words', maxTokens: 500 }
}

export async function runBridge(
  profile: UserProfile,
  opportunity: ContentOpportunity,
  styleModel: StyleModel
): Promise<string> {
  const styleInstructions = styleModelToPromptInstructions(styleModel)
  const { target: wordCountTarget, maxTokens } = brevityToWordCount(styleModel?.brevity ?? 0.5)

  const prompt = `You are the Bridge agent for Isograph. Your role is to generate a single, high-quality LinkedIn post that connects a trending signal to this user's genuine perspective and expertise.

## User Context
**Name:** ${profile.displayName}
**Headline:** ${profile.headline ?? 'Professional'}
**Industry:** ${profile.industry ?? 'Not specified'}
**Interests:** ${profile.interests.join(', ') || 'Not specified'}
${profile.personalConstraints.length > 0 ? `**Topics/tones to avoid:**\n${profile.personalConstraints.map(c => `- ${c}`).join('\n')}` : ''}

## Content Opportunity
**Topic:** ${opportunity.topic}
**Hook angle:** ${opportunity.hook}
**Why this fits this person:** ${opportunity.why}
**Trending terms:** ${opportunity.trendingTerms.join(', ')}

## Style Instructions (learned from what performs for ${profile.displayName})
${styleInstructions}

## Hard Requirements — follow these exactly
- **Word count: ${wordCountTarget}.** Count your words before responding. Do not exceed the upper bound.
- **Never use em-dashes (— or –).** Rewrite with a period, comma, or new sentence instead.
- Written in first person, authentic to ${profile.displayName}'s voice
- Formatted for LinkedIn: natural line breaks, no markdown headers or bullet points unless the style naturally calls for it
- No hashtags unless genuinely organic to the voice (max 2 if used)
- Do NOT start with "I" as the first word

Write only the post content. No preamble, no explanation, no word count annotation.`

  const response = await azureClient.chat.completions.create({
    model: DEPLOYMENT,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: maxTokens,
    temperature: 0.8,
  })

  const raw = response.choices[0]?.message?.content?.trim() ?? ''
  // Strip any em-dashes that slipped through — belt-and-suspenders
  return raw.replace(/—/g, ',').replace(/–/g, '-')
}
