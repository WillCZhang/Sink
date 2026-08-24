import { z } from 'zod'

const SearchQuerySchema = z.object({
  q: z.string().trim().refine(value => new TextEncoder().encode(value.toLowerCase().replace(/[!%_]/g, '!$&')).length <= 48, {
    message: 'Search query must not exceed 48 UTF-8 bytes',
  }).optional(),
  url: z.string().trim().url().max(2048).optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  tag: z.string().trim().toLowerCase().min(1).max(32).optional(),
  status: z.enum(['active', 'expired', 'all']).default('active'),
})

export default eventHandler(async (event) => {
  const query = await getValidatedQuery(event, SearchQuerySchema.parse)
  if (!query.q && !query.url)
    return []

  return await searchLinks(event, {
    ...query,
    limit: query.limit ?? 20,
  })
})
