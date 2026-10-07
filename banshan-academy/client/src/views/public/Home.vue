<template>
  <div class="home">
    <!-- Hero -->
    <section class="hero">
      <div class="container">
        <p class="kicker hero-kicker">Visual Communication Design</p>
        <h1 class="hero-title">半山学堂</h1>
        <p class="hero-sub en-sub">Banshan Academy</p>
        <p class="hero-desc">
          关注设计艺术与设计教育 · 分享设计表现方法的教学案例 · 追踪设计前沿研究
        </p>
      </div>
    </section>

    <!-- 板块入口 -->
    <section class="sections container">
      <div class="section-head">
        <span class="kicker">Sections</span>
        <h2 class="section-title">栏目</h2>
      </div>
      <div class="section-grid">
        <router-link
          v-for="c in sections"
          :key="c.slug"
          :to="c.path"
          class="section-card"
        >
          <span class="section-index">{{ String(c.sort_order).padStart(2, '0') }}</span>
          <div class="section-info">
            <h3>{{ c.name }}</h3>
            <p class="en-sub">{{ c.name_en }}</p>
            <span class="section-count">{{ c.count }} {{ c.unit }}</span>
          </div>
          <span class="section-arrow">→</span>
        </router-link>
      </div>
    </section>

    <!-- 精选内容 -->
    <section v-if="featured.length" class="featured container">
      <div class="section-head">
        <span class="kicker">Featured</span>
        <h2 class="section-title">精选</h2>
      </div>
      <div class="grid">
        <ArticleCard v-for="a in featured" :key="a.id" :article="a" />
      </div>
    </section>

    <!-- 最新发布 -->
    <section class="latest container">
      <div class="section-head">
        <span class="kicker">Latest</span>
        <h2 class="section-title">最新发布</h2>
      </div>
      <div class="grid">
        <ArticleCard v-for="a in latest" :key="a.id" :article="a" />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import ArticleCard from '../../components/ArticleCard.vue'
import { publicApi } from '../../api'
import type { Article, Category } from '../../types'

const sections = ref<Array<{ id: number; slug: string; name: string; name_en: string; sort_order: number; path: string; count: number; unit: string }>>([])
const featured = ref<Article[]>([])
const latest = ref<Article[]>([])

onMounted(async () => {
  try {
    const [cats, casesRes, feat, latestRes] = await Promise.all([
      publicApi.getCategories(),
      publicApi.getCases({ page: 1, pageSize: 1 }),
      publicApi.getFeatured(),
      publicApi.getArticles({ page: 1, pageSize: 6 })
    ])
    sections.value = [
      ...cats.filter((category: Category) => category.slug !== 'method').map((category: Category) => ({
        id: category.id, slug: category.slug, name: category.name, name_en: category.name_en,
        sort_order: category.sort_order, path: `/section/${category.slug}`,
        count: category.article_count, unit: '篇文章'
      })),
      { id: 0, slug: 'cases', name: '教学案例库', name_en: 'Teaching Case Library', sort_order: 2, path: '/cases', count: casesRes.pagination.total, unit: '个案例' }
    ].sort((a, b) => a.sort_order - b.sort_order)
    featured.value = feat
    latest.value = latestRes.list
  } catch (e) {
    console.error('首页加载失败:', e)
  }
})
</script>

<style scoped>
.hero {
  padding: 120px 0 96px;
  text-align: center;
  border-bottom: 1px solid var(--c-line);
}

.hero-kicker {
  margin-bottom: 24px;
}

.hero-title {
  font-size: 64px;
  font-weight: 600;
  letter-spacing: 0.18em;
  line-height: 1.1;
}

.hero-sub {
  margin-top: 16px;
  font-size: 15px;
  letter-spacing: 0.34em;
  text-transform: uppercase;
}

.hero-desc {
  margin: 32px auto 0;
  max-width: 560px;
  font-size: 15px;
  color: var(--c-muted);
  line-height: 1.9;
}

.sections {
  margin-top: var(--section-gap);
}

.section-head {
  margin-bottom: 40px;
}

.section-title {
  margin-top: 10px;
  font-size: 28px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.section-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  background: var(--c-line);
  border: 1px solid var(--c-line);
}

.section-card {
  background: #fff;
  padding: 40px 32px;
  display: flex;
  align-items: flex-start;
  gap: 20px;
  position: relative;
  transition: background 0.3s ease;
}

.section-card:hover {
  background: var(--c-bg-soft);
}

.section-index {
  font-family: var(--font-en);
  font-size: 13px;
  color: var(--c-accent);
  letter-spacing: 0.08em;
  padding-top: 4px;
}

.section-info h3 {
  font-size: 19px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.section-info .en-sub {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.5;
}

.section-count {
  display: inline-block;
  margin-top: 16px;
  font-size: 12px;
  color: var(--c-muted);
}

.section-arrow {
  margin-left: auto;
  font-size: 20px;
  color: var(--c-muted);
  transition: transform 0.3s ease, color 0.3s ease;
}

.section-card:hover .section-arrow {
  transform: translateX(4px);
  color: var(--c-ink);
}

.featured,
.latest {
  margin-top: var(--section-gap);
}

.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 40px 28px;
}

@media (max-width: 900px) {
  .grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .section-grid {
    grid-template-columns: 1fr;
  }

  .hero-title {
    font-size: 46px;
  }
}

@media (max-width: 600px) {
  .grid {
    grid-template-columns: 1fr;
  }

  .hero {
    padding: 80px 0 64px;
  }

  .hero-title {
    font-size: 38px;
  }
}
</style>
