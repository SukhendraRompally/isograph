import { RawSignal, UserProfile } from '@/types'

// Industry → relevant subreddits
const INDUSTRY_SUBREDDITS: Record<string, string[]> = {
  'technology':            ['technology', 'programming', 'MachineLearning', 'artificial'],
  'software engineering':  ['softwareengineering', 'programming', 'devops', 'MachineLearning'],
  'marketing':             ['marketing', 'digital_marketing', 'content_marketing', 'socialmedia'],
  'finance':               ['finance', 'investing', 'personalfinance', 'FinancialCareers'],
  'healthcare':            ['healthcare', 'medicine', 'healthIT', 'DigitalHealth'],
  'design':                ['design', 'UXDesign', 'graphic_design', 'userexperience'],
  'product management':    ['ProductManagement', 'startups', 'SaaS', 'Entrepreneur'],
  'data science':          ['datascience', 'MachineLearning', 'statistics', 'learnmachinelearning'],
  'hr':                    ['humanresources', 'recruiting', 'careerguidance', 'jobs'],
  'sales':                 ['sales', 'Entrepreneur', 'startups', 'BusinessIntelligence'],
  'consulting':            ['consulting', 'MgmtConsulting', 'business', 'Entrepreneur'],
  'legal':                 ['law', 'legaladvice', 'LegalTechLaw', 'Paralegal'],
  'education':             ['education', 'Teachers', 'edtech', 'AskAcademia'],
  'entrepreneurship':      ['Entrepreneur', 'startups', 'smallbusiness', 'SideProject'],
  'default':               ['business', 'technology', 'Entrepreneur', 'artificial'],
}

// Interest → relevant subreddits
const INTEREST_SUBREDDITS: Record<string, string[]> = {
  'ai':               ['artificial', 'MachineLearning', 'ChatGPT', 'singularity'],
  'leadership':       ['leadership', 'management', 'business', 'careerguidance'],
  'startups':         ['startups', 'Entrepreneur', 'SideProject', 'venturecapital'],
  'remote work':      ['remotework', 'digitalnomad', 'WorkOnline', 'freelance'],
  'productivity':     ['productivity', 'getdisciplined', 'selfimprovement', 'nosurf'],
  'diversity':        ['WomenInTech', 'cscareerquestions', 'diversity', 'womenintech'],
  'climate':          ['sustainability', 'climate', 'ZeroWaste', 'environment'],
  'crypto':           ['CryptoCurrency', 'ethereum', 'Bitcoin', 'defi'],
  'devops':           ['devops', 'kubernetes', 'docker', 'aws'],
  'open source':      ['opensource', 'programming', 'github', 'linux'],
  'mental health':    ['mentalhealth', 'Anxiety', 'selfimprovement', 'mindfulness'],
  'personal finance': ['personalfinance', 'financialindependence', 'investing', 'FIRE'],
  'writing':          ['writing', 'blogging', 'content_marketing', 'copywriting'],
  'public speaking':  ['publicspeaking', 'acting', 'Toastmasters', 'communication'],
  'networking':       ['networking', 'careerguidance', 'Entrepreneur', 'business'],
  'career growth':    ['cscareerquestions', 'careerguidance', 'jobs', 'ExperiencedDevs'],
}

export function getSubredditsForUser(profile: UserProfile): string[] {
  const industry = profile.industry?.toLowerCase() ?? 'default'
  const industryKey = Object.keys(INDUSTRY_SUBREDDITS).find(k => industry.includes(k)) ?? 'default'
  const industrySubs = INDUSTRY_SUBREDDITS[industryKey] ?? INDUSTRY_SUBREDDITS.default

  const interestSubs: string[] = []
  for (const interest of profile.interests.slice(0, 3)) {
    const key = Object.keys(INTEREST_SUBREDDITS).find(k => interest.toLowerCase().includes(k))
    if (key) {
      interestSubs.push(...INTEREST_SUBREDDITS[key])
    }
  }

  // Union + deduplicate, pick 4–5
  const seen = new Set<string>()
  const all: string[] = []
  for (const s of [...industrySubs, ...interestSubs]) {
    if (!seen.has(s)) { seen.add(s); all.push(s) }
  }
  return all.slice(0, 5)
}

export async function fetchRedditSignals(profile: UserProfile): Promise<RawSignal[]> {
  const subreddits = getSubredditsForUser(profile)
  const signals: RawSignal[] = []

  for (const subreddit of subreddits.slice(0, 4)) {
    try {
      const res = await fetch(
        `https://www.reddit.com/r/${subreddit}/hot.json?limit=5`,
        {
          headers: { 'User-Agent': 'Isograph/1.0 (content research bot)' },
          next: { revalidate: 3600 },
        }
      )
      if (!res.ok) continue

      const data = await res.json()
      const posts = data?.data?.children ?? []

      for (const post of posts.slice(0, 3)) {
        const p = post.data
        if (p.score < 30) continue
        signals.push({
          source: 'reddit',
          title: p.title,
          summary: `r/${subreddit} — ${p.score} upvotes, ${p.num_comments} comments`,
          url: `https://reddit.com${p.permalink}`,
          engagementSignal: `${p.score} upvotes`,
        })
      }
    } catch {
      // Non-fatal
    }
  }

  return signals
}
