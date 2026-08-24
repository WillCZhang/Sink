import type { BatchCreateResult } from '#shared/types/link'
import { BatchCreateLinksSchema, CreateLinkSchema, nanoid } from '#shared/schemas/link'

// D1 batches are bounded, so write in small chunks like the import flow.
const chunkSize = 4
// Random slugs essentially never collide; retry a few times for correctness.
const maxSlugRetries = 3

export default eventHandler(async (event) => {
  const { urls } = await readValidatedBody(event, BatchCreateLinksSchema.parse)

  const result: BatchCreateResult = {
    success: 0,
    failed: 0,
    successItems: [],
    failedItems: [],
  }

  for (let offset = 0; offset < urls.length; offset += chunkSize) {
    const chunk = urls.slice(offset, offset + chunkSize)

    // Build a full link per URL with a freshly generated random slug.
    // Ignore all other settings and skip unsafe detection (purely random short links).
    const prepared = chunk.map((url) => {
      const link = CreateLinkSchema.parse({ url })
      link.slug = normalizeSlug(event, link.slug)
      return { url, link }
    })

    const writeResults = await createLinks(event, prepared.map(item => item.link))

    for (let index = 0; index < prepared.length; index++) {
      const { url, link } = prepared[index]!
      const writeResult = writeResults[index]!

      if ('error' in writeResult) {
        result.failed++
        result.failedItems.push({
          url,
          reason: writeResult.error instanceof Error ? writeResult.error.message : 'Unknown error',
        })
        continue
      }

      if (writeResult.created) {
        result.success++
        result.successItems.push(buildLinkResponse(event, link))
        continue
      }

      // Slug collision: retry with a fresh random slug.
      let createdLink: typeof link | null = null
      for (let attempt = 0; attempt < maxSlugRetries && !createdLink; attempt++) {
        const retriedLink = { ...link, slug: normalizeSlug(event, nanoid()()) }
        if (await createLink(event, retriedLink))
          createdLink = retriedLink
      }

      if (createdLink) {
        result.success++
        result.successItems.push(buildLinkResponse(event, createdLink))
      }
      else {
        result.failed++
        result.failedItems.push({ url, reason: 'Link already exists' })
      }
    }
  }

  setResponseHeader(event, 'Cache-Control', 'no-store')
  return result
})
