# Isograph

**Personal LinkedIn content intelligence.** Isograph learns how you write, scouts trending topics in your industry, generates posts that sound genuinely like you, and gets measurably better every time you publish.

> Built for professionals who have things to say but not the time to say them well every single day.

---

## What it does

Most AI writing tools produce generic content that sounds like everyone else. Isograph is different because it starts from *you* — your actual posts, your engagement data, your audience — and builds a personal style model that evolves over time.

The core loop:

```
Learn your style → Scout opportunities → Generate → Publish → Analyse → Refine
```

Each cycle makes the next post better. After a few weeks of use, generated posts require noticeably less editing than day one.

---

## Core features

### 1. Style model (8 dimensions)

Every user has a `StyleModel` — a vector of 8 values between 0 and 1 that captures how they write:

| Dimension | Low (0) | High (1) |
|---|---|---|
| **Tone** | Formal and precise | Casual and direct |
| **Brevity** | Long — develops ideas fully | Short — gets to the point |
| **Hook intensity** | Eases into the topic | Leads with a bold claim |
| **Expertise depth** | Writes for general professionals | Writes for deep domain specialists |
| **Evidence style** | Stories and examples | Data and specific numbers |
| **CTA friction** | Thought-provoking close | Direct ask or action |
| **Perspective** | What I/we do | What you're facing |
| **Vocabulary rigor** | Plain language always | Industry terms where precise |

This model is used by the generation engine to constrain every post it produces. It is never manually overridden unless the user explicitly adjusts it.

---

### 2. Onboarding — two paths

#### Path A: Learn from LinkedIn (recommended)
For users with 6+ months of posting history.

1. Upload LinkedIn Creator Analytics `.xlsx` export
2. App parses all tabs (Top Posts, Demographics, Engagement, Followers, Discover)
3. Server fetches post text from each URL (up to 50 posts, 3 concurrent)
4. Two parallel GPT-4.1 calls:
   - **Style inference** — infers 8-dimension style model, weighted by engagement rate (high-engagement posts count 2–3× more)
   - **Topic extraction** — identifies topics covered, topics that resonate with audience, content formats, and audience themes
5. Results saved: style model to `style_models`, topics to `user_profiles.interests`, all insights to `user_profiles.audience_context`
6. User only needs to add personal constraints (topics/tones to avoid)

This path produces a style model grounded in what actually performs for this specific person's audience — not what they *think* they write like.

#### Path B: Manual setup
For new LinkedIn creators or those who prefer explicit control.

1. Industry, headline, and up to 5 topic interests
2. Personal constraints (topics/tones to avoid — used by the Guardian agent)
3. 8-slider questionnaire with live radar preview — one question per style dimension with concrete anchors

---

### 3. Scout agent — opportunity discovery

On demand, the Scout agent scans live signals and surfaces content opportunities personalised to the user.

**Sources:**
- Reddit — subreddits selected dynamically from user's industry and interests (e.g. `r/MachineLearning`, `r/startups`)
- News API — queries built from user's interest topics
- Trending signals combined and ranked

**Output:** 3–5 `PersonalOpportunity` objects, each with:
- **Topic** — the specific angle
- **Hook** — a concrete opening line to build from
- **Why** — why this topic is timely right now
- **Signal strength** — 0–100, how much traction the source signal has
- **Personal fit** — 0–100, relevance to this user's background and interests

Opportunities are saved to the database so the user can dismiss ones they don't want and revisit ones they do.

---

### 4. Bridge agent — post generation

Takes a selected opportunity and generates a LinkedIn post in the user's voice.

**Inputs:**
- `UserProfile` — headline, industry, interests, personal constraints, audience context
- `ContentOpportunity` — topic, hook, why, source signals
- `StyleModel` — all 8 dimensions

**Process:**
- `styleModelToPromptInstructions()` translates each dimension into natural language instructions for GPT-4.1
- Prompt constructed with user context block (who they are, who they write for, what to avoid)
- Post generated as *this specific person*, not as a generic professional

**Output:** A LinkedIn-ready post draft, typically 150–600 words depending on the brevity dimension.

---

### 5. Guardian agent — safety check

Every generated post passes through the Guardian before reaching the user.

**Checks:**
- Word count within LinkedIn limits (50–3000 words)
- No absolute unverifiable claims ("the only", "guaranteed", "100% proven")
- No financial advice language
- Personal constraints respected — if the user said "avoid cryptocurrency", no post about crypto passes
- Soft check via GPT for overall brand safety and tone alignment

**Result:** `pass`, `review` (flagged but shown), or `block` (shown with explanation, user can regenerate).

---

### 6. Publish to LinkedIn

After reviewing and optionally editing a generated post, users publish directly to LinkedIn via the Share API.

- One-click publish from the create flow
- Tracks `was_edited: true/false` — edit signal is used in reflection (manual edits are strong negative signal for the style model)
- Stores `platform_post_id` for analytics linking

---

### 7. Analytics ingestion

For posts created through Isograph, analytics are fetched from LinkedIn's API:
- Impressions, reactions, comments, reposts, clicks, engagement rate
- Stored in `post_analytics` per post
- Viewable on the Analytics page with time-series charts

Manual analytics entry also available for posts published outside Isograph.

---

### 8. Reflection agent — style model evolution

The Reflection agent analyses recent posts and their performance to update the style model.

**Trigger:** Manual (button on Analytics page) or automatic threshold (5+ new posts with analytics since last reflection, or 14 days on Pro).

**Process:**
- Analyses post text, edit deltas, and engagement performance
- Posts with `was_edited = true` are weighted more heavily — a user who rewrites 60% of every post is giving strong signal
- GPT-4.1 identifies which style dimensions to shift and by how much
- **Delta cap: ±0.15 per dimension per cycle** — prevents drift from one anomalous week
- New `style_models` row inserted with `is_current = true`; prior versions retained for history

**Output:** `UserReflectionResult` with dimension deltas, reasoning per change, and a plain-English summary of what shifted and why.

---

### 9. Creator Analytics XLS import

A deeper training signal than style inference alone. Users upload their LinkedIn Creator Analytics export (the `.xlsx` file with 5 tabs).

**What's extracted:**
- **Top Posts tab** — side-by-side tables of posts sorted by Engagements and Impressions; merged by URL to get both metrics per post
- **Demographics tab** — audience breakdown by Company, Location, Company size, Industry, Seniority
- **Engagement/Followers tabs** — period totals for impressions, reactions, comments, reposts, new followers

**Post content retrieval:**
Since LinkedIn's analytics export contains URLs but not post text, the app fetches each post URL server-side (3 concurrent, 2s between batches) and extracts text from `og:description` meta tags.

**Engagement-weighted inference:**
- Posts at 2× median engagement → weight 3 in the inference prompt
- Posts at 1–2× median → weight 2
- Posts below median → weight 1

The top-performing posts are explicitly shown to GPT with their engagement rates, with instruction to bias the style model toward what resonates.

**Topic extraction (parallel GPT call):**
- `topTopics` → saved to `interests` (Scout searches here)
- `highEngagementTopics` → what the audience responds to (shown in UI, saved to `audience_context`)
- `contentFormats` → storytelling, data-driven, opinion, how-to, etc.
- `audienceThemes` → broader resonant themes

**Blending rule:**
- LinkedIn-path users: inferred model replaces outright (no prior manual preferences to preserve)
- Manual-path users who later import: inferred model blends 60% new / 40% existing

---

### 10. Settings

**Profile** — display name, headline, industry, interests, personal constraints, location.

**Connections** — LinkedIn OAuth connect/disconnect, Creator Analytics XLS upload, Posts CSV upload (Pro).

**Billing** — subscription management via Stripe Checkout (currently free, Stripe integration wired but not activated).

---

## Intelligence architecture

```
                    ┌─────────────────────────────────┐
                    │         user_profiles            │
                    │  interests, constraints,         │
                    │  audience_context, onboard_path  │
                    └──────────────┬──────────────────┘
                                   │
              ┌────────────────────┼─────────────────────┐
              ▼                    ▼                     ▼
        Scout agent          Bridge agent          Guardian agent
     (opportunity           (post generation      (safety check
      discovery)             in user's voice)      + constraints)
              │                    │                     │
              └────────────────────┼─────────────────────┘
                                   ▼
                            posts (draft)
                                   │
                            user edits/approves
                                   │
                            publish to LinkedIn
                                   │
                            post_analytics
                                   │
                            Reflection agent
                                   │
                            style_models (v+1)
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 App Router (full-stack) |
| Auth + DB | Supabase (Postgres + Auth + RLS) |
| LLM | Azure OpenAI GPT-4.1 |
| LinkedIn | OAuth 2.0 (Authorization Code flow) + Share API |
| Payments | Stripe Checkout (wired, not yet activated) |
| Background jobs | Upstash QStash (wired, not yet activated) |
| Deployment | Vercel |
| Styling | Tailwind CSS |

---

## Database schema

```
user_profiles        — id, display_name, headline, industry, interests[], 
                       personal_constraints[], onboarding_path, audience_context,
                       onboarding_completed

social_connections   — user_id, platform, platform_username, access_token,
                       refresh_token, token_expires_at, is_active

style_models         — user_id, version, model (JSONB), source, is_current
                       source: onboarding | inference | reflection

posts                — user_id, platform, status, generated_content,
                       published_content, was_edited, opportunity_snapshot,
                       style_model_used, guardian_result, platform_post_id

post_analytics       — post_id, impressions, reactions, comments, shares,
                       clicks, engagement_rate, source (api | manual)

opportunities        — user_id, topic, hook, why, signal_strength, personal_fit,
                       source_signals, status (new | used | dismissed)

reflection_history   — user_id, style_model_before, style_model_after,
                       insights[], deltas[], summary, posts_analysed

subscriptions        — user_id, plan (free | pro), status,
                       ai_posts_used_this_period
```

All tables have Row Level Security — users can only read and write their own data.

---

## API routes

| Route | Method | What it does |
|---|---|---|
| `/api/profile` | GET | Returns UserProfile + subscription |
| `/api/profile` | PUT | Update profile fields |
| `/api/style` | GET | Current style model + full version history |
| `/api/style` | POST | Create style model (onboarding) |
| `/api/scout` | POST | Run Scout agent, save opportunities |
| `/api/generate` | POST | Run Bridge + Guardian, save draft post |
| `/api/publish` | POST | Publish to LinkedIn, queue analytics fetch |
| `/api/reflect` | POST | Run Reflection agent, save new style model version |
| `/api/opportunities` | GET | List saved opportunities |
| `/api/analytics` | GET | Aggregated analytics for dashboard |
| `/api/analytics/ingest` | POST | Fetch analytics from LinkedIn API |
| `/api/connections/linkedin/authorize` | GET | Start LinkedIn OAuth flow |
| `/api/connections/linkedin/callback` | GET | Exchange code, store tokens |
| `/api/connections/linkedin/disconnect` | DELETE | Deactivate LinkedIn connection |
| `/api/connections/linkedin/status` | GET | Connection status + username |
| `/api/connections/linkedin/import-analytics` | POST | Save XLS analytics data, return metrics |
| `/api/connections/linkedin/fetch-post-content` | POST | Scrape post URLs, run style + topic inference |
| `/api/connections/sync` | POST | Import Posts CSV for text-based style inference (Pro) |
| `/api/billing/checkout` | POST | Create Stripe Checkout session |
| `/api/webhooks/stripe` | POST | Handle subscription lifecycle events |
| `/api/qstash/analytics-ingest` | POST | Background analytics worker |

---

## Quota limits

| | Free | Pro |
|---|---|---|
| AI posts / month | 5 | 60 |
| Reflections / month | 1 | 10 |
| Analytics auto-fetch | Manual only | Automatic via QStash |
| Posts CSV inference | — | ✓ |

---

## Local development

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.local.example .env.local
# Fill in: Supabase, Azure OpenAI, LinkedIn OAuth, News API

# Run database migrations
# Paste contents of supabase/schema.sql into Supabase SQL Editor
# Also run:
# ALTER TABLE public.user_profiles
#   ADD COLUMN IF NOT EXISTS onboarding_path TEXT CHECK (onboarding_path IN ('linkedin','manual')),
#   ADD COLUMN IF NOT EXISTS audience_context JSONB DEFAULT '{}';

# Start dev server
npm run dev
```

**Required environment variables:**

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
AZURE_OPENAI_API_KEY
AZURE_OPENAI_ENDPOINT
AZURE_OPENAI_DEPLOYMENT
AZURE_OPENAI_API_VERSION
LINKEDIN_CLIENT_ID
LINKEDIN_CLIENT_SECRET
LINKEDIN_REDIRECT_URI
NEWS_API_KEY
NEXT_PUBLIC_APP_URL
```

**Optional (features degrade gracefully without these):**
```
STRIPE_SECRET_KEY
STRIPE_PRO_PRICE_ID
STRIPE_WEBHOOK_SECRET
QSTASH_TOKEN
```

---

## LinkedIn API notes

Scopes currently approved: `openid profile email w_member_social`

- `w_member_social` — publish posts on behalf of user
- `r_member_social` — read analytics for app-created posts — **pending LinkedIn Marketing Developer Platform approval**

Until `r_member_social` is approved, analytics must be entered manually or imported via the Creator Analytics XLS export.

---

## Known limitations

- **Post text scraping** — post content is extracted from `og:description` meta tags (first ~300 chars). Full text requires `r_member_social` API approval.
- **Analytics** — only available for posts created through Isograph once `r_member_social` is approved. Historical analytics for pre-Isograph posts require manual entry or XLS import.
- **LinkedIn only** — Instagram and Twitter/X deferred to v2.
- **No scheduled publishing** — posts publish immediately on user action.
- **Stripe not yet activated** — all users are currently on the free plan. Pro features (CSV inference, auto analytics) are gated but Stripe checkout is wired for when billing goes live.
