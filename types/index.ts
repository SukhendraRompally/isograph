// ─── Style Model ────────────────────────────────────────────────────────────

export interface StyleModel {
  tone: number            // 0 = formal, 1 = casual/direct
  brevity: number         // 0 = long-form, 1 = short/punchy
  hookIntensity: number   // 0 = ease in, 1 = bold opening claim
  expertiseDepth: number  // 0 = general professionals, 1 = deep specialists
  evidenceStyle: number   // 0 = stories/examples, 1 = data/numbers
  ctaFriction: number     // 0 = thought-provoking close, 1 = direct ask
  perspective: number     // 0 = I/we (what I do), 1 = you (what you face)
  vocabularyRigor: number // 0 = plain language, 1 = industry terms
}

export const STYLE_DIMENSIONS: (keyof StyleModel)[] = [
  'tone', 'brevity', 'hookIntensity', 'expertiseDepth',
  'evidenceStyle', 'ctaFriction', 'perspective', 'vocabularyRigor',
]

export const STYLE_LABELS: Record<keyof StyleModel, { low: string; high: string; label: string }> = {
  tone:            { label: 'Tone',             low: 'Formal & precise',        high: 'Casual & direct' },
  brevity:         { label: 'Brevity',           low: 'Long — develop ideas',    high: 'Short — get to the point' },
  hookIntensity:   { label: 'Hook',              low: 'Ease into the topic',     high: 'Lead with a bold claim' },
  expertiseDepth:  { label: 'Expertise',         low: 'General professionals',   high: 'Deep domain specialists' },
  evidenceStyle:   { label: 'Evidence',          low: 'Stories & examples',      high: 'Data & specific numbers' },
  ctaFriction:     { label: 'CTA',               low: 'Thought-provoking close', high: 'Direct ask or action' },
  perspective:     { label: 'Perspective',       low: 'What I/we do',            high: "What you're facing" },
  vocabularyRigor: { label: 'Vocabulary',        low: 'Plain language always',   high: 'Industry terms where precise' },
}

// ─── User Profile ────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string
  displayName: string
  headline?: string
  industry?: string
  interests: string[]
  personalConstraints: string[]  // topics/tones the user wants to avoid
  location?: string
  avatarUrl?: string
  onboardingCompleted: boolean
}

// ─── Social Connections ──────────────────────────────────────────────────────

export type SocialPlatform = 'linkedin' | 'instagram' | 'twitter'

/** Safe for client — no tokens */
export interface SocialConnectionPublic {
  id: string
  userId: string
  platform: SocialPlatform
  platformUsername?: string
  platformUserId?: string
  connectedAt: string
  lastSyncedAt?: string
  isActive: boolean
}

/** Server-only — includes encrypted tokens */
export interface SocialConnection extends SocialConnectionPublic {
  accessToken: string
  refreshToken?: string
  tokenExpiresAt?: string
  scopes: string[]
}

// ─── Style Model (versioned, DB-backed) ──────────────────────────────────────

export type StyleModelSource = 'onboarding' | 'inference' | 'reflection'

export interface UserStyleModel {
  id: string
  userId: string
  version: number
  model: StyleModel
  source: StyleModelSource
  isCurrent: boolean
  postCountAtReflection?: number
  createdAt: string
}

export interface OnboardingStyleAnswer {
  dimension: keyof StyleModel
  value: number       // 0–1
  questionText: string
  lowLabel: string
  highLabel: string
}

// ─── Posts ──────────────────────────────────────────────────────────────────

export type PostStatus = 'draft' | 'published' | 'failed'
export type PostSource = 'generated' | 'imported'
export type Platform = 'linkedin' | 'instagram' | 'twitter'

export type GuardianStatus = 'pass' | 'review' | 'block'

export interface GuardianResult {
  status: GuardianStatus
  checks: { rule: string; passed: boolean; note?: string }[]
  summary: string
}

export interface IsographPost {
  id: string
  userId: string
  platform: Platform
  source: PostSource
  status: PostStatus
  generatedContent?: string
  publishedContent?: string
  wasEdited: boolean
  opportunityId?: string
  opportunitySnapshot?: PersonalOpportunity
  styleModelUsed?: StyleModel
  platformPostId?: string
  guardian?: GuardianResult
  publishedAt?: string
  createdAt: string
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export type AnalyticsSource = 'api' | 'manual'

export interface PostAnalytics {
  id: string
  postId: string
  userId: string
  platform: Platform
  impressions: number
  reactions: number
  comments: number
  shares: number
  clicks: number
  engagementRate: number  // e.g. 4.2 = 4.2%
  reach?: number
  fetchedAt: string
  periodStart: string
  periodEnd: string
  source: AnalyticsSource
}

// ─── Scout / Opportunities ───────────────────────────────────────────────────

export interface RawSignal {
  source: 'trends' | 'reddit' | 'news'
  title: string
  summary: string
  url?: string
  engagementSignal?: string
}

export type OpportunityStatus = 'new' | 'used' | 'dismissed'

export interface ContentOpportunity {
  id: string
  topic: string
  hook: string
  why: string
  signalStrength: number   // 0–100
  sourceSignals: string[]
  trendingTerms: string[]
}

export interface PersonalOpportunity extends ContentOpportunity {
  userId: string
  personalFit: number    // 0–100 (replaces brandFit)
  status: OpportunityStatus
  scoutedAt: string
}

// ─── Reflection ───────────────────────────────────────────────────────────────

export interface StyleModelDelta {
  dimension: keyof StyleModel
  before: number
  after: number
  delta: number
  reason: string
}

export interface UserReflectionResult {
  userId: string
  userName: string
  insights: string[]
  deltas: StyleModelDelta[]
  updatedStyleModel: StyleModel
  summary: string
}

export interface ReflectionRecord {
  id: string
  userId: string
  styleModelBefore: StyleModel
  styleModelAfter: StyleModel
  insights: string[]
  deltas: StyleModelDelta[]
  summary: string
  postsAnalysed: number
  triggeredBy: 'manual' | 'scheduled' | 'threshold'
  createdAt: string
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

export type Plan = 'free' | 'pro'
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing'

export interface UserSubscription {
  id: string
  userId: string
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  plan: Plan
  status: SubscriptionStatus
  currentPeriodStart?: string
  currentPeriodEnd?: string
  aiPostsUsedThisPeriod: number
  createdAt: string
  updatedAt: string
}

export const PLAN_LIMITS: Record<Plan, { aiPostsPerMonth: number; reflectionsPerMonth: number }> = {
  free: { aiPostsPerMonth: 5,  reflectionsPerMonth: 1  },
  pro:  { aiPostsPerMonth: 60, reflectionsPerMonth: 10 },
}

// ─── Margraph compatibility types (used internally by agents) ─────────────────
// These match the Margraph type shapes so agents can be reused with adapters.

export interface VoiceConfig {
  id: string
  name: string
  persona: string
  styleModel: StyleModel
}

export interface PostPerformance {
  postId: string
  voiceId: string
  impressions: number
  engagementRate: number
  clicks: number
  comments: number
}

export interface GeneratedPost {
  id: string
  voiceId: string
  voiceName: string
  platform: Platform
  content: string
  opportunity: ContentOpportunity
  styleModelUsed: StyleModel
  guardian?: GuardianResult
  generatedAt: string
}

export interface PublishedPost extends GeneratedPost {
  publishedContent: string
  wasEdited: boolean
  publishedAt: string
}
