import { CreateLinkSchema } from '#shared/schemas/link'

export default eventHandler(async (event) => {
  const link = await readValidatedBody(event, CreateLinkSchema.parse)

  await prepareIncomingLink(event, link)

  await hashLinkPasswordForCreate(link)

  if (!await createLink(event, link)) {
    throw createError({
      status: 409,
      statusText: 'Link already exists',
    })
  }
  setResponseStatus(event, 201)
  return buildLinkResponse(event, link)
})
