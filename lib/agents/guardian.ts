import { azureClient, DEPLOYMENT } from '@/lib/azureClient'
import { UserProfile, GuardianResult } from '@/types'

function runHardChecks(
  content: string,
  personalConstraints: string[]
): { rule: string; passed: boolean; note?: string }[] {
  const checks = []
  const lower = content.toLowerCase()

  // LinkedIn word-count check (50–3000 words)
  const wordCount = content.split(/\s+/).length
  checks.push({
    rule: 'Appropriate length for LinkedIn (50–3000 words)',
    passed: wordCount >= 50 && wordCount <= 3000,
    note: wordCount < 50 ? `Too short: ${wordCount} words` : wordCount > 3000 ? `Too long: ${wordCount} words` : undefined,
  })

  // Absolute claims
  const absoluteClaims = ['100% reduction', 'eliminates all', 'zero downtime guaranteed', 'always works', 'guaranteed to']
  const absoluteFound = absoluteClaims.find(a => lower.includes(a))
  checks.push({
    rule: 'No unsubstantiated absolute claims',
    passed: !absoluteFound,
    note: absoluteFound ? `Found absolute claim: "${absoluteFound}"` : undefined,
  })

  // Financial / M&A commentary
  const financialTerms = ['stock price', 'share price', 'earnings guidance', 'acquisition target', 'merger']
  const financialFound = financialTerms.find(t => lower.includes(t))
  checks.push({
    rule: 'No financial/M&A commentary',
    passed: !financialFound,
    note: financialFound ? `Found financial term: "${financialFound}"` : undefined,
  })

  // Personal constraints check
  for (const constraint of personalConstraints) {
    const keyword = constraint.toLowerCase()
    const violated = lower.includes(keyword)
    checks.push({
      rule: `Personal constraint: avoid "${constraint}"`,
      passed: !violated,
      note: violated ? `Found mention of: "${constraint}"` : undefined,
    })
  }

  return checks
}

export async function runGuardian(
  content: string,
  profile: UserProfile
): Promise<GuardianResult> {
  const hardChecks = runHardChecks(content, profile.personalConstraints)
  const hardFailed = hardChecks.filter(c => !c.passed)

  if (hardFailed.length > 0) {
    return {
      status: 'block',
      checks: hardChecks,
      summary: `Blocked: ${hardFailed.map(c => c.rule).join('; ')}`,
    }
  }

  const constraintText = profile.personalConstraints.length > 0
    ? `Personal constraints (user-defined no-go topics):\n${profile.personalConstraints.map(c => `- ${c}`).join('\n')}`
    : 'No personal constraints specified.'

  const prompt = `You are the Guardian compliance agent for Isograph. Audit this LinkedIn post for personal brand issues.

## User
**Name:** ${profile.displayName}
**Industry:** ${profile.industry ?? 'Not specified'}

## ${constraintText}

## Post to Audit
"""
${content}
"""

Check for:
1. Tone that feels inauthentic or off-brand for a personal professional
2. Exaggerated claims, even if not absolute
3. Cultural insensitivity or regional inappropriateness
4. Reputational risk (anything a professional would regret posting)

Respond with JSON only:
{
  "status": "pass" or "review",
  "issues": ["list any soft issues — empty array if none"],
  "summary": "one sentence assessment"
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
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { status: 'pass', issues: [], summary: 'Passed all checks.' }

    const llmChecks = (result.issues ?? []).map((issue: string) => ({
      rule: 'Soft personal brand compliance',
      passed: false,
      note: issue,
    }))

    return {
      status: result.status as 'pass' | 'review',
      checks: [...hardChecks, ...llmChecks],
      summary: result.summary,
    }
  } catch {
    return {
      status: 'pass',
      checks: hardChecks,
      summary: 'Hard checks passed. Soft check skipped.',
    }
  }
}
