import { AzureOpenAI } from 'openai'

let _client: AzureOpenAI | null = null

export function getAzureClient(): AzureOpenAI {
  if (!_client) {
    _client = new AzureOpenAI({
      apiKey: process.env.AZURE_OPENAI_API_KEY!,
      endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
      apiVersion: process.env.AZURE_OPENAI_API_VERSION!,
    })
  }
  return _client
}

// Named export alias kept for any remaining direct callers
export const azureClient = { get chat() { return getAzureClient().chat } } as unknown as AzureOpenAI

export const DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT ?? ''
