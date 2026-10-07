<template>
  <div class="article-page">
    <article class="container article-container">
      <header class="article-head">
        <router-link
          v-if="article.category_slug"
          :to="`/section/${article.category_slug}`"
          class="kicker breadcrumb"
        >{{ article.category_name_en || article.category_name }}</router-link>
        <h1 class="article-title">{{ article.title }}</h1>
        <p v-if="article.title_en" class="article-sub en-sub">{{ article.title_en }}</p>

        <div class="article-meta">
          <span>{{ article.author }}</span>
          <span class="dot">·</span>
          <span>{{ formatDate(article.published_at) }}</span>
        </div>
      </header>

      <div v-if="article.cover_url" class="article-cover">
        <img :src="article.cover_url" :alt="article.title" />
      </div>

      <div class="article-body">
        <MarkdownContent :content="article.content || ''" />
      </div>

      <footer class="article-foot">
        <div v-if="tags.length" class="article-tags">
          <span v-for="t in tags" :key="t" class="tag">{{ t }}</span>
        </div>

        <div class="article-nav">
          <router-link v-if="article.prev" :to="`/article/${article.prev.id}`" class="nav-item prev">
            <span class="nav-label">上一篇</span>
            <span class="nav-title">{{ article.prev.title }}</span>
          </router-link>
          <router-link v-if="article.next" :to="`/article/${article.next.id}`" class="nav-item next">
            <span class="nav-label">下一篇</span>
            <span class="nav-title">{{ article.next.title }}</span>
          </router-link>
        </div>
      </footer>
    </article>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import MarkdownContent from '../../components/MarkdownContent.vue'
import { publicApi } from '../../api'
import type { Article } from '../../types'
import dayjs from 'dayjs'

const route = useRoute()
const article = ref<Article>({} as Article)

const tags = computed(() => (article.value.tags || '').split(',').map((t) => t.trim()).filter(Boolean))

function formatDate(d: string | null) {
  if (!d) return ''
  return dayjs(d).format('YYYY 年 M 月 D 日')
}

onMounted(async () => {
  const id = Number(route.params.id)
  if (!id) return
  try {
    article.value = await publicApi.getArticle(id)
    document.title = `${article.value.title} · 半山学堂`
  } catch (e) {
    console.error('加载文章失败:', e)
  }
})
</script>

<style scoped>
.article-page {
  padding-bottom: 40px;
}

.article-container {
  max-width: 760px;
}

.article-head {
  padding: 88px 0 48px;
}

.breadcrumb {
  display: inline-block;
  transition: color 0.25s ease;
}

.breadcrumb:hover {
  color: var(--c-accent);
}

.article-title {
  margin-top: 22px;
  font-size: 40px;
  font-weight: 600;
  line-height: 1.35;
  letter-spacing: 0.03em;
}

.article-sub {
  margin-top: 18px;
  font-size: 16px;
  line-height: 1.6;
}

.article-meta {
  margin-top: 28px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--c-muted);
}

.dot {
  color: var(--c-line);
}

.article-cover {
  margin: 8px 0 40px;
}

.article-cover img {
  width: 100%;
}

.article-body {
  padding-bottom: 24px;
}

.article-foot {
  margin-top: 48px;
  padding-top: 32px;
  border-top: 1px solid var(--c-line);
}

.article-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.tag {
  font-size: 12px;
  color: var(--c-ink-soft);
  border: 1px solid var(--c-line);
  padding: 5px 14px;
  border-radius: 100px;
}

.article-nav {
  margin-top: 40px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.nav-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 18px 20px;
  border: 1px solid var(--c-line);
  transition: border-color 0.25s ease;
}

.nav-item:hover {
  border-color: var(--c-ink);
}

.nav-item.next {
  text-align: right;
}

.nav-label {
  font-family: var(--font-en);
  font-size: 11px;
  letter-spacing: 0.1em;
  color: var(--c-muted);
  text-transform: uppercase;
}

.nav-title {
  font-size: 14px;
  color: var(--c-ink);
  line-height: 1.5;
}

@media (max-width: 600px) {
  .article-title {
    font-size: 28px;
  }

  .article-nav {
    grid-template-columns: 1fr;
  }
}
</style>
