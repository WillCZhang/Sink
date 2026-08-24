import type { Link } from '#shared/schemas/link'
import { EditLinkSchema } from '#shared/schemas/link'

export default eventHandler(async (event) => {
  const { previewMode } = useRuntimeConfig(event).public
  if (previewMode) {
    throw createError({
      status: 403,
      statusText: 'Preview mode cannot edit links.',
    })
  }
  const link = await readValidatedBody(event, EditLinkSchema.parse)
  link.slug = normalizeSlug(event, link.slug)

  const existingLink: Link | null = await getAnyAuthoritativeLink(event, link.slug)
  if (!existingLink) {
    throw createError({
      status: 404,
      statusText: 'Link not found',
    })
  }

  if (link.url !== existingLink.url)
    await detectUnsafeLink(event, link)

  const newLink = mergeEditableLink(existingLink, link)
  await applyEditableLinkPassword(newLink, link.password)

  if (!await updateLink(event, newLink, { id: existingLink.id, updatedAt: existingLink.updatedAt })) {
    throw createError({
      status: 409,
      statusText: 'Link was modified or replaced',
    })
  }
  setResponseStatus(event, 201)
  return buildLinkResponse(event, newLink)
})
