import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createLinkedInPost } from '@/lib/linkedin/client'
import { publishJob } from '@/lib/qstash/client'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const postId = body.postId as string
  const publishedContent = body.content as string

  if (!postId || !publishedContent) {
    return NextResponse.json({ error: 'postId and content are required' }, { status: 400 })
  }

  // Fetch the draft post
  const { data: post } = await supabase
    .from('posts')
    .select('*')
    .eq('id', postId)
    .eq('user_id', user.id)
    .single()

  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  if (post.status === 'published') return NextResponse.json({ error: 'Already published' }, { status: 409 })

  // Get LinkedIn connection
  const { data: connection } = await supabase
    .from('social_connections')
    .select('access_token, platform_user_id')
    .eq('user_id', user.id)
    .eq('platform', 'linkedin')
    .eq('is_active', true)
    .single()

  if (!connection) {
    return NextResponse.json({ error: 'LinkedIn not connected' }, { status: 400 })
  }

  const wasEdited = publishedContent.trim() !== (post.generated_content ?? '').trim()

  try {
    const { postUrn, shareUrl } = await createLinkedInPost({
      accessToken: connection.access_token,
      authorUrn: `urn:li:person:${connection.platform_user_id}`,
      text: publishedContent,
    })

    const publishedAt = new Date().toISOString()

    // Update post record
    await supabase
      .from('posts')
      .update({
        status: 'published',
        published_content: publishedContent,
        was_edited: wasEdited,
        platform_post_id: postUrn,
        published_at: publishedAt,
      })
      .eq('id', postId)

    // Update opportunity status to 'used'
    if (post.opportunity_id) {
      await supabase
        .from('opportunities')
        .update({ status: 'used' })
        .eq('id', post.opportunity_id)
        .eq('user_id', user.id)
    }

    // Queue analytics fetch after 24 hours
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    if (appUrl && process.env.QSTASH_TOKEN) {
      await publishJob(
        `${appUrl}/api/qstash/analytics-ingest`,
        { postId, postUrn },
        86400  // 24 hours
      ).catch(err => console.warn('QStash queue failed:', err))
    }

    return NextResponse.json({ success: true, postUrn, shareUrl, publishedAt })
  } catch (err) {
    console.error('Publish error:', err)

    await supabase
      .from('posts')
      .update({ status: 'failed' })
      .eq('id', postId)

    return NextResponse.json({ error: 'Publish failed' }, { status: 500 })
  }
}
