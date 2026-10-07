import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { query } from '../config/database.js'

export interface AuthRequest extends Request {
  user?: {
    id: number
    username: string
    role: 'admin' | 'teacher'
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'banshan-default-secret-change-me'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'

export function generateToken(payload: { id: number; username: string; role: 'admin' | 'teacher' }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as any })
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, message: '未提供认证令牌' })
  }

  const token = authHeader.substring(7)
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any
    const users = await query<any>('SELECT id, username, role, is_active FROM admins WHERE id = ?', [decoded.id])
    if (!users[0] || !users[0].is_active) {
      return res.status(401).json({ code: 401, message: '账号已停用或不存在' })
    }
    req.user = { id: users[0].id, username: users[0].username, role: users[0].role }
    next()
  } catch (e) {
    if (e instanceof Error && 'name' in e && (e.name === 'JsonWebTokenError' || e.name === 'TokenExpiredError')) {
      return res.status(401).json({ code: 401, message: '令牌无效或已过期' })
    }
    console.error('认证检查失败:', e)
    return res.status(500).json({ code: 500, message: '认证检查失败' })
  }
}

export function requireRole(...roles: Array<'admin' | 'teacher'>) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ code: 403, message: '当前账号无权访问' })
    }
    next()
  }
}

export function requireTeacherOrAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user || !['teacher', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ code: 403, message: '仅教师账号可访问' })
  }
  next()
}
