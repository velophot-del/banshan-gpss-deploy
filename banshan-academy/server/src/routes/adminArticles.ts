import { Router } from 'express'
import { query } from '../config/database.js'
import { success, error, paginated } from '../utils/response.js'
import { authMiddleware, requireRole } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware, requireRole('admin'))

const ADMIN_SELECT = `
  a.id, a.category_id, a.title, a.title_en, a.summary, a.cover_url,
  a.tags, a.author, a.status, a.is_featured, a.published_at, a.created_at, a.updated_at,
  c.slug AS category_slug,
  CASE WHEN c.slug = 'method' THEN '教学方法文章' ELSE c.name END AS category_name
`

// 后台文章列表（含草稿）
router.get('/', async (req, res) => {
  try {
    const { category, status, page = '1', pageSize = '10', keyword } = req.query as Record<string, string>
    const currentPage = Math.max(1, parseInt(page, 10) || 1)
    const currentSize = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 10))
    const offset = (currentPage - 1) * currentSize

    const conditions: string[] = []
    const params: any[] = []

    if (category) {
      conditions.push('c.slug = ?')
      params.push(category)
    }
    if (status) {
      conditions.push('a.status = ?')
      params.push(status)
    }
    if (keyword) {
      conditions.push('(a.title LIKE ? OR a.title_en LIKE ?)')
      const like = `%${keyword}%`
      params.push(like, like)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const totalRows = await query<any>(
      `SELECT COUNT(*) AS total FROM articles a JOIN categories c ON c.id = a.category_id ${where}`,
      params
    )
    const total = totalRows[0]?.total || 0

    const rows = await query<any>(
      `SELECT ${ADMIN_SELECT}
       FROM articles a
       JOIN categories c ON c.id = a.category_id
       ${where}
       ORDER BY a.updated_at DESC, a.id DESC
       LIMIT ? OFFSET ?`,
      [...params, currentSize, offset]
    )

    return paginated(res, rows, total, currentPage, currentSize)
  } catch (e: any) {
    console.error('查询后台文章失败:', e)
    return error(res, '查询后台文章失败', 500)
  }
})

// 单篇详情（含草稿，供编辑回显）
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (!id) return error(res, '无效的文章 ID')
    const rows = await query<any>(
      `SELECT ${ADMIN_SELECT}, a.content
       FROM articles a
       JOIN categories c ON c.id = a.category_id
       WHERE a.id = ?`,
      [id]
    )
    if (!rows[0]) return error(res, '文章不存在', 404)
    return success(res, rows[0])
  } catch (e: any) {
    console.error('查询文章详情失败:', e)
    return error(res, '查询文章详情失败', 500)
  }
})

// 新建文章
router.post('/', async (req, res) => {
  try {
    const {
      category_id, title, title_en = '', summary = '', cover_url = '',
      content = '', tags = '', author = '半山学堂', status = 'draft', is_featured = 0
    } = req.body

    if (!category_id || !title) {
      return error(res, '请填写板块与标题')
    }

    const publishedAt = status === 'published' ? new Date() : null
    const result: any = await query(
      `INSERT INTO articles
       (category_id, title, title_en, summary, cover_url, content, tags, author, status, is_featured, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [category_id, title, title_en, summary, cover_url, content, tags, author, status, is_featured ? 1 : 0, publishedAt]
    )
    return success(res, { id: result.insertId }, '创建成功')
  } catch (e: any) {
    console.error('创建文章失败:', e)
    return error(res, '创建文章失败', 500)
  }
})

// 编辑文章
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (!id) return error(res, '无效的文章 ID')

    const fields = [
      'category_id', 'title', 'title_en', 'summary', 'cover_url',
      'content', 'tags', 'author', 'status', 'is_featured'
    ]
    const existing = await query<any>('SELECT * FROM articles WHERE id = ?', [id])
    if (!existing[0]) return error(res, '文章不存在', 404)

    const sets: string[] = []
    const params: any[] = []
    for (const field of fields) {
      if (field in req.body) {
        let value = req.body[field]
        if (field === 'is_featured') value = value ? 1 : 0
        sets.push(`${field} = ?`)
        params.push(value)
      }
    }

    // 状态从非发布 → 发布时，补全发布时间
    if (req.body.status === 'published' && existing[0].status !== 'published') {
      sets.push('published_at = COALESCE(published_at, NOW())')
    }
    // 状态切回草稿时，保留原发布时间（允许再次发布沿用）
    if (req.body.status === 'draft' && existing[0].status === 'published') {
      // 保留 published_at，不处理
    }

    if (sets.length === 0) return error(res, '没有需要更新的字段')

    sets.push('updated_at = NOW()')
    params.push(id)

    await query(`UPDATE articles SET ${sets.join(', ')} WHERE id = ?`, params)
    return success(res, null, '更新成功')
  } catch (e: any) {
    console.error('更新文章失败:', e)
    return error(res, '更新文章失败', 500)
  }
})

// 删除文章
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (!id) return error(res, '无效的文章 ID')

    await query('DELETE FROM articles WHERE id = ?', [id])
    return success(res, null, '删除成功')
  } catch (e: any) {
    console.error('删除文章失败:', e)
    return error(res, '删除文章失败', 500)
  }
})

export default router
