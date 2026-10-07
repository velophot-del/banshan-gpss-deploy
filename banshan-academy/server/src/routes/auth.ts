import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { query } from '../config/database.js'
import { success, error, paginated } from '../utils/response.js'
import { generateToken, authMiddleware, requireRole, type AuthRequest } from '../middleware/auth.js'

const router = Router()
const teacherRouter = Router()

async function login(req: any, res: any, expectedRole: 'admin' | 'teacher') {
  try {
    const { username, password } = req.body
    if (!username || !password) {
      return error(res, '请输入用户名和密码')
    }

    const rows = await query<any>('SELECT * FROM admins WHERE username = ?', [username])
    const account = rows[0]
    if (!account || !account.is_active || account.role !== expectedRole || !bcrypt.compareSync(password, account.password_hash)) {
      return error(res, '用户名或密码错误', 401)
    }

    const token = generateToken({ id: account.id, username: account.username, role: account.role })
    return success(res, {
      token,
      user: { id: account.id, username: account.username, role: account.role }
    }, '登录成功')
  } catch (e: any) {
    console.error('登录失败:', e)
    return error(res, '登录失败', 500)
  }
}

router.post('/login', (req, res) => login(req, res, 'admin'))
teacherRouter.post('/login', (req, res) => login(req, res, 'teacher'))

// 当前登录用户
router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const rows = await query<any>('SELECT id, username, role FROM admins WHERE id = ?', [req.user!.id])
    if (!rows[0]) return error(res, '用户不存在', 404)
    return success(res, rows[0])
  } catch (e: any) {
    return error(res, '获取用户信息失败', 500)
  }
})

teacherRouter.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  return success(res, req.user)
})

router.get('/teachers', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { page = '1', pageSize = '20', keyword } = req.query as Record<string, string>
    const currentPage = Math.max(1, parseInt(page, 10) || 1)
    const currentSize = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20))
    const offset = (currentPage - 1) * currentSize
    const params: any[] = []
    const where = keyword ? 'AND username LIKE ?' : ''
    if (keyword) params.push(`%${keyword}%`)
    const total = await query<any>(`SELECT COUNT(*) AS total FROM admins WHERE role = 'teacher' ${where}`, params)
    const rows = await query<any>(
      `SELECT id, username, is_active, created_at FROM admins WHERE role = 'teacher' ${where}
       ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, currentSize, offset]
    )
    return paginated(res, rows, total[0]?.total || 0, currentPage, currentSize)
  } catch (e: any) {
    console.error('查询教师账号失败:', e)
    return error(res, '查询教师账号失败', 500)
  }
})

router.post('/teachers', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const username = String(req.body.username || '').trim()
    const password = String(req.body.password || '')
    if (!/^[A-Za-z0-9_.-]{3,50}$/.test(username)) return error(res, '用户名须为 3–50 位字母、数字或 ._-')
    if (password.length < 12) return error(res, '初始密码至少 12 位')
    const existing = await query<any>('SELECT id FROM admins WHERE username = ?', [username])
    if (existing.length) return error(res, '用户名已存在', 409)
    const passwordHash = bcrypt.hashSync(password, 12)
    const result: any = await query(
      `INSERT INTO admins (username, password_hash, role, is_active) VALUES (?, ?, 'teacher', 1)`,
      [username, passwordHash]
    )
    return success(res, { id: result.insertId, username, role: 'teacher', is_active: 1 }, '教师账号已创建')
  } catch (e: any) {
    console.error('创建教师账号失败:', e)
    return error(res, e.code === 'ER_DUP_ENTRY' ? '用户名已存在' : '创建教师账号失败', e.code === 'ER_DUP_ENTRY' ? 409 : 500)
  }
})

router.patch('/teachers/:id/active', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id < 1) return error(res, '无效的账号 ID')
    const active = req.body.is_active ? 1 : 0
    const result: any = await query("UPDATE admins SET is_active = ? WHERE id = ? AND role = 'teacher'", [active, id])
    if (!result.affectedRows) return error(res, '教师账号不存在', 404)
    return success(res, { id, is_active: active }, active ? '教师账号已启用' : '教师账号已停用')
  } catch (e: any) {
    console.error('更新教师账号失败:', e)
    return error(res, '更新教师账号失败', 500)
  }
})

export default router
export { teacherRouter }
