import type { H3Event } from 'h3'
import type { Compilable } from 'kysely'

export function useWAE(event: H3Event, query: Compilable) {
  // i don't like that i need to get entire config here...
  // but seems like this global context being passed around anyways...
  // so i guess this is how node people would do it...?
  const config = useRuntimeConfig(event)

  const cfAccountId = event.context.cloudflare?.env?.NUXT_CF_ACCOUNT_ID || config.cfAccountId
  const cfApiToken = event.context.cloudflare?.env?.NUXT_CF_API_TOKEN || config.cfApiToken
  console.log('useWAE', { cfAccountId, cfApiToken, config })
  if (!cfAccountId || !cfApiToken)
    return { data: [] }

  const compiledQuery = compileAnalyticsQuery(query)

  // if (import.meta.dev)
  console.info('useWAE', compiledQuery)

  return $fetch(`https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/analytics_engine/sql`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfApiToken}`,
    },
    body: compiledQuery,
    retry: 1,
    retryDelay: 100, // ms
  })
}
