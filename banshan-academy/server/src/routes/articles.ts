import { Router } from 'express'
import { query } from '../config/database.js'
import { success, error, paginated } from '../utils/response.js'

const router = Router()

const ARTICLE_SELECT = `
  a.id, a.category_id, a.title, a.title_en, a.summary, a.cover_url,
  a.tags, a.author, a.status, a.is_featured, a.published_at, a.created_at,
  c.slug AS category_slug,
  CASE WHEN c.slug = 'method' THEN '教学方法文章' ELSE c.name END AS category_name,
  CASE WHEN c.slug = 'method' THEN 'Teaching Methods' ELSE c.name_en END AS category_name_en
`

// 首页精选
router.get('/featured', async (_req, res) => {
  try {
    const rows = await query<any>(`
      SELECT ${ARTICLE_SELECT}
      FROM articles a
      JOIN categories c ON c.id = a.category_id
      WHERE a.status = 'published' AND a.is_featured = 1
      ORDER BY a.published_at DESC
      LIMIT 6
    `)
    return success(res, rows)
  } catch (e: any) {
    console.error('查询精选失败:', e)
    return error(res, '查询精选失败', 500)
  }
})

// 文章列表（仅已发布）
router.get('/', async (req, res) => {
  try {
    const { category, page = '1', pageSize = '12', keyword } = req.query as Record<string, string>
    const currentPage = Math.max(1, parseInt(page, 10) || 1)
    const currentSize = Math.min(50, Math.max(1, parseInt(pageSize, 10) || 12))
    const offset = (currentPage - 1) * currentSize

    const conditions: string[] = ["a.status = 'published'"]
    const params: any[] = []

    if (category) {
      conditions.push('c.slug = ?')
      params.push(category)
    }
    if (keyword) {
      conditions.push('(a.title LIKE ? OR a.title_en LIKE ? OR a.summary LIKE ?)')
      const like = `%${keyword}%`
      params.push(like, like, like)
    }

    const where = `WHERE ${conditions.join(' AND ')}`

    const totalRows = await query<any>(
      `SELECT COUNT(*) AS total FROM articles a JOIN categories c ON c.id = a.category_id ${where}`,
      params
    )
    const total = totalRows[0]?.total || 0

    const rows = await query<any>(
      `SELECT ${ARTICLE_SELECT}
       FROM articles a
       JOIN categories c ON c.id = a.category_id
       ${where}
       ORDER BY a.published_at DESC, a.id DESC
       LIMIT ? OFFSET ?`,
      [...params, currentSize, offset]
    )

    return paginated(res, rows, total, currentPage, currentSize)
  } catch (e: any) {
    console.error('查询文章列表失败:', e)
    return error(res, '查询文章列表失败', 500)
  }
})

// 文章详情（仅已发布）
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (!id) return error(res, '无效的文章 ID')

    const rows = await query<any>(
      `SELECT ${ARTICLE_SELECT}, a.content
       FROM articles a
       JOIN categories c ON c.id = a.category_id
       WHERE a.id = ? AND a.status = 'published'`,
      [id]
    )
    if (!rows[0]) return error(res, '文章不存在或未发布', 404)

    // 上一篇 / 下一篇（同板块内）
    const prevRows = await query<any>(
      `SELECT id, title FROM articles WHERE category_id = ? AND status = 'published' AND id < ? ORDER BY id DESC LIMIT 1`,
      [rows[0].category_id, id]
    )
    const nextRows = await query<any>(
      `SELECT id, title FROM articles WHERE category_id = ? AND status = 'published' AND id > ? ORDER BY id ASC LIMIT 1`,
      [rows[0].category_id, id]
    )

    return success(res, {
      ...rows[0],
      prev: prevRows[0] || null,
      next: nextRows[0] || null
    })
  } catch (e: any) {
    console.error('查询文章详情失败:', e)
    return error(res, '查询文章详情失败', 500)
  }
})

export default router
