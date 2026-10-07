<template>
  <main class="container detail" v-if="item">
    <router-link to="/cases" class="back">← 返回案例库</router-link>
    <header class="hero"><p class="eyebrow">{{ item.case_code }} · {{ item.case_type }}</p><h1>{{ item.title }}</h1><div class="meta"><span>{{ item.course_name }}</span><span>{{ item.grade_year }}</span><span>{{ item.topic_name }}</span><span>{{ item.project_time }}</span><span v-for="tag in [...(item.tags?.method || []), ...(item.tags?.theme || [])]" :key="tag" class="tag">{{ tag }}</span></div><p class="updated">更新于 {{ new Date(item.updated_at).toLocaleDateString('zh-CN') }}</p></header>
    <article class="content">
      <section><h2>案例导读</h2><p>{{ item.introduction }}</p></section>
      <section><h2>课题任务与问题</h2><h3>课题任务</h3><p>{{ item.assignment }}</p><h3>核心问题</h3><p>{{ item.problem }}</p></section>
      <section><h2>作业全览</h2><p v-if="!item.works?.length" class="muted">本案例暂无公开作品条目。</p><details v-for="(work, index) in item.works" :key="work.id" class="work"><summary><b>{{ String(index + 1).padStart(2, '0') }} · {{ work.title }}</b><span>{{ work.medium }}</span></summary><p>{{ work.description }}</p><blockquote v-if="work.author_statement">作者自述：{{ work.author_statement }}</blockquote><div v-if="work.assets?.length" class="assets"><a v-for="asset in work.assets" :key="asset.id" :href="`/api/cases/assets/${asset.id}`" target="_blank" rel="noreferrer">查看作品材料：{{ asset.original_name }}</a></div></details><div v-if="item.assets?.length" class="assets"><a v-for="asset in item.assets" :key="asset.id" :href="`/api/cases/assets/${asset.id}`" target="_blank" rel="noreferrer">查看附件：{{ asset.original_name }}</a></div></section>
      <section><h2>案例正文</h2><MarkdownContent :content="item.case_body || ''" /></section>
      <section><h2>综合分析与教学启示</h2><p>{{ item.teaching_takeaways }}</p></section>
      <section v-if="guide" class="teacher"><h2>教师区</h2><p>教学指导手册已开放给授权教师账号。</p><div v-for="(value, key) in guide" :key="key" class="guide-row"><h3>{{ guideLabels[String(key)] || key }}</h3><p>{{ Array.isArray(value) ? value.join('；') : value }}</p></div><div v-if="item.attachments?.length" class="assets"><a v-for="asset in item.attachments" :key="asset.id" :href="`/api/teacher/cases/${item.case_code}/assets/${asset.id}`">下载教师材料：{{ asset.original_name }}</a></div><router-link to="/teacher/cases">进入教师案例区 →</router-link><details class="usage"><summary>登记课堂使用</summary><div class="usage-form"><input v-model="useForm.used_at" type="date"><input v-model="useForm.class_name" placeholder="班级"><input v-model="useForm.teaching_form" placeholder="教学形式"><input v-model.number="useForm.teaching_hours" type="number" min="0" step="0.5" placeholder="学时"><input v-model.number="useForm.student_count" type="number" min="0" placeholder="学生人数"><textarea v-model="useForm.feedback_summary" placeholder="课堂反馈摘要（可选）"/><button @click="recordUsage">提交使用记录</button></div></details><p v-if="useMessage" class="use-message">{{ useMessage }}</p></section>
      <section v-else class="teacher"><h2>教师区</h2><p>教学目标、课堂流程、讨论活动、评价建议及指导手册面向授权教师开放。</p><router-link to="/teacher/login">教师登录查看教学资源 →</router-link></section>
      <section class="rights"><h2>来源、署名与引用</h2><p v-if="item.metadata?.publicAuthors?.length">作者：{{ item.metadata.publicAuthors.join('、') }}</p><p>{{ item.metadata?.citation || `建议引用：半山学堂教学案例库，${item.case_code}《${item.title}》，更新于 ${new Date(item.updated_at).toLocaleDateString('zh-CN')}。` }}</p><p v-if="item.metadata?.chineseKeywords?.length">关键词：{{ item.metadata.chineseKeywords.join('；') }}</p><p>访问范围：{{ permissionLabels[item.permission_status] || '待核实' }}。引用、转载或下载使用前，请核对各项材料所列来源与授权说明。</p></section>
      <section v-if="item.related_cases?.length"><h2>相关案例</h2><div class="related"><router-link v-for="related in item.related_cases" :key="related.case_code" :to="`/cases/${related.case_code}`">{{ related.title }} <small>{{ related.course_name }} · {{ related.topic_name }}</small></router-link></div></section>
    </article>
  </main>
  <main v-else class="container empty">{{ loading ? '正在加载案例…' : '未找到该案例，或案例尚未公开。' }} <router-link to="/cases">返回案例库</router-link></main>
</template>
<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { publicApi, teacherApi } from '../../api'
import MarkdownContent from '../../components/MarkdownContent.vue'
const route = useRoute(), item = ref<any>(null), guide = ref<any>(null), loading = ref(true), useMessage = ref('')
const useForm = reactive({ used_at: new Date().toISOString().slice(0,10), class_name: '', teaching_form: '', teaching_hours: 0, student_count: 0, feedback_summary: '' })
const guideLabels: Record<string, string> = { objectives: '教学目标与准备', preparation: '课前准备', workflow: '教学流程', discussion: '讨论问题与课堂活动', assessment: '评价建议', downloadUrl: '教学指导手册' }
const permissionLabels: Record<string, string> = { public: '公开浏览', campus: '校内教师', classroom: '课堂授权教师', pending: '未开放' }
async function loadCase() {
  item.value = null; guide.value = null; loading.value = true
  try {
    try { item.value = await publicApi.getCase(String(route.params.caseCode)) }
    catch { if (localStorage.getItem('banshan_token')) item.value = await teacherApi.getCase(String(route.params.caseCode)); else throw new Error('not public') }
    if (localStorage.getItem('banshan_token')) {
      try {
        const result = await teacherApi.getGuide(String(route.params.caseCode)); guide.value = result.teacher_guide
        const teacherVersion = await teacherApi.getCase(String(route.params.caseCode))
        item.value.attachments = teacherVersion.attachments
      } catch { /* not a teacher session or no guide access */ }
    }
  } catch (error) { console.error(error) } finally { loading.value = false }
}
async function recordUsage() {
  if (!item.value) return
  try { await teacherApi.recordUse({ ...useForm, case_code: item.value.case_code }); useMessage.value = '课堂使用记录已保存。' }
  catch (error: any) { useMessage.value = error.response?.data?.message || '保存失败，请确认教师登录状态。' }
}
onMounted(loadCase)
watch(() => route.params.caseCode, loadCase)
</script>
<style scoped>
.detail{padding:48px 0 90px}.back{font-size:13px;color:var(--c-muted)}.hero{padding:42px 0 40px;border-bottom:1px solid var(--c-line)}.eyebrow{color:var(--c-muted);font-size:12px;letter-spacing:.12em}.hero h1{font-size:38px;line-height:1.4;font-weight:600;margin:15px 0 22px}.meta{display:flex;flex-wrap:wrap;gap:9px 18px;color:var(--c-muted);font-size:13px}.tag{border:1px solid var(--c-line);padding:3px 8px}.updated{font-size:11px;color:var(--c-muted);margin-top:20px}.content{max-width:820px;margin:0 auto}.content section{padding:36px 0;border-bottom:1px solid var(--c-line);line-height:1.9}.content h2{font-size:22px;margin:0 0 18px}.content h3{font-size:15px;margin:22px 0 8px}.content p{white-space:pre-wrap;color:var(--c-ink-soft);font-size:14px}.work{border-top:1px solid var(--c-line);padding:14px 0}.work:last-child{border-bottom:1px solid var(--c-line)}summary{cursor:pointer;display:flex;justify-content:space-between;gap:12px}summary span,.muted{font-size:12px;color:var(--c-muted)}blockquote{margin:12px 0;padding-left:14px;border-left:2px solid var(--c-line);color:var(--c-muted);font-size:13px}.assets{display:flex;flex-direction:column;gap:8px;margin:15px 0}.assets a,.teacher a{font-size:13px;text-decoration:underline}.teacher{background:var(--c-bg-soft);padding:26px!important;margin-top:24px}.guide-row{margin:14px 0}.guide-row h3{margin-bottom:3px}.rights{color:var(--c-muted)}.related{display:grid;grid-template-columns:1fr 1fr;gap:12px}.related a{padding:16px;border:1px solid var(--c-line)}.related small{display:block;color:var(--c-muted);margin-top:8px}.empty{padding:120px 0;text-align:center;color:var(--c-muted)}.empty a{display:block;margin-top:15px}@media(max-width:600px){.hero h1{font-size:30px}.detail{padding-top:30px}.related{grid-template-columns:1fr}}
</style>
