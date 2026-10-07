<template>
  <div class="article-list">
    <el-card shadow="never">
      <div class="toolbar">
        <div class="filters">
          <el-select v-model="filters.category" placeholder="全部板块" clearable style="width: 180px" @change="load(true)">
            <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.slug" />
          </el-select>
          <el-select v-model="filters.status" placeholder="全部状态" clearable style="width: 140px" @change="load(true)">
            <el-option label="已发布" value="published" />
            <el-option label="草稿" value="draft" />
          </el-select>
          <el-input
            v-model="filters.keyword"
            placeholder="搜索标题"
            clearable
            style="width: 220px"
            @keyup.enter="load(true)"
            @clear="load(true)"
          />
        </div>
        <el-button type="primary" @click="goNew">+ 新建文章</el-button>
      </div>

      <el-table :data="articles" v-loading="loading" stripe>
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="title" label="标题" min-width="220">
          <template #default="{ row }">
            <div class="cell-title">{{ row.title }}</div>
            <div class="cell-sub">{{ row.title_en }}</div>
          </template>
        </el-table-column>
        <el-table-column label="板块" width="150">
          <template #default="{ row }">{{ row.category_name }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 'published' ? 'success' : 'info'" size="small">
              {{ row.status === 'published' ? '已发布' : '草稿' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="精选" width="70">
          <template #default="{ row }">
            <span v-if="row.is_featured" class="featured-star">★</span>
          </template>
        </el-table-column>
        <el-table-column label="发布时间" width="120">
          <template #default="{ row }">{{ formatDate(row.published_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="goEdit(row.id)">编辑</el-button>
            <el-button link :type="row.status === 'published' ? 'warning' : 'success'" @click="toggleStatus(row)">
              {{ row.status === 'published' ? '下架' : '发布' }}
            </el-button>
            <el-button link type="danger" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          background
          layout="prev, pager, next, total"
          :total="total"
          :page-size="pageSize"
          :current-page="page"
          @current-change="onPageChange"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { adminApi, publicApi } from '../../api'
import type { Article, Category } from '../../types'
import dayjs from 'dayjs'

const router = useRouter()
const categories = ref<Category[]>([])
const articles = ref<Article[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 10
const loading = ref(false)

const filters = reactive({
  category: '',
  status: '',
  keyword: ''
})

function formatDate(d: string | null) {
  if (!d) return '—'
  return dayjs(d).format('YYYY-MM-DD')
}

async function load(reset = false) {
  if (reset) page.value = 1
  loading.value = true
  try {
    const res = await adminApi.getArticles({
      category: filters.category || undefined,
      status: filters.status || undefined,
      keyword: filters.keyword || undefined,
      page: page.value,
      pageSize
    })
    articles.value = res.list
    total.value = res.pagination.total
  } catch (e) {
    console.error('加载文章列表失败:', e)
  } finally {
    loading.value = false
  }
}

function onPageChange(p: number) {
  page.value = p
  load()
}

function goNew() {
  router.push('/admin/articles/new')
}

function goEdit(id: number) {
  router.push(`/admin/articles/${id}/edit`)
}

async function toggleStatus(row: Article) {
  const target = row.status === 'published' ? 'draft' : 'published'
  try {
    await adminApi.updateArticle(row.id, { status: target })
    ElMessage.success(target === 'published' ? '已发布' : '已下架')
    load()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '操作失败')
  }
}

async function remove(row: Article) {
  try {
    await ElMessageBox.confirm(`确认删除文章「${row.title}」？此操作不可恢复。`, '删除确认', { type: 'warning' })
    await adminApi.deleteArticle(row.id)
    ElMessage.success('已删除')
    load()
  } catch (e: any) {
    if (e === 'cancel' || e === 'close') return
    ElMessage.error('删除失败')
  }
}

onMounted(async () => {
  try {
    categories.value = await publicApi.getCategories()
  } catch (e) {
    console.error('加载板块失败:', e)
  }
  load()
})
</script>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  gap: 12px;
  flex-wrap: wrap;
}

.filters {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.cell-title {
  font-size: 14px;
  color: #303133;
}

.cell-sub {
  font-size: 12px;
  color: #909399;
  font-family: var(--font-en);
  margin-top: 2px;
}

.featured-star {
  color: #f0b400;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>
