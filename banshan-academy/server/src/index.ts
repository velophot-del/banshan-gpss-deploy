import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { resolveUploadDir } from './config/runtime.js'

import authRoutes from './routes/auth.js'
import categoriesRoutes from './routes/categories.js'
import articlesRoutes from './routes/articles.js'
import adminArticlesRoutes from './routes/adminArticles.js'
import uploadRoutes from './routes/upload.js'
import { teacherRouter } from './routes/auth.js'
import casesRoutes from './routes/cases.js'
import teacherCasesRoutes from './routes/teacherCases.js'
import adminCasesRoutes from './routes/adminCases.js'

const app = express()
const PORT = Number(process.env.PORT) || 3012
const HOST = process.env.HOST || '127.0.0.1'
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://127.0.0.1:5174'

app.use(cors({
  origin: [FRONTEND_URL, 'http://localhost:5174', 'http://127.0.0.1:5174'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// 静态上传目录
const uploadDir = resolveUploadDir()
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })
app.use('/uploads', express.static(uploadDir))

// ===== 生产环境：托管前端构建产物 =====
const isProduction = process.env.NODE_ENV === 'production'
if (isProduction) {
  const frontendDist = path.join(process.cwd(), '..', 'client', 'dist')
  app.use(express.static(frontendDist))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next()
    res.sendFile(path.join(frontendDist, 'index.html'))
  })
}

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({ code: 200, message: 'OK', data: { service: 'Banshan Academy API', version: '1.0.0', timestamp: new Date().toISOString() } })
})

// 站点配置（公开：站名、进入毕设系统链接）
app.get('/api/settings', (_req, res) => {
  res.json({
    code: 200,
    message: 'success',
    data: {
      site_name: '半山学堂',
      site_name_en: 'Banshan Academy',
      gpss_url: process.env.GPSS_URL || '/gpss/'
    }
  })
})

// 路由注册
app.use('/api/admin/auth', authRoutes)
app.use('/api/teacher/auth', teacherRouter)
app.use('/api/categories', categoriesRoutes)
app.use('/api/articles', articlesRoutes)
app.use('/api/admin/articles', adminArticlesRoutes)
app.use('/api/admin/upload', uploadRoutes)
app.use('/api/cases', casesRoutes)
app.use('/api/teacher/cases', teacherCasesRoutes)
app.use('/api/admin/cases', adminCasesRoutes)

// 404
app.use((_req, res) => {
  res.status(404).json({ code: 404, message: '接口不存在' })
})

// 全局错误处理
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('未捕获错误:', err.stack)
  res.status(500).json({ code: 500, message: err.message || '服务器内部错误' })
})

app.listen(PORT, HOST, () => {
  console.log(`
╔════════════════════════════════════════╗
║       半山学堂 · API Server            ║
║                                        ║
║   运行地址: http://${HOST}:${PORT}        ║
║   API前缀:  /api                       ║
║   环境:     ${process.env.NODE_ENV || 'development'}                    ║
╚════════════════════════════════════════╝
  `)
})

export default app
