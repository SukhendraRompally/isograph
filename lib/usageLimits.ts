import { createClient } from '@/lib/supabase/server'
import { PLAN_LIMITS, Plan } from '@/types'

export interface QuotaResult {
  allowed: boolean
  used: number
  limit: number
  plan: Plan
  message?: string
}

/**
 * Check whether the user has quota remaining for an AI post generation.
 * Does NOT increment — call incrementPostUsage after successful generation.
 */
export async function checkPostQuota(userId: string): Promise<QuotaResult> {
  const supabase = createClient()

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan, status, ai_posts_used_this_period')
    .eq('user_id', userId)
    .single()

  // Default to free if no subscription row exists
  const plan: Plan = (sub?.plan as Plan) ?? 'free'
  const status = sub?.status ?? 'active'
  const used = sub?.ai_posts_used_this_period ?? 0
  const limit = PLAN_LIMITS[plan].aiPostsPerMonth

  if (status !== 'active' && status !== 'trialing') {
    return { allowed: false, used, limit, plan, message: 'Subscription is not active.' }
  }

  if (used >= limit) {
    return {
      allowed: false,
      used,
      limit,
      plan,
      message: plan === 'free'
        ? `You've used all ${limit} AI posts on the free plan this month. Upgrade to Pro for ${PLAN_LIMITS.pro.aiPostsPerMonth} posts/month.`
        : `You've used all ${limit} AI posts this month. Your quota resets at the start of your next billing period.`,
    }
  }

  return { allowed: true, used, limit, plan }
}

/**
 * Check whether the user has quota remaining for a reflection.
 */
export async function checkReflectionQuota(userId: string): Promise<QuotaResult> {
  const supabase = createClient()

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', userId)
    .single()

  const plan: Plan = (sub?.plan as Plan) ?? 'free'
  const status = sub?.status ?? 'active'

  if (status !== 'active' && status !== 'trialing') {
    return { allowed: false, used: 0, limit: 0, plan, message: 'Subscription is not active.' }
  }

  // Count reflections this calendar month
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { count } = await supabase
    .from('reflection_history')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', startOfMonth.toISOString())

  const used = count ?? 0
  const limit = PLAN_LIMITS[plan].reflectionsPerMonth

  if (used >= limit) {
    return {
      allowed: false,
      used,
      limit,
      plan,
      message: plan === 'free'
        ? `You've used your ${limit} reflection this month. Upgrade to Pro for ${PLAN_LIMITS.pro.reflectionsPerMonth} reflections/month.`
        : `You've run ${used} reflections this month (limit: ${limit}).`,
    }
  }

  return { allowed: true, used, limit, plan }
}

/**
 * Atomically increment the AI posts used counter.
 * Call this after a post is successfully generated.
 */
export async function incrementPostUsage(userId: string): Promise<void> {
  const supabase = createClient()

  await supabase.rpc('increment_post_usage', { uid: userId })
}
