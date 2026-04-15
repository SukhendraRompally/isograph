import { StyleModel, STYLE_LABELS } from '@/types'

// Translate numeric style model values into natural language instructions for the Bridge prompt
export function styleModelToPromptInstructions(style: StyleModel): string {
  const instructions: string[] = []

  if (style.tone < 0.3) {
    instructions.push('Use a formal, professional tone. Avoid contractions and casual phrasing.')
  } else if (style.tone > 0.7) {
    instructions.push('Use a conversational, approachable tone. Contractions and natural phrasing are encouraged.')
  } else {
    instructions.push('Balance professional credibility with approachable warmth.')
  }

  if (style.brevity < 0.3) {
    instructions.push('Write in long-form. Develop ideas fully. 200-300 words is appropriate.')
  } else if (style.brevity > 0.7) {
    instructions.push('Be punchy and concise. Every sentence must earn its place. Under 120 words.')
  } else {
    instructions.push('Aim for 150-200 words. Substantive but not padded.')
  }

  if (style.hookIntensity < 0.3) {
    instructions.push('Open with a calm, considered observation — not a provocation or bold claim.')
  } else if (style.hookIntensity > 0.7) {
    instructions.push('Open with a strong, attention-grabbing hook. The first line must stop the scroll.')
  } else {
    instructions.push('Open with a clear, interesting statement that earns continued reading.')
  }

  if (style.expertiseDepth < 0.3) {
    instructions.push('Write for a general business audience. Explain concepts without assuming prior knowledge.')
  } else if (style.expertiseDepth > 0.7) {
    instructions.push('Write for a technically literate audience. Assume knowledge of industry concepts and tooling.')
  } else {
    instructions.push('Balance accessibility with substance. Define jargon only where necessary.')
  }

  if (style.evidenceStyle < 0.3) {
    instructions.push('Lead with narrative and anecdote. Stories over statistics.')
  } else if (style.evidenceStyle > 0.7) {
    instructions.push('Ground claims in data, statistics, and specific metrics where possible.')
  } else {
    instructions.push('Mix narrative with supporting evidence. At least one data point or specific example.')
  }

  if (style.ctaFriction < 0.3) {
    instructions.push('End with a soft, open invitation — a question or gentle prompt. No hard sell.')
  } else if (style.ctaFriction > 0.7) {
    instructions.push('End with a clear, direct call to action.')
  } else {
    instructions.push('Close with a low-friction prompt — a thought-provoking question or soft next step.')
  }

  if (style.perspective < 0.3) {
    instructions.push('Write from a first-person perspective about your own experience and observations ("I\'ve found...", "In my work..."). Personal-out framing.')
  } else if (style.perspective > 0.7) {
    instructions.push('Write from the audience\'s perspective ("You\'re dealing with...", "Your feed is full of..."). Audience-in framing.')
  } else {
    instructions.push('Balance personal experience with audience empathy.')
  }

  if (style.vocabularyRigor < 0.3) {
    instructions.push('Use plain, accessible language. Avoid jargon and acronyms.')
  } else if (style.vocabularyRigor > 0.7) {
    instructions.push('Use precise industry terminology. Technical vocabulary signals credibility to this audience.')
  } else {
    instructions.push('Use industry terms naturally, but don\'t over-engineer the vocabulary.')
  }

  return instructions.join('\n')
}

// Calculate delta between two style models
export function calculateDeltas(
  before: StyleModel,
  after: StyleModel
): { dimension: keyof StyleModel; before: number; after: number; delta: number }[] {
  return (Object.keys(before) as (keyof StyleModel)[])
    .map(dim => ({
      dimension: dim,
      before: before[dim],
      after: after[dim],
      delta: after[dim] - before[dim],
    }))
    .filter(d => Math.abs(d.delta) > 0.01)
}

export function getStyleLabel(dimension: keyof StyleModel): string {
  return STYLE_LABELS[dimension].label
}

export function defaultStyleModel(): StyleModel {
  return {
    tone: 0.5,
    brevity: 0.5,
    hookIntensity: 0.5,
    expertiseDepth: 0.5,
    evidenceStyle: 0.5,
    ctaFriction: 0.5,
    perspective: 0.5,
    vocabularyRigor: 0.5,
  }
}
