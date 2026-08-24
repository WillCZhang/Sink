import type { BatchCreateResult } from '../../shared/types/link'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLinkBatchCreate } from '../../app/composables/useLinkBatchCreate'

const mocks = vi.hoisted(() => ({ useAPI: vi.fn() }))

const originalGlobals = vi.hoisted(() => {
  const useAppConfig = Object.getOwnPropertyDescriptor(globalThis, 'useAppConfig')
  const useRuntimeConfig = Object.getOwnPropertyDescriptor(globalThis, 'useRuntimeConfig')
  Object.assign(globalThis, {
    useAppConfig: () => ({ slugRegex: /^[a-z0-9]+(?:-[a-z0-9]+)*$/i }),
    useRuntimeConfig: () => ({ public: { slugDefaultLength: '6' } }),
  })
  return { useAppConfig, useRuntimeConfig }
})

vi.mock('@/utils/api', () => ({ useAPI: mocks.useAPI }))

beforeEach(() => {
  mocks.useAPI.mockReset()
})

afterAll(() => {
  for (const [name, descriptor] of Object.entries(originalGlobals)) {
    if (descriptor)
      Object.defineProperty(globalThis, name, descriptor)
    else
      Reflect.deleteProperty(globalThis, name)
  }
})

describe('useLinkBatchCreate', () => {
  it('parses urls from multiline text and reports invalid lines', () => {
    const { parseUrls } = useLinkBatchCreate()
    const { urls, invalid } = parseUrls('https://a.com\n\n  https://b.com  \nnot-a-url\n')

    expect(urls).toEqual(['https://a.com', 'https://b.com'])
    expect(invalid).toHaveLength(1)
    expect(invalid[0]!.line).toBe(4)
    expect(invalid[0]!.value).toBe('not-a-url')
  })

  it('submits urls and returns the batch result', async () => {
    const result: BatchCreateResult = { success: 1, failed: 0, successItems: [], failedItems: [] }
    mocks.useAPI.mockResolvedValue(result)

    const { submit, status } = useLinkBatchCreate()
    const data = await submit(['https://a.com'])

    expect(data).toBe(result)
    expect(status.value).toBe('success')
    expect(mocks.useAPI).toHaveBeenCalledWith('/api/link/batch', {
      method: 'POST',
      body: { urls: ['https://a.com'] },
    })
  })

  it('captures request errors', async () => {
    mocks.useAPI.mockRejectedValue(new Error('boom'))

    const { submit, status, error } = useLinkBatchCreate()
    const data = await submit(['https://a.com'])

    expect(data).toBeNull()
    expect(status.value).toBe('error')
    expect(error.value).toBe('boom')
  })
})
