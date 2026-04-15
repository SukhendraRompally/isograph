/**
 * Import and normalise LinkedIn post history for style inference.
 * Works with LinkedIn's Posts CSV export (Settings → Data Privacy → Get a copy of your data).
 */

import { createClient } from '@/lib/supabase/server'
import { parseLinkedInCsvPosts, inferStyleFromPosts, blendStyleModels } from '@/lib/styleInference'

export interface ImportResult {
  postsImported: number
  styleUpdated: boolean
  error?: string
}

export async function importLinkedInPostsCsv(
  userId: string,
  csvText: string
): Promise<ImportResult> {
  const supabase = createClient()

  // Parse post texts from CSV
  const postTexts = parseLinkedInCsvPosts(csvText)

  if (postTexts.length === 0) {
    return { postsImported: 0, styleUpdated: false, error: 'No posts found in CSV.' }
  }

  // Store imported posts
  const postsToInsert = postTexts.map(text => ({
    user_id: userId,
    platform: 'linkedin',
    source: 'imported',
    status: 'published',
    published_content: text,
    was_edited: false,
  }))

  const { error: insertError } = await supabase.from('posts').insert(postsToInsert)
  if (insertError) {
    return { postsImported: 0, styleUpdated: false, error: insertError.message }
  }

  // Infer style from imported posts
  const inferred = await inferStyleFromPosts(postTexts)

  // Get current (onboarding) style model
  const { data: currentStyleRow } = await supabase
    .from('style_models')
    .select('id, version, model')
    .eq('user_id', userId)
    .eq('is_current', true)
    .single()

  if (!currentStyleRow) {
    return { postsImported: postTexts.length, styleUpdated: false, error: 'No current style model found.' }
  }

  // Blend 70% onboarding intent + 30% revealed writing behavior
  const blended = blendStyleModels(currentStyleRow.model, inferred, 0.7)

  // Mark current as not current, insert new version
  await supabase
    .from('style_models')
    .update({ is_current: false })
    .eq('user_id', userId)
    .eq('is_current', true)

  await supabase.from('style_models').insert({
    user_id: userId,
    version: (currentStyleRow.version ?? 1) + 1,
    model: blended,
    source: 'inference',
    is_current: true,
  })

  return { postsImported: postTexts.length, styleUpdated: true }
}
