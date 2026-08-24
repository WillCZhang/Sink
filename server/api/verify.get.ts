export default eventHandler((event) => {
  const authMethod: unknown = event.context.authMethod
  const userID: unknown = event.context.userID
  const userEmail: unknown = event.context.userEmail
  if (
    (
      authMethod !== 'site-token'
      && authMethod !== 'access-user'
      && authMethod !== 'access-service'
    )
    || typeof userID !== 'string'
    || !userID
    || typeof userEmail !== 'string'
    || !userEmail
  ) {
    throw createError({
      status: 401,
      statusText: 'Unauthorized',
    })
  }

  const { cfAccessTeamDomain, cfAccessAud } = useRuntimeConfig(event)

  return {
    name: 'Sink',
    url: 'https://sink.cool',
    authMethod,
    userID,
    userEmail,
    accessEnabled: isCloudflareAccessConfigured(cfAccessTeamDomain, cfAccessAud),
  }
})
