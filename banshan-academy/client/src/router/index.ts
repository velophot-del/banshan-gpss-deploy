import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('../views/public/PublicLayout.vue'),
    children: [
      { path: '', name: 'home', component: () => import('../views/public/Home.vue') },
      { path: 'section/method', redirect: '/cases' },
      { path: 'section/:slug', name: 'section', component: () => import('../views/public/SectionList.vue') },
      { path: 'cases', name: 'caseLibrary', component: () => import('../views/public/CaseLibrary.vue') },
      { path: 'cases/:caseCode', name: 'caseDetail', component: () => import('../views/public/CaseDetail.vue') },
      { path: 'article/:id', name: 'article', component: () => import('../views/public/ArticleDetail.vue') },
      { path: 'about', name: 'about', component: () => import('../views/public/About.vue') }
    ]
  },
  {
    path: '/admin/login',
    name: 'adminLogin',
    component: () => import('../views/admin/AdminLogin.vue'),
    meta: { requiresAuth: false }
  },
  { path: '/teacher/login', name: 'teacherLogin', component: () => import('../views/public/TeacherLogin.vue') },
  { path: '/teacher/cases', name: 'teacherCases', component: () => import('../views/public/TeacherLibrary.vue'), meta: { requiresTeacher: true } },
  {
    path: '/admin',
    component: () => import('../views/admin/AdminLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', redirect: '/admin/articles' },
      { path: 'articles', name: 'adminArticles', component: () => import('../views/admin/ArticleList.vue') },
      { path: 'articles/new', name: 'adminArticleNew', component: () => import('../views/admin/ArticleEdit.vue') },
      { path: 'articles/:id/edit', name: 'adminArticleEdit', component: () => import('../views/admin/ArticleEdit.vue') },
      { path: 'cases', name: 'adminCases', component: () => import('../views/admin/CaseList.vue') },
      { path: 'teachers', name: 'adminTeachers', component: () => import('../views/admin/TeacherAccounts.vue') },
      { path: 'case-usage', name: 'adminCaseUsage', component: () => import('../views/admin/CaseUsage.vue') }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes
})

router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('banshan_token')
  const role = localStorage.getItem('banshan_role')
  if (to.meta.requiresAuth && !token) {
    next('/admin/login')
  } else if (to.meta.requiresAuth && role === 'teacher') {
    next('/teacher/cases')
  } else if (to.path === '/admin/login' && token) {
    next(role === 'teacher' ? '/teacher/cases' : '/admin/articles')
  } else if (to.meta.requiresTeacher && !token) {
    next('/teacher/login')
  } else {
    next()
  }
})

export default router
