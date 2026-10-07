import axios from 'axios'
import { ElMessage } from 'element-plus'
import type { Article, Category, Paginated, SiteSettings } from '../types'

const request = axios.create({
  baseURL: '/api',
  timeout: 20000
})

request.interceptors.request.use((config) => {
  const token = localStorage.getItem('banshan_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

request.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const message = error.response?.data?.message || '请求失败，请稍后重试'
    if (status === 401) {
      localStorage.removeItem('banshan_token')
      localStorage.removeItem('banshan_role')
      if (window.location.pathname.startsWith('/admin') || window.location.pathname.startsWith('/teacher')) {
        ElMessage.error('登录已过期，请重新登录')
        window.location.href = window.location.pathname.startsWith('/teacher') ? '/teacher/login' : '/admin/login'
      }
    }
    return Promise.reject(error)
  }
)

async function unwrap<T>(p: Promise<any>): Promise<T> {
  const res = await p
  return res.data.data
}

// 公开接口
export const publicApi = {
  getSettings: () => unwrap<SiteSettings>(request.get('/settings')),
  getCategories: () => unwrap<Category[]>(request.get('/categories')),
  getArticles: (params: { category?: string; page?: number; pageSize?: number }) =>
    unwrap<Paginated<Article>>(request.get('/articles', { params })),
  getArticle: (id: number) => unwrap<Article>(request.get(`/articles/${id}`)),
  getFeatured: () => unwrap<Article[]>(request.get('/articles/featured')),
  getCaseOptions: () => unwrap<any>(request.get('/cases/options')),
  getCases: (params: Record<string, string | number | undefined> = {}) => unwrap<Paginated<any>>(request.get('/cases', { params })),
  getFeaturedCases: () => unwrap<Paginated<any>>(request.get('/cases/featured')),
  getLatestCases: () => unwrap<Paginated<any>>(request.get('/cases/latest')),
  getCase: (caseCode: string) => unwrap<any>(request.get(`/cases/${encodeURIComponent(caseCode)}`))
}

export const teacherApi = {
  login: (username: string, password: string) => unwrap<{ token: string; user: any }>(request.post('/teacher/auth/login', { username, password })),
  me: () => unwrap<any>(request.get('/teacher/auth/me')),
  getGuide: (caseCode: string) => unwrap<any>(request.get(`/teacher/cases/${encodeURIComponent(caseCode)}/guide`)),
  getCases: () => unwrap<any[]>(request.get('/teacher/cases')),
  getCase: (caseCode: string) => unwrap<any>(request.get(`/teacher/cases/${encodeURIComponent(caseCode)}`)),
  recordUse: (data: Record<string, unknown>) => unwrap<any>(request.post('/teacher/cases/usage', data))
}

export const caseAdminApi = {
  list: (params: Record<string, string | number | undefined> = {}) => unwrap<Paginated<any>>(request.get('/admin/cases', { params })),
  get: (code: string) => unwrap<any>(request.get(`/admin/cases/${encodeURIComponent(code)}`)),
  create: (data: Record<string, unknown>) => unwrap<any>(request.post('/admin/cases', data)),
  importDrafts: (cases: Record<string, unknown>[]) => unwrap<{ cases: { case_code: string; title: string }[] }>(request.post('/admin/cases/import', { cases })),
  saveDraft: (code: string, data: Record<string, unknown>) => unwrap<any>(request.put(`/admin/cases/${encodeURIComponent(code)}/draft`, data)),
  submitReview: (code: string) => unwrap<any>(request.post(`/admin/cases/${encodeURIComponent(code)}/submit-review`)),
  review: (code: string, data: Record<string, unknown>) => unwrap<any>(request.post(`/admin/cases/${encodeURIComponent(code)}/reviews`, data)),
  publish: (code: string, is_featured: boolean) => unwrap<any>(request.post(`/admin/cases/${encodeURIComponent(code)}/publish`, { is_featured })),
  uploadAsset: (code: string, file: File, values: Record<string, unknown>) => {
    const form = new FormData()
    form.append('file', file)
    Object.entries(values).forEach(([key, value]) => form.append(key, String(value ?? '')))
    return unwrap<any>(request.post(`/admin/cases/${encodeURIComponent(code)}/assets`, form, { headers: { 'Content-Type': 'multipart/form-data' } }))
  },
  createTeacher: (username: string, password: string) => unwrap<any>(request.post('/admin/auth/teachers', { username, password })),
  teachers: () => unwrap<Paginated<any>>(request.get('/admin/auth/teachers')),
  setTeacherActive: (id: number, is_active: boolean) => unwrap<any>(request.patch(`/admin/auth/teachers/${id}/active`, { is_active })),
  usageRecords: (params: Record<string, number> = {}) => unwrap<Paginated<any>>(request.get('/admin/cases/usage-records', { params }))
}

// 后台接口
export const adminApi = {
  login: (username: string, password: string) =>
    unwrap<{ token: string; user: any }>(request.post('/admin/auth/login', { username, password })),
  me: () => unwrap<any>(request.get('/admin/auth/me')),
  getArticles: (params: { category?: string; status?: string; keyword?: string; page?: number; pageSize?: number }) =>
    unwrap<Paginated<Article>>(request.get('/admin/articles', { params })),
  getArticle: (id: number) => unwrap<Article>(request.get(`/admin/articles/${id}`)),
  createArticle: (data: Partial<Article>) => unwrap<any>(request.post('/admin/articles', data)),
  updateArticle: (id: number, data: Partial<Article>) => unwrap<any>(request.put(`/admin/articles/${id}`, data)),
  deleteArticle: (id: number) => unwrap<any>(request.delete(`/admin/articles/${id}`))
}

export function uploadImage(file: File): Promise<{ url: string }> {
  const form = new FormData()
  form.append('file', file)
  return unwrap<{ url: string }>(
    request.post('/admin/upload/image', form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  )
}

export default request
