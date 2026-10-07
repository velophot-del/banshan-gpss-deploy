<template>
  <div class="article-edit">
    <el-card shadow="never">
      <div class="edit-header">
        <h2>{{ isEdit ? '编辑文章' : '新建文章' }}</h2>
        <el-button text @click="goBack">← 返回列表</el-button>
      </div>

      <el-form label-width="90px" class="edit-form">
        <el-form-item label="板块" required>
          <el-select v-model="form.category_id" placeholder="选择板块" style="width: 260px">
            <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>

        <el-form-item label="中文标题" required>
          <el-input v-model="form.title" placeholder="例如：形态构成的基础表现方法" maxlength="200" show-word-limit />
        </el-form-item>

        <el-form-item label="英文副标题">
          <el-input v-model="form.title_en" placeholder="English subtitle（可选）" maxlength="200" />
        </el-form-item>

        <el-form-item label="摘要">
          <el-input v-model="form.summary" type="textarea" :rows="2" placeholder="列表卡片与 SEO 使用的摘要（可选）" maxlength="500" show-word-limit />
        </el-form-item>

        <el-form-item label="封面图">
          <div class="cover-uploader">
            <div v-if="form.cover_url" class="cover-preview">
              <img :src="form.cover_url" alt="封面" />
              <el-button size="small" text type="danger" @click="form.cover_url = ''">移除</el-button>
            </div>
            <label class="cover-picker">
              <input type="file" accept="image/*" hidden @change="onCoverChange" />
              <span>{{ form.cover_url ? '更换图片' : '上传封面' }}</span>
            </label>
          </div>
        </el-form-item>

        <el-form-item label="正文">
          <MdEditor
            v-model="form.content"
            :on-upload-img="handleUploadImg"
            :toolbars-exclude="['github', 'save']"
            style="height: 460px"
            placeholder="在此撰写正文（Markdown）"
          />
        </el-form-item>

        <el-form-item label="标签">
          <el-input v-model="form.tags" placeholder="用逗号分隔，例如：形态构成,教学案例" />
        </el-form-item>

        <el-form-item label="署名">
          <el-input v-model="form.author" placeholder="默认：半山学堂" style="width: 260px" />
        </el-form-item>

        <el-form-item label="首页精选">
          <el-switch v-model="form.is_featured" />
        </el-form-item>

        <el-form-item>
          <div class="actions">
            <el-button @click="save('draft')">保存草稿</el-button>
            <el-button type="primary" @click="save('published')">发布</el-button>
          </div>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { MdEditor } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import { adminApi, publicApi, uploadImage } from '../../api'
import type { Category } from '../../types'

const route = useRoute()
const router = useRouter()

const categories = ref<Category[]>([])
const isEdit = computed(() => !!route.params.id)
const articleId = computed(() => Number(route.params.id))

const form = reactive({
  category_id: undefined as number | undefined,
  title: '',
  title_en: '',
  summary: '',
  cover_url: '',
  content: '',
  tags: '',
  author: '半山学堂',
  is_featured: false
})

async function handleUploadImg(files: File[], callback: (urls: string[]) => void) {
  const urls: string[] = []
  for (const file of files) {
    try {
      const res = await uploadImage(file)
      urls.push(res.url)
    } catch (e) {
      ElMessage.error(`图片 ${file.name} 上传失败`)
    }
  }
  callback(urls)
}

async function onCoverChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const res = await uploadImage(file)
    form.cover_url = res.url
    ElMessage.success('封面上传成功')
  } catch (err) {
    ElMessage.error('封面上传失败')
  } finally {
    input.value = ''
  }
}

function goBack() {
  router.push('/admin/articles')
}

async function save(status: 'draft' | 'published') {
  if (!form.category_id) {
    ElMessage.warning('请选择板块')
    return
  }
  if (!form.title.trim()) {
    ElMessage.warning('请填写中文标题')
    return
  }

  const payload = {
    category_id: form.category_id,
    title: form.title.trim(),
    title_en: form.title_en.trim(),
    summary: form.summary.trim(),
    cover_url: form.cover_url,
    content: form.content,
    tags: form.tags.trim(),
    author: form.author.trim() || '半山学堂',
    is_featured: form.is_featured ? 1 : 0,
    status
  }

  try {
    if (isEdit.value) {
      await adminApi.updateArticle(articleId.value, payload)
    } else {
      await adminApi.createArticle(payload)
    }
    ElMessage.success(status === 'published' ? '已发布' : '已保存草稿')
    router.push('/admin/articles')
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '保存失败')
  }
}

onMounted(async () => {
  try {
    categories.value = await publicApi.getCategories()
  } catch (e) {
    console.error('加载板块失败:', e)
  }

  if (isEdit.value) {
    try {
      const a = await adminApi.getArticle(articleId.value)
      form.category_id = a.category_id
      form.title = a.title
      form.title_en = a.title_en
      form.summary = a.summary
      form.cover_url = a.cover_url
      form.content = a.content || ''
      form.tags = a.tags
      form.author = a.author
      form.is_featured = !!a.is_featured
    } catch (e: any) {
      ElMessage.error('加载文章失败')
    }
  }
})
</script>

<style scoped>
.edit-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e4e7ed;
}

.edit-header h2 {
  font-size: 18px;
  font-weight: 600;
}

.edit-form {
  max-width: 860px;
}

.cover-uploader {
  display: flex;
  align-items: center;
  gap: 16px;
}

.cover-preview {
  position: relative;
  width: 180px;
}

.cover-preview img {
  width: 180px;
  height: 120px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid #e4e7ed;
}

.cover-picker {
  cursor: pointer;
  color: var(--el-color-primary);
  font-size: 13px;
}

.cover-picker:hover {
  text-decoration: underline;
}

.actions {
  display: flex;
  gap: 12px;
}
</style>
