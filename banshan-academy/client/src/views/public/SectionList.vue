<template>
  <div class="section-page">
    <header class="page-head container">
      <p class="kicker">{{ category?.name_en || 'Section' }}</p>
      <h1 class="page-title">{{ category?.name || '栏目' }}</h1>
      <p v-if="isMethodSection" class="project-credit">
        山东省研究生教育质量提升计划项目，项目编号：223 SDYAL2023199
      </p>
      <p v-if="category" class="page-count en-sub">{{ total }} entries</p>
    </header>

    <div class="container">
      <div v-if="loading && !articles.length" class="empty">加载中…</div>
      <div v-else-if="!articles.length" class="empty">该栏目暂无内容</div>
      <div v-else class="grid">
        <ArticleCard v-for="a in articles" :key="a.id" :article="a" />
      </div>

      <div v-if="hasMore" class="load-more">
        <button class="btn btn-ghost" @click="loadMore" :disabled="loading">加载更多</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import ArticleCard from '../../components/ArticleCard.vue'
import { publicApi } from '../../api'
import type { Article, Category } from '../../types'

const route = useRoute()
const slug = () => route.params.slug as string
const isMethodSection = computed(() => slug() === 'method')

const category = ref<Category | null>(null)
const articles = ref<Article[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 12
const loading = ref(false)
const hasMore = ref(false)

async function load(reset = false) {
  if (loading.value) return
  loading.value = true
  try {
    const current = reset ? 1 : page.value
    const res = await publicApi.getArticles({ category: slug(), page: current, pageSize })
    if (reset) {
      articles.value = res.list
    } else {
      articles.value = [...articles.value, ...res.list]
    }
    total.value = res.pagination.total
    page.value = current
    hasMore.value = res.pagination.page < res.pagination.totalPages
  } catch (e) {
    console.error('加载栏目失败:', e)
  } finally {
    loading.value = false
  }
}

function loadMore() {
  page.value += 1
  load()
}

async function resolveCategory() {
  try {
    const cats = await publicApi.getCategories()
    category.value = cats.find((c) => c.slug === slug()) || null
  } catch (e) {
    console.error('加载栏目信息失败:', e)
  }
}

onMounted(() => {
  resolveCategory()
  load(true)
})

watch(
  () => route.params.slug,
  () => {
    category.value = null
    articles.value = []
    total.value = 0
    page.value = 1
    resolveCategory()
    load(true)
  }
)
</script>

<style scoped>
.section-page {
  padding-bottom: 40px;
}

.page-head {
  padding: 96px 0 56px;
  border-bottom: 1px solid var(--c-line);
  margin-bottom: 56px;
}

.page-title {
  margin-top: 14px;
  font-size: 44px;
  font-weight: 600;
  letter-spacing: 0.06em;
}

.project-credit {
  margin-top: 18px;
  color: var(--c-muted);
  font-size: 13px;
  line-height: 1.8;
  letter-spacing: 0.02em;
}

.page-count {
  margin-top: 14px;
  font-size: 13px;
  letter-spacing: 0.08em;
}

.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 40px 28px;
}

.empty {
  padding: 80px 0;
  text-align: center;
  color: var(--c-muted);
  font-size: 14px;
}

.load-more {
  margin-top: 64px;
  text-align: center;
}

@media (max-width: 900px) {
  .grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .page-title {
    font-size: 34px;
  }
}

@media (max-width: 600px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
