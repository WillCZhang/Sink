<script setup lang="ts">
import errorImage from './assets/images/404.svg?raw'
</script>

<template>
  <div
    class="
      flex min-h-svh flex-col items-center justify-center gap-6 bg-background
      px-6 py-16 text-foreground
    "
  >
    <div
      class="
        w-full max-w-[500px]
        [&_svg]:h-auto [&_svg]:w-full
      "
    >
      <span class="contents" v-html="errorImage" />
    </div>

    <div class="flex flex-col items-center gap-2 text-center">
      <h1 class="text-2xl font-medium">
        {{ $t('common.not_found') }}
      </h1>
      <p class="max-w-sm text-pretty text-muted-foreground">
        {{ $t('common.not_found_description') }}
      </p>
    </div>
  </div>
</template>

<style scoped>
@media (prefers-reduced-motion: reduce) {
  :deep(svg *) {
    animation: none !important;
  }
}
</style>
