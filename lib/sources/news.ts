import { RawSignal, UserProfile } from '@/types'

function buildQueriesForUser(profile: UserProfile): string[] {
  const industry = profile.industry ?? 'professional'
  const topInterests = profile.interests.slice(0, 2)
  const queries = topInterests.map(interest => `${interest} ${industry}`)
  // Always include one broad industry query
  queries.push(`${industry} trends 2025`)
  return queries.slice(0, 3)
}

export async function fetchNewsSignals(profile: UserProfile): Promise<RawSignal[]> {
  const apiKey = process.env.NEWS_API_KEY
  const queries = buildQueriesForUser(profile)

  if (!apiKey) return getMockNewsSignals(profile)

  const signals: RawSignal[] = []

  for (const query of queries.slice(0, 2)) {
    try {
      const res = await fetch(
        `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&sortBy=publishedAt&pageSize=3&apiKey=${apiKey}`,
        { next: { revalidate: 3600 } }
      )
      if (!res.ok) continue

      const data = await res.json()
      for (const article of data.articles ?? []) {
        signals.push({
          source: 'news',
          title: article.title,
          summary: article.description ?? article.title,
          url: article.url,
        })
      }
    } catch {
      // Non-fatal
    }
  }

  return signals.length > 0 ? signals : getMockNewsSignals(profile)
}

function getMockNewsSignals(profile: UserProfile): RawSignal[] {
  const industry = profile.industry ?? 'professional'
  const interest = profile.interests[0] ?? 'technology'

  return [
    {
      source: 'news',
      title: `How ${interest} is reshaping careers in ${industry}`,
      summary: `New research shows professionals in ${industry} are rapidly adapting their skills around ${interest}, with early adopters seeing measurable career gains.`,
    },
    {
      source: 'news',
      title: `The future of ${industry}: trends every professional should know in 2025`,
      summary: `Industry analysts outline the top shifts in ${industry} for 2025 and what they mean for individual contributors and leaders alike.`,
    },
    {
      source: 'news',
      title: `Why ${interest} expertise is becoming a non-negotiable in ${industry}`,
      summary: `Hiring data and practitioner interviews reveal that ${interest} knowledge is increasingly expected — not optional — for professionals in ${industry}.`,
    },
  ]
}
