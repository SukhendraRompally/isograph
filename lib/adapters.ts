/**
 * Adapters between Isograph types and the Margraph-compatible agent types.
 * This lets us reuse the bridge/guardian/reflection agents unchanged.
 */

import {
  IsographPost,
  UserProfile,
  GeneratedPost,
  PublishedPost,
  VoiceConfig,
  Platform,
} from '@/types'
import { defaultStyleModel } from '@/lib/styleModel'

/**
 * UserProfile → VoiceConfig
 * Lets Bridge/Guardian agents treat the user as a single "voice".
 */
export function userProfileToVoiceConfig(profile: UserProfile): VoiceConfig {
  return {
    id: profile.id,
    name: profile.displayName,
    persona: [profile.headline, profile.industry].filter(Boolean).join(', ') || 'Professional',
    styleModel: defaultStyleModel(), // caller should pass current style model separately
  }
}

/**
 * IsographPost → GeneratedPost
 * Used when passing posts to Reflection agent.
 */
export function isographPostToGeneratedPost(post: IsographPost): GeneratedPost {
  return {
    id: post.id,
    voiceId: post.userId,
    voiceName: '',  // filled by caller
    platform: post.platform as Platform,
    content: post.generatedContent ?? '',
    opportunity: post.opportunitySnapshot ?? {
      id: '',
      topic: '',
      hook: '',
      why: '',
      signalStrength: 0,
      sourceSignals: [],
      trendingTerms: [],
    },
    styleModelUsed: post.styleModelUsed ?? defaultStyleModel(),
    guardian: post.guardian,
    generatedAt: post.createdAt,
  }
}

/**
 * IsographPost → PublishedPost
 * Used when passing published posts to Reflection agent.
 */
export function isographPostToPublishedPost(
  post: IsographPost,
  displayName: string
): PublishedPost {
  return {
    ...isographPostToGeneratedPost(post),
    voiceName: displayName,
    publishedContent: post.publishedContent ?? post.generatedContent ?? '',
    wasEdited: post.wasEdited,
    publishedAt: post.publishedAt ?? post.createdAt,
  }
}
