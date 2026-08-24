import type { BatchCreateResult } from '#shared/types/link'
import { computed, readonly, shallowRef } from 'vue'
import { UrlSchema } from '#shared/schemas/link'
import { useAPI } from '@/utils/api'

export interface InvalidUrl {
  line: number
  value: string
  error: string
}

type BatchCreateStatus = 'idle' | 'submitting' | 'success' | 'error'

export function useLinkBatchCreate() {
  const status = shallowRef<BatchCreateStatus>('idle')
  const result = shallowRef<BatchCreateResult | null>(null)
  const error = shallowRef<string | null>(null)

  const isSubmitting = computed(() => status.value === 'submitting')

  function parseUrls(text: string): { urls: string[], invalid: InvalidUrl[] } {
    const urls: string[] = []
    const invalid: InvalidUrl[] = []

    text.split(/\r?\n/).forEach((line, index) => {
      const value = line.trim()
      if (!value)
        return

      const parsed = UrlSchema.safeParse(value)
      if (parsed.success) {
        urls.push(parsed.data)
      }
      else {
        invalid.push({
          line: index + 1,
          value,
          error: parsed.error.issues[0]?.message ?? 'Invalid URL',
        })
      }
    })

    return { urls, invalid }
  }

  async function submit(urls: string[]): Promise<BatchCreateResult | null> {
    if (status.value === 'submitting' || urls.length === 0)
      return null

    status.value = 'submitting'
    result.value = null
    error.value = null
    try {
      const data = await useAPI<BatchCreateResult>('/api/link/batch', {
        method: 'POST',
        body: { urls },
      })
      result.value = data
      status.value = 'success'
      return data
    }
    catch (cause) {
      console.error(cause)
      error.value = cause instanceof Error ? cause.message : String(cause)
      status.value = 'error'
      return null
    }
  }

  function reset() {
    if (status.value === 'submitting')
      return

    status.value = 'idle'
    result.value = null
    error.value = null
  }

  return {
    status: readonly(status),
    result: readonly(result),
    error: readonly(error),
    isSubmitting,
    parseUrls,
    submit,
    reset,
  }
}
