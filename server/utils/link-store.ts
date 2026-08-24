import type { H3Event } from 'h3'
import type { Link } from '#shared/schemas/link'
import type { LinkSearchItem } from '#shared/types/link'
import type { ExpectedLinkVersion, LinkFilterOptions, ListLinksOptions, ListLinksResult, SearchLinksOptions } from '../services/link-store/d1'
import { getRequestHost, getRequestProtocol } from 'h3'
import {
  d1CountLinks,
  d1CreateLink,
  d1CreateLinks,
  d1DeleteLink,
  d1GetActiveLink,
  d1GetAnyLink,
  d1GetLinkWithMetadata,
  d1IterateAllLinks,
  d1ListLinks,
  d1ListTags,
  d1SearchLinks,
  d1UpdateLink,
} from '../services/link-store/d1'
import { deleteLinkCache, putLinkCache, readLegacyKvLink } from '../services/link-store/kv'

export function normalizeSlug(event: H3Event, slug: string): string {
  const { caseSensitive } = useRuntimeConfig(event)
  return caseSensitive ? slug : slug.toLowerCase()
}

export function buildShortLink(event: H3Event, slug: string): string {
  return `${getRequestProtocol(event)}://${getRequestHost(event)}/${slug}`
}

// Schedules a best-effort KV cache operation outside the request path. D1 is the
// authoritative store, so a failed or dropped cache write must never surface.
function background(event: H3Event, promise: Promise<unknown>): void {
  const ctx = event.context?.cloudflare?.context
  if (ctx && typeof ctx.waitUntil === 'function')
    ctx.waitUntil(promise)
  else
    promise.catch(() => {})
}

export async function getLink(event: H3Event, slug: string, cacheTtl?: number): Promise<Link | null> {
  const cached = await readLegacyKvLink(event, slug, cacheTtl)
  if (cached.link)
    return cached.link

  const stored = await d1GetActiveLink(event, slug)
  if (!stored)
    return null
  background(event, putLinkCache(event, stored.link, stored.effectiveExpiresAt))
  return stored.link
}

export async function getAuthoritativeLink(event: H3Event, slug: string): Promise<Link | null> {
  return (await d1GetActiveLink(event, slug))?.link ?? null
}

export async function getAnyAuthoritativeLink(event: H3Event, slug: string): Promise<Link | null> {
  return await d1GetAnyLink(event, slug)
}

export async function getLinkWithMetadata(event: H3Event, slug: string): Promise<{ link: Link | null, metadata: Record<string, unknown> | null }> {
  return await d1GetLinkWithMetadata(event, slug)
}

export async function createLink(event: H3Event, link: Link): Promise<boolean> {
  const result = await d1CreateLink(event, link)
  if (!result.created)
    return false
  background(event, putLinkCache(event, link, result.effectiveExpiresAt))
  return true
}

export type CreateLinksResult = { created: boolean } | { error: unknown }

export async function createLinks(event: H3Event, links: Link[]): Promise<CreateLinksResult[]> {
  try {
    const results = await d1CreateLinks(event, links)
    return results.map(result => ({ created: result.created }))
  }
  catch {
    const fallbackResults: CreateLinksResult[] = []
    for (const link of links) {
      try {
        fallbackResults.push({ created: await createLink(event, link) })
      }
      catch (error) {
        fallbackResults.push({ error })
      }
    }
    return fallbackResults
  }
}

export async function updateLink(event: H3Event, link: Link, expected?: ExpectedLinkVersion): Promise<boolean> {
  const result = await d1UpdateLink(event, link, expected)
  if (!result.updated)
    return false
  background(event, deleteLinkCache(event, link.slug))
  return true
}

export async function deleteLink(event: H3Event, slug: string): Promise<void> {
  await d1DeleteLink(event, slug)
  background(event, deleteLinkCache(event, slug))
}

export async function listLinks(event: H3Event, options: ListLinksOptions): Promise<ListLinksResult> {
  return await d1ListLinks(event, options)
}

export function iterateAllAuthoritativeLinks(env: Cloudflare.Env): AsyncIterable<Link> {
  return d1IterateAllLinks(env)
}

export async function searchLinks(event: H3Event, options: SearchLinksOptions): Promise<LinkSearchItem[]> {
  return await d1SearchLinks(event, options)
}

export async function countLinks(event: H3Event, options: LinkFilterOptions): Promise<number> {
  return await d1CountLinks(event, options)
}

export async function listTags(event: H3Event): Promise<{ name: string, count: number }[]> {
  return await d1ListTags(event)
}
