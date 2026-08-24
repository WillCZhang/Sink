export default eventHandler((event) => {
  const { cloudflare } = event.context
  const { request: { cf } } = cloudflare
  return {
    latitude: cf?.latitude,
    longitude: cf?.longitude,
  }
})
