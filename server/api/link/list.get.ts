import { z } from 'zod'

const ListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(20),
  cursor: z.string().trim().max(1024).optional(),
  sort: z.enum(['az', 'za', 'newest', 'oldest']).default('newest'),
  tag: z.string().trim().toLowerCase().min(1).max(32).optional(),
  status: z.enum(['active', 'expired', 'all']).default('active'),
})

export default eventHandler(async (event) => {
  const { limit, cursor, sort, tag, status } = await getValidatedQuery(event, ListQuerySchema.parse)

  const list = await listLinks(event, { limit, cursor, sort, tag, status })
  return {
    ...list,
    links: sanitizeLinksPassword(list.links),
  }
})
