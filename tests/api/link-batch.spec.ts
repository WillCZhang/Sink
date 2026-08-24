import type { BatchCreateResult } from '#shared/types/link'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { deleteStoredLinks, fetch, getD1Link, postJson, setLinkStoreD1Mode } from '../utils'

const createdSlugs = new Set<string>()

beforeEach(async () => {
  await setLinkStoreD1Mode()
})

afterEach(async () => {
  await deleteStoredLinks([...createdSlugs])
  createdSlugs.clear()
})

function trackSlugs(result: BatchCreateResult) {
  for (const item of result.successItems)
    createdSlugs.add(item.link.slug)
}

describe('/api/link/batch', { concurrent: false }, () => {
  it('creates a random link for each url', async () => {
    const urls = [
      'https://example.com/batch-1',
      'https://example.com/batch-2',
      'https://example.com/batch-3',
    ]

    const response = await postJson('/api/link/batch', { urls })
    expect(response.status).toBe(200)

    const data = await response.json() as BatchCreateResult
    trackSlugs(data)
    expect(data.success).toBe(3)
    expect(data.failed).toBe(0)
    expect(data.successItems).toHaveLength(3)

    for (const item of data.successItems) {
      expect(urls).toContain(item.link.url)
      expect(item.link.slug).not.toBe('')
      expect(item.shortLink).toContain(item.link.slug)
      expect(await getD1Link(item.link.slug)).not.toBeNull()
    }
  })

  it('generates distinct random slugs for the same url', async () => {
    const response = await postJson('/api/link/batch', {
      urls: ['https://example.com/duplicate', 'https://example.com/duplicate'],
    })
    expect(response.status).toBe(200)

    const data = await response.json() as BatchCreateResult
    trackSlugs(data)
    expect(data.success).toBe(2)
    const slugs = data.successItems.map(item => item.link.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('returns 400 when urls is missing or empty', async () => {
    expect((await postJson('/api/link/batch', {})).status).toBe(400)
    expect((await postJson('/api/link/batch', { urls: [] })).status).toBe(400)
  })

  it('returns 400 when a url is invalid', async () => {
    const response = await postJson('/api/link/batch', {
      urls: ['not-a-valid-url'],
    })
    expect(response.status).toBe(400)
  })

  it('returns 401 when accessing without auth', async () => {
    const response = await fetch('/api/link/batch', {
      method: 'POST',
      body: JSON.stringify({ urls: ['https://example.com'] }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(response.status).toBe(401)
  })
})
