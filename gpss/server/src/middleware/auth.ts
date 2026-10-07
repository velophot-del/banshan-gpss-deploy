import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthRequest extends Request {
  user?: {
    id: string
    username: string
    role: 'admin' | 'teacher' | 'student'
    realName: string
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-me'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'

if (!process.env.JWT_SECRET) {
  console.warn('⚠️  [安全警告] 未设置 JWT_SECRET 环境变量，正在使用默认密钥。生产环境请务必在 .env 中配置 JWT_SECRET。')
}

// 生成 JWT Token
export function generateToken(payload: { id: string; username: string; role: string; realName: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as any })
}

// 验证 Token 中间件（登录即可）
export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, message: '未提供认证令牌' })
  }

  const token = authHeader.substring(7)
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any
    req.user = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role,
      realName: decoded.realName
    }
    next()
  } catch (error) {
    return res.status(401).json({ code: 401, message: '令牌无效或已过期' })
  }
}

// 角色验证中间件（admin 继承 teacher 的所有权限）
export function requireRole(roles: ('admin' | 'teacher' | 'student')[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ code: 401, message: '未认证' })
    }
    // 构建有效角色列表：admin 同时拥有 teacher 权限
    const effectiveRoles: ('admin' | 'teacher' | 'student')[] = [req.user.role]
    if (req.user.role === 'admin') {
      effectiveRoles.push('teacher')
    }
    if (!roles.some(r => effectiveRoles.includes(r))) {
      return res.status(403).json({ code: 403, message: '权限不足，需要角色: ' + roles.join('/') })
    }
    next()
  }
}
