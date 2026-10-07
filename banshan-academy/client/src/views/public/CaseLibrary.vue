<template>
  <main class="container library">
    <header class="intro">
      <p class="eyebrow">TEACHING CASE LIBRARY</p>
      <h1>教学案例库</h1>
      <p>面向设计教育的课程案例、学生作品与教学方法档案。可按课程、年级、课题、方法与议题检索；公开内容仅展示已完成授权审核的材料。</p>
    </header>

    <section v-if="featured.length" class="block">
      <div class="section-title"><div><p class="eyebrow">EDITOR'S PICKS</p><h2>重点案例</h2></div><span>编辑精选 · 不代表全部案例</span></div>
      <div class="cards featured"><router-link v-for="item in featured" :key="item.case_code" :to="`/cases/${item.case_code}`" class="case-card featured-card"><small>{{ item.course_name }} · {{ item.grade_year }}</small><h3>{{ item.title }}</h3><p>{{ item.introduction }}</p><span class="arrow">查看案例 →</span></router-link></div>
    </section>

    <section class="block browse">
      <div class="section-title"><div><p class="eyebrow">BROWSE & SEARCH</p><h2>发现案例</h2></div><span>{{ total }} 个公开案例</span></div>
      <div class="filters">
        <input v-model="filters.keyword" placeholder="搜索标题、课题或教学启示" @keyup.enter="search">
        <select v-model="filters.course" @change="search"><option value="">全部课程</option><option v-for="v in options.course || []" :key="v">{{ v }}</option></select>
        <select v-model="filters.year" @change="search"><option value="">全部年级</option><option v-for="v in options.year || []" :key="v">{{ v }}</option></select>
        <select v-model="filters.topic" @change="search"><option value="">全部课题</option><option v-for="v in options.topic || []" :key="v">{{ v }}</option></select>
      </div>
      <div class="tag-groups"><div v-for="group in tagGroups" :key="group.key" class="tag-row"><b>{{ group.label }}</b><button v-for="tag in options[group.key] || []" :key="tag" :class="{ selected: filters[group.filter] === tag }" @click="filters[group.filter] = filters[group.filter] === tag ? '' : tag; search()">{{ tag }}</button></div></div>
      <div v-if="loading" class="empty">正在加载案例…</div>
      <div v-else-if="!items.length" class="empty">暂时没有符合条件的公开案例。</div>
      <div v-else class="cards"> <router-link v-for="item in items" :key="item.case_code" :to="`/cases/${item.case_code}`" class="case-card"><small>{{ item.course_name }} · {{ item.grade_year }} <span v-if="item.topic_name">/ {{ item.topic_name }}</span></small><h3>{{ item.title }}</h3><p>{{ item.introduction }}</p><div class="card-foot"><span>{{ item.updated_at ? new Date(item.updated_at).toLocaleDateString('zh-CN') : '' }} 更新</span><span>查看 →</span></div></router-link></div>
      <div v-if="hasMore" class="more"><button @click="loadMore" :disabled="loading">加载更多</button></div>
    </section>

    <section v-if="latest.length" class="block latest"><div class="section-title"><div><p class="eyebrow">LATEST UPDATES</p><h2>最新更新</h2></div><span>按更新时间排列</span></div><ul><li v-for="item in latest" :key="item.case_code"><router-link :to="`/cases/${item.case_code}`">{{ item.title }}</router-link><span>{{ item.updated_at ? new Date(item.updated_at).toLocaleDateString('zh-CN') : '' }}</span></li></ul></section>
    <section class="usage"><h2>使用说明</h2><p>学生作品仅在作者及相关权利人授权后展示。教学指导手册面向经授权的教师账号开放。引用案例时请注明案例编号、作者与来源；转载作品、图像或完整教学材料前，请另行确认授权范围。</p><router-link to="/teacher/login">教师登录查看教学资源 →</router-link><small>项目建设背景：山东省研究生教育质量提升计划项目 223 SDYAL2023199。</small></section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { publicApi } from '../../api'
const options = ref<Record<string, string[]>>({})
const featured = ref<any[]>([]), latest = ref<any[]>([]), items = ref<any[]>([])
const total = ref(0), page = ref(1), loading = ref(false), hasMore = ref(false)
const filters = reactive<Record<string, string>>({ keyword: '', course: '', year: '', topic: '', method: '', theme: '' })
const tagGroups = [{ key: 'method', label: '方法', filter: 'method' }, { key: 'theme', label: '议题', filter: 'theme' }]
const params = computed(() => ({ ...filters, page: page.value, pageSize: 9 }))
async function load(reset = false) {
  if (loading.value) return
  loading.value = true
  try {
    if (reset) page.value = 1
    const result = await publicApi.getCases(params.value)
    items.value = reset ? result.list : [...items.value, ...result.list]
    total.value = result.pagination.total
    hasMore.value = result.pagination.page < result.pagination.totalPages
  } finally { loading.value = false }
}
function search() { load(true) }
function loadMore() { page.value += 1; load() }
onMounted(async () => {
  try { [options.value, featured.value, latest.value] = await Promise.all([publicApi.getCaseOptions(), publicApi.getFeaturedCases().then(r => r.list), publicApi.getLatestCases().then(r => r.list)]) } catch (e) { console.error(e) }
  await load(true)
})
</script>

<style scoped>
.library{padding-bottom:88px}.intro{padding:90px 0 54px;border-bottom:1px solid var(--c-line)}.eyebrow{font-size:11px;letter-spacing:.16em;color:var(--c-muted)}h1{font-size:44px;font-weight:600;letter-spacing:.06em;margin:14px 0 20px}.intro>p:last-child{max-width:720px;color:var(--c-muted);line-height:1.9}.block{padding-top:62px}.section-title{display:flex;align-items:end;justify-content:space-between;margin-bottom:24px}.section-title h2,.usage h2{font-size:25px;font-weight:600;margin-top:8px}.section-title>span{font-size:12px;color:var(--c-muted)}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.case-card{display:flex;flex-direction:column;min-height:200px;padding:24px;border:1px solid var(--c-line);color:inherit;transition:border-color .2s,transform .2s}.case-card:hover{border-color:var(--c-ink);transform:translateY(-2px)}.case-card small{font-size:12px;color:var(--c-muted)}.case-card h3{font-size:19px;line-height:1.55;margin:15px 0 10px}.case-card p{color:var(--c-muted);font-size:13px;line-height:1.8;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.card-foot{display:flex;justify-content:space-between;margin-top:auto;padding-top:18px;color:var(--c-muted);font-size:11px}.featured-card{min-height:224px;background:var(--c-bg-soft)}.arrow{margin-top:auto;padding-top:16px;font-size:12px}.filters{display:grid;grid-template-columns:2fr repeat(3,1fr);gap:10px}.filters input,.filters select{height:42px;padding:0 12px;border:1px solid var(--c-line);background:#fff;color:var(--c-ink);font:inherit;font-size:13px}.tag-groups{padding:16px 0 24px}.tag-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:8px 0}.tag-row b{font-size:12px;color:var(--c-muted);width:44px}.tag-row button{border:1px solid var(--c-line);background:white;padding:5px 10px;font-size:12px;cursor:pointer}.tag-row button.selected{background:var(--c-ink);color:#fff}.empty{padding:44px;text-align:center;color:var(--c-muted)}.more{text-align:center;padding-top:28px}.more button{border:1px solid var(--c-line);background:white;padding:11px 25px;cursor:pointer}.latest ul{list-style:none;padding:0;border-top:1px solid var(--c-line)}.latest li{display:flex;justify-content:space-between;padding:14px 0;border-bottom:1px solid var(--c-line);font-size:14px}.latest li span{font-size:12px;color:var(--c-muted)}.usage{margin-top:70px;padding:28px;background:var(--c-bg-soft)}.usage p{max-width:800px;color:var(--c-muted);font-size:13px;line-height:1.9}.usage>a{display:block;margin:16px 0;font-size:13px}.usage small{display:block;color:var(--c-muted);font-size:11px}@media(max-width:800px){.cards{grid-template-columns:repeat(2,1fr)}.filters{grid-template-columns:1fr 1fr}}@media(max-width:540px){.cards{grid-template-columns:1fr}.intro{padding-top:58px}h1{font-size:34px}.section-title{align-items:start;gap:10px;flex-direction:column}}
</style>
