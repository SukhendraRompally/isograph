import { azureClient, DEPLOYMENT } from '@/lib/azureClient'
import { UserProfile, ContentOpportunity, StyleModel } from '@/types'
import { styleModelToPromptInstructions } from '@/lib/styleModel'

export async function runBridge(
  profile: UserProfile,
  opportunity: ContentOpportunity,
  styleModel: StyleModel
): Promise<string> {
  const styleInstructions = styleModelToPromptInstructions(styleModel)

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

## Your Task
Write a single LinkedIn post as ${profile.displayName} on this topic.

Requirements:
- Written in first person, authentic to ${profile.displayName}'s voice and expertise
- Connects the trending signal to a genuine personal insight or observation
- Respects all topics/tones to avoid listed above
- Applies the style instructions above
- Formatted for LinkedIn: natural line breaks, no markdown headers
- No hashtags unless genuinely organic (max 2-3 if used)
- Do NOT start with "I" as the first word
- 50–3000 words (LinkedIn limit)

Write only the post content. No preamble, no explanation.`

  const response = await azureClient.chat.completions.create({
    model: DEPLOYMENT,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 600,
    temperature: 0.8,
  })

  return response.choices[0]?.message?.content?.trim() ?? ''
}
