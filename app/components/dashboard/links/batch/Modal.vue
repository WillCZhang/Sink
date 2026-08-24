<script setup lang="ts">
import type { InvalidUrl } from '@/composables/useLinkBatchCreate'
import { Copy, CopyCheck, ListPlus, Loader2 } from '@lucide/vue'
import { useClipboard } from '@vueuse/core'
import { toast } from 'vue-sonner'

const { t } = useI18n()
const linksStore = useDashboardLinksStore()
const linksSearchStore = useDashboardLinksSearchStore()
const batchCreate = useLinkBatchCreate()

const open = defineModel<boolean>('open', { default: false })
const text = ref('')
const invalidLines = shallowRef<InvalidUrl[]>([])
const showEmptyError = ref(false)
const copiedSlug = shallowRef<string | null>(null)

const { copy } = useClipboard({ copiedDuring: 1500 })

watch(text, () => {
  invalidLines.value = []
  showEmptyError.value = false
})

watch(open, (isOpen) => {
  if (isOpen)
    return

  batchCreate.reset()
  text.value = ''
  invalidLines.value = []
  showEmptyError.value = false
})

function handleSubmit() {
  if (batchCreate.isSubmitting.value)
    return

  invalidLines.value = []
  showEmptyError.value = false

  const { urls, invalid } = batchCreate.parseUrls(text.value)
  if (invalid.length) {
    invalidLines.value = invalid
    return
  }
  if (!urls.length) {
    showEmptyError.value = true
    return
  }

  void doSubmit(urls)
}

async function doSubmit(urls: string[]) {
  const data = await batchCreate.submit(urls)
  if (!data)
    return

  for (const item of data.successItems) {
    linksStore.notifyLinkUpdate(item.link, 'create')
    linksSearchStore.syncLink(item.link, 'create')
  }

  if (data.success > 0)
    toast.success(t('links.batch_create.result.success_title', { count: data.success }))
  if (data.failed > 0)
    toast.error(t('links.batch_create.result.failed_title', { count: data.failed }))
}

async function copyLink(slug: string, shortLink: string) {
  await copy(shortLink)
  copiedSlug.value = slug
  setTimeout(() => {
    if (copiedSlug.value === slug)
      copiedSlug.value = null
  }, 1500)
}

function handleClose() {
  if (batchCreate.isSubmitting.value)
    return

  open.value = false
}
</script>

<template>
  <ResponsiveModal
    v-model:open="open"
    :title="t('links.batch_create.title')"
    :description="t('links.batch_create.description')"
    :prevent-close="batchCreate.isSubmitting.value"
  >
    <template #trigger>
      <Button variant="outline">
        <ListPlus aria-hidden="true" />
        {{ $t('links.batch_create.title') }}
      </Button>
    </template>

    <form
      id="batch-create-form"
      class="w-full space-y-4 px-1"
      @submit.prevent="handleSubmit"
    >
      <fieldset :disabled="batchCreate.isSubmitting.value" class="space-y-4">
        <Field>
          <FieldLabel for="batch-create-urls">
            {{ $t('links.batch_create.textarea_label') }}
          </FieldLabel>
          <Textarea
            id="batch-create-urls"
            v-model="text"
            :placeholder="$t('links.batch_create.textarea_placeholder')"
            class="min-h-40 font-mono"
            autocomplete="off"
            autocapitalize="none"
            spellcheck="false"
          />
          <FieldDescription v-if="showEmptyError" class="text-destructive">
            {{ $t('links.batch_create.empty') }}
          </FieldDescription>
        </Field>

        <div v-if="invalidLines.length" class="space-y-1">
          <p class="text-sm font-medium text-destructive">
            {{ $t('links.batch_create.invalid_lines_title', { count: invalidLines.length }) }}
          </p>
          <ul class="space-y-1">
            <li
              v-for="item in invalidLines"
              :key="item.line"
              class="text-sm break-all text-muted-foreground"
            >
              {{ $t('links.batch_create.line_label', { line: item.line }) }}: {{ item.value }}
            </li>
          </ul>
        </div>

        <div
          v-if="batchCreate.error.value"
          role="alert"
          class="text-sm text-destructive"
        >
          {{ $t('links.batch_create.request_failed') }}
        </div>

        <div v-if="batchCreate.result.value" class="space-y-4">
          <div v-if="batchCreate.result.value.success" class="space-y-2">
            <p class="text-sm font-medium">
              {{ $t('links.batch_create.result.success_title', { count: batchCreate.result.value.success }) }}
            </p>
            <ul class="space-y-2">
              <li
                v-for="item in batchCreate.result.value.successItems"
                :key="item.link.slug"
                class="
                  flex items-center gap-2 rounded-xl border bg-input/30 px-3
                  py-2
                "
              >
                <span class="min-w-0 flex-1 truncate font-mono text-sm">
                  {{ item.shortLink }}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  :aria-label="$t('links.batch_create.result.copy')"
                  @click="copyLink(item.link.slug, item.shortLink)"
                >
                  <CopyCheck v-if="copiedSlug === item.link.slug" class="size-4" aria-hidden="true" />
                  <Copy v-else class="size-4" aria-hidden="true" />
                </Button>
              </li>
            </ul>
          </div>

          <div v-if="batchCreate.result.value.failed" class="space-y-1">
            <p class="text-sm font-medium text-destructive">
              {{ $t('links.batch_create.result.failed_title', { count: batchCreate.result.value.failed }) }}
            </p>
            <ul class="space-y-1">
              <li
                v-for="(item, index) in batchCreate.result.value.failedItems"
                :key="index"
                class="text-sm break-all text-muted-foreground"
              >
                {{ item.url }} — {{ item.reason }}
              </li>
            </ul>
          </div>
        </div>
      </fieldset>
    </form>

    <template #footer>
      <Button
        type="button"
        variant="secondary"
        class="
          w-full
          sm:w-auto
        "
        :disabled="batchCreate.isSubmitting.value"
        @click="handleClose"
      >
        {{ $t('common.close') }}
      </Button>
      <Button
        type="submit"
        form="batch-create-form"
        class="
          w-full
          sm:w-auto
        "
        :disabled="batchCreate.isSubmitting.value"
        :aria-busy="batchCreate.isSubmitting.value"
      >
        <Loader2
          v-if="batchCreate.isSubmitting.value" class="motion-safe:animate-spin" aria-hidden="true"
        />
        {{ batchCreate.isSubmitting.value ? $t('links.batch_create.creating') : $t('links.batch_create.submit') }}
      </Button>
    </template>
  </ResponsiveModal>
</template>
