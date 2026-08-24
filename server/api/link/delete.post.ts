import { z } from 'zod'
import { SlugSchema } from '#shared/schemas/link'

const DeleteSchema = z.object({
  slug: SlugSchema.min(1),
})

export default eventHandler(async (event) => {
  const { previewMode } = useRuntimeConfig(event).public
  if (previewMode) {
    throw createError({
      status: 403,
      statusText: 'Preview mode cannot delete links.',
    })
  }

  const body = await readValidatedBody(event, DeleteSchema.parse)
  const slug = normalizeSlug(event, body.slug)
  await deleteLink(event, slug)
})
