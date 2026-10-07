<template>
  <div class="prose" v-html="rendered"></div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import MarkdownIt from 'markdown-it'

const props = defineProps<{ content: string }>()

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false
})

const rendered = computed(() => md.render(props.content || ''))
</script>
