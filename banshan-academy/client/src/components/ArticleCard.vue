<template>
  <router-link :to="`/article/${article.id}`" class="article-card">
    <div class="card-cover">
      <img v-if="article.cover_url" :src="article.cover_url" :alt="article.title" loading="lazy" />
      <div v-else class="cover-placeholder">
        <svg viewBox="0 0 48 48" width="40" height="40" fill="none">
          <path d="M6 36 L20 12 L29 27 L33 20 L42 36 Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
        </svg>
      </div>
    </div>

    <div class="card-meta">
      <span class="kicker">{{ article.category_name_en || article.category_name }}</span>
      <span class="card-date">{{ formatDate(article.published_at) }}</span>
    </div>
    <h3 class="card-title">{{ article.title }}</h3>
    <p v-if="article.title_en" class="card-sub en-sub">{{ article.title_en }}</p>
  </router-link>
</template>

<script setup lang="ts">
import type { Article } from '../types'
import dayjs from 'dayjs'

defineProps<{ article: Article }>()

function formatDate(d: string | null) {
  if (!d) return ''
  return dayjs(d).format('YYYY.MM.DD')
}
</script>

<style scoped>
.article-card {
  display: block;
  cursor: pointer;
}

.card-cover {
  aspect-ratio: 4 / 3;
  background: var(--c-bg-soft);
  overflow: hidden;
  position: relative;
}

.card-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.6s ease;
}

.article-card:hover .card-cover img {
  transform: scale(1.05);
}

.cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #c9c9c4;
  background: linear-gradient(135deg, #f6f6f4 0%, #ececea 100%);
}

.card-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 18px;
}

.card-date {
  font-family: var(--font-en);
  font-size: 11px;
  color: var(--c-muted);
  letter-spacing: 0.05em;
}

.card-title {
  margin-top: 10px;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.45;
  letter-spacing: 0.02em;
  color: var(--c-ink);
  transition: color 0.25s ease;
}

.article-card:hover .card-title {
  color: var(--c-accent);
}

.card-sub {
  margin-top: 6px;
  font-size: 13px;
  line-height: 1.5;
}
</style>
