import { z } from 'zod'

const QueryParamsSchema = z.object({
  slug: z.string().trim().min(1).max(2048),
})

export default eventHandler(async (event) => {
  const query = await getValidatedQuery(event, QueryParamsSchema.parse)
  const slug = normalizeSlug(event, query.slug)

  const { link, metadata } = await getLinkWithMetadata(event, slug)
  if (link) {
    return sanitizeLinkPassword({
      ...metadata,
      ...link,
    })
  }

  throw createError({
    status: 404,
    statusText: 'Not Found',
  })
})
