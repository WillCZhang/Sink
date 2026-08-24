import type { H3Event } from 'h3'
import type { Link } from '../../shared/schemas/link'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLink, createLinks, getLink } from '../../server/utils/link-store'

const mocks = vi.hoisted(() => ({
  d1CreateLink: vi.fn(),
  d1CreateLinks: vi.fn(),
  d1GetActiveLink: vi.fn(),
  deleteLinkCache: vi.fn(),
  putLinkCache: vi.fn(),
  readLegacyKvLink: vi.fn(),
}))

vi.mock('../../server/services/link-store/d1', () => ({
  d1CountLinks: vi.fn(),
  d1CreateLink: mocks.d1CreateLink,
  d1CreateLinks: mocks.d1CreateLinks,
  d1DeleteLink: vi.fn(),
  d1GetActiveLink: mocks.d1GetActiveLink,
  d1GetAnyLink: vi.fn(),
  d1GetLinkWithMetadata: vi.fn(),
  d1IterateAllLinks: vi.fn(),
  d1ListLinks: vi.fn(),
  d1ListTags: vi.fn(),
  d1SearchLinks: vi.fn(),
  d1UpdateLink: vi.fn(),
}))

vi.mock('../../server/services/link-store/kv', () => ({
  deleteLinkCache: mocks.deleteLinkCache,
  putLinkCache: mocks.putLinkCache,
  readLegacyKvLink: mocks.readLegacyKvLink,
}))

const event = {} as H3Event

function makeLink(slug: string): Link {
  return { id: `id-${slug}`, slug, url: 'https://example.com', createdAt: 1, updatedAt: 1, tags: [] }
}

describe('createLink', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('creates in D1 and schedules a best-effort KV write', async () => {
    const link = makeLink('single-success')
    mocks.d1CreateLink.mockResolvedValue({ created: true, effectiveExpiresAt: null })
    mocks.putLinkCache.mockResolvedValue(true)

    await expect(createLink(event, link)).resolves.toBe(true)

    expect(mocks.d1CreateLink).toHaveBeenCalledWith(event, link)
    expect(mocks.putLinkCache).toHaveBeenCalledWith(event, link, null)
  })

  it('returns false without touching KV when D1 reports no insert', async () => {
    mocks.d1CreateLink.mockResolvedValue({ created: false, effectiveExpiresAt: null })

    await expect(createLink(event, makeLink('single-skipped'))).resolves.toBe(false)

    expect(mocks.putLinkCache).not.toHaveBeenCalled()
  })
})

describe('createLinks', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('bulk-inserts in D1 without writing through to KV', async () => {
    const link = makeLink('bulk-success')
    mocks.d1CreateLinks.mockResolvedValue([{ created: true, effectiveExpiresAt: null }])

    await expect(createLinks(event, [link])).resolves.toEqual([{ created: true }])

    expect(mocks.d1CreateLinks).toHaveBeenCalledWith(event, [link])
    expect(mocks.putLinkCache).not.toHaveBeenCalled()
  })

  it('falls back to per-link creation when the bulk insert throws', async () => {
    const link = makeLink('bulk-fallback')
    mocks.d1CreateLinks.mockRejectedValue(new Error('batch failed'))
    mocks.d1CreateLink.mockResolvedValue({ created: true, effectiveExpiresAt: null })
    mocks.putLinkCache.mockResolvedValue(true)

    await expect(createLinks(event, [link])).resolves.toEqual([{ created: true }])

    expect(mocks.d1CreateLink).toHaveBeenCalledWith(event, link)
  })

  it('returns an error result when both bulk and per-link creation fail', async () => {
    const boom = new Error('d1 down')
    mocks.d1CreateLinks.mockRejectedValue(boom)
    mocks.d1CreateLink.mockRejectedValue(boom)

    await expect(createLinks(event, [makeLink('bulk-fail')])).resolves.toEqual([{ error: boom }])
  })
})

describe('getLink', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('returns the cached link on a KV hit', async () => {
    const link = makeLink('cached')
    mocks.readLegacyKvLink.mockResolvedValue({ link, metadata: null })

    await expect(getLink(event, link.slug)).resolves.toEqual(link)

    expect(mocks.d1GetActiveLink).not.toHaveBeenCalled()
    expect(mocks.putLinkCache).not.toHaveBeenCalled()
  })

  it('falls back to D1 and backfills KV on a miss', async () => {
    const link = makeLink('d1-hit')
    mocks.readLegacyKvLink.mockResolvedValue({ link: null, metadata: null })
    mocks.d1GetActiveLink.mockResolvedValue({ link, effectiveExpiresAt: null })
    mocks.putLinkCache.mockResolvedValue(true)

    await expect(getLink(event, link.slug)).resolves.toEqual(link)

    expect(mocks.d1GetActiveLink).toHaveBeenCalledWith(event, link.slug)
    expect(mocks.putLinkCache).toHaveBeenCalledWith(event, link, null)
  })

  it('returns null when neither KV nor D1 has an active link', async () => {
    mocks.readLegacyKvLink.mockResolvedValue({ link: null, metadata: null })
    mocks.d1GetActiveLink.mockResolvedValue(null)

    await expect(getLink(event, 'missing')).resolves.toBeNull()

    expect(mocks.putLinkCache).not.toHaveBeenCalled()
  })
})
