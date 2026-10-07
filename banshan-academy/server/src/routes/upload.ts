import { Router } from 'express'
import multer from 'multer'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { resolveUploadDir } from '../config/runtime.js'
import { success, error } from '../utils/response.js'
import { authMiddleware, requireRole } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware, requireRole('admin'))

const uploadDir = resolveUploadDir()
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    const name = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`
    cb(null, name)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(jpe?g|png|gif|webp|svg|bmp)$/i.test(file.originalname)
    if (allowed) cb(null, true)
    else cb(new Error('仅支持图片文件'))
  }
})

// 图片上传（后台）
router.post('/image', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return error(res, '未接收到文件')
    const url = `/uploads/${req.file.filename}`
    return success(res, { url, filename: req.file.filename }, '上传成功')
  } catch (e: any) {
    console.error('上传失败:', e)
    return error(res, '上传失败', 500)
  }
})

export default router
