import { Router } from 'express'
import { query } from '../config/database.js'
import { success, error } from '../utils/response.js'

const router = Router()

// 板块列表（含各板块文章数）
router.get('/', async (_req, res) => {
  try {
    const rows = await query<any>(`
      SELECT c.id, c.slug,
             CASE WHEN c.slug = 'method' THEN '教学方法文章' ELSE c.name END AS name,
             CASE WHEN c.slug = 'method' THEN 'Teaching Methods' ELSE c.name_en END AS name_en,
             c.sort_order,
             (SELECT COUNT(*) FROM articles a WHERE a.category_id = c.id AND a.status = 'published') AS article_count
      FROM categories c
      ORDER BY c.sort_order ASC, c.id ASC
    `)
    return success(res, rows)
  } catch (e: any) {
    console.error('查询板块失败:', e)
    return error(res, '查询板块失败', 500)
  }
})

export default router
