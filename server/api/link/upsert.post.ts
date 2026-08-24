import { CreateLinkSchema } from '#shared/schemas/link'

export default eventHandler(async (event) => {
  const link = await readValidatedBody(event, CreateLinkSchema.parse)

  await prepareIncomingLink(event, link)

  const existingLink = await getAuthoritativeLink(event, link.slug)
  if (existingLink) {
    return { ...buildLinkResponse(event, existingLink), status: 'existing' }
  }

  await hashLinkPasswordForCreate(link)

  if (!await createLink(event, link)) {
    const racedLink = await getAuthoritativeLink(event, link.slug)
    if (racedLink)
      return { ...buildLinkResponse(event, racedLink), status: 'existing' }
    throw createError({ status: 409, statusText: 'Link already exists' })
  }
  setResponseStatus(event, 201)
  return { ...buildLinkResponse(event, link), status: 'created' }
})
