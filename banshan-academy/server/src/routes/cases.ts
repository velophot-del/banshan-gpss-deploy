import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { query } from '../config/database.js'
import { success, error, paginated } from '../utils/response.js'

const router = Router()
const publicScope = `c.status = 'published' AND c.current_version_id = v.id
  AND v.review_status = 'published' AND v.permission_status = 'public'`

function parseJson(value: unknown, fallback: any = {}) {
  if (typeof value !== 'string') return value ?? fallback
  try { return JSON.parse(value) } catch { return fallback }
}

function addFilter(conditions: string[], params: any[], column: string, value?: string) {
  if (value?.trim()) {
    conditions.push(`${column} = ?`)
    params.push(value.trim())
  }
}

router.get('/options', async (_req, res) => {
  try {
    const rows = await query<any>(
      `SELECT DISTINCT v.course_name AS value, 'course' AS dimension FROM cases c JOIN case_versions v ON v.id = c.current_version_id WHERE ${publicScope} AND v.course_name <> ''
       UNION SELECT DISTINCT v.grade_year, 'year' FROM cases c JOIN case_versions v ON v.id = c.current_version_id WHERE ${publicScope} AND v.grade_year <> ''
       UNION SELECT DISTINCT v.topic_name, 'topic' FROM cases c JOIN case_versions v ON v.id = c.current_version_id WHERE ${publicScope} AND v.topic_name <> ''
       UNION SELECT DISTINCT tag.tag_value, tag.dimension FROM case_version_tags tag JOIN case_versions v ON v.id = tag.version_id JOIN cases c ON c.current_version_id = v.id WHERE ${publicScope} AND tag.dimension IN ('method','theme')
       ORDER BY dimension, value`
    )
    const result: Record<string, string[]> = {}
    for (const row of rows) (result[row.dimension] ||= []).push(row.value)
    return success(res, result)
  } catch (e: any) {
    console.error('查询案例筛选项失败:', e)
    return error(res, '查询案例筛选项失败', 500)
  }
})

router.get('/featured', async (_req, res) => listCases({ is_featured: '1', pageSize: '6' }, res))
router.get('/latest', async (_req, res) => listCases({ pageSize: '6', sort: 'latest' }, res))

router.get('/', async (req, res) => listCases(req.query as Record<string, string>, res))

async function listCases(filters: Record<string, string>, res: any) {
  try {
    const page = Math.max(1, Number.parseInt(filters.page || '1', 10) || 1)
    const pageSize = Math.min(50, Math.max(1, Number.parseInt(filters.pageSize || '12', 10) || 12))
    const conditions = [publicScope]
    const params: any[] = []
    addFilter(conditions, params, 'v.course_name', filters.course)
    addFilter(conditions, params, 'v.grade_year', filters.year)
    addFilter(conditions, params, 'v.topic_name', filters.topic)
    for (const [key, dimension] of [['method', 'method'], ['theme', 'theme'], ['source', 'source'], ['teachingMode', 'teaching_mode'], ['difficulty', 'difficulty']]) {
      const value = filters[key]
      if (value?.trim()) {
        conditions.push(`EXISTS (SELECT 1 FROM case_version_tags t WHERE t.version_id = v.id AND t.dimension = ? AND t.tag_value = ?)`)
        params.push(dimension, value.trim())
      }
    }
    if (filters.caseType?.trim()) {
      conditions.push('v.case_type = ?')
      params.push(filters.caseType.trim())
    }
    if (filters.keyword?.trim()) {
      conditions.push('(v.title LIKE ? OR v.introduction LIKE ? OR v.assignment LIKE ? OR v.teaching_takeaways LIKE ?)')
      const like = `%${filters.keyword.trim()}%`
      params.push(like, like, like, like)
    }
    if (filters.is_featured === '1') conditions.push('c.is_featured = 1')
    const where = conditions.join(' AND ')
    const counts = await query<any>(
      `SELECT COUNT(*) AS total FROM cases c JOIN case_versions v ON v.id = c.current_version_id WHERE ${where}`,
      params
    )
    const rows = await query<any>(
      `SELECT c.case_code, c.is_featured, c.updated_at, v.id AS version_id, v.version_number,
              v.title, v.course_name, v.course_module, v.grade_year, v.topic_name,
              v.project_time, v.introduction, v.metadata_json
       FROM cases c JOIN case_versions v ON v.id = c.current_version_id
       WHERE ${where}
       ORDER BY ${filters.sort === 'latest' ? 'c.updated_at DESC, c.id DESC' : 'c.is_featured DESC, c.updated_at DESC, c.id DESC'} LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    )
    const total = Number(counts[0]?.total || 0)
    return paginated(res, rows.map((row) => {
      const metadata = parseJson(row.metadata_json, {})
      return {
        ...row,
        metadata: {
          chineseAbstract: metadata.chineseAbstract || '',
          chineseKeywords: metadata.chineseKeywords || [],
          publicAuthors: metadata.publicAuthors || []
        },
        metadata_json: undefined
      }
    }), total, page, pageSize)
  } catch (e: any) {
    console.error('查询案例列表失败:', e)
    return error(res, '查询案例列表失败', 500)
  }
}

router.get('/assets/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id < 1) return error(res, '无效的附件编号', 400)
    const rows = await query<any>(
      `SELECT a.storage_key, a.mime_type, a.original_name
       FROM case_assets a
       JOIN case_versions v ON v.id = a.version_id
       JOIN cases c ON c.current_version_id = v.id
       LEFT JOIN case_works w ON w.id = a.work_id
       WHERE a.id = ? AND a.visibility = 'public' AND a.rights_status = 'confirmed'
         AND (${publicScope}) AND (a.work_id IS NULL OR w.display_allowed = 1)`,
      [id]
    )
    if (!rows[0]) return error(res, '附件不存在或未获公开授权', 404)
    const root = process.env.CASE_PRIVATE_DIR?.trim() || path.resolve(process.cwd(), 'case-private-files')
    const filePath = path.resolve(root, rows[0].storage_key)
    if (!filePath.startsWith(`${path.resolve(root)}${path.sep}`) || !fs.existsSync(filePath)) return error(res, '附件不存在', 404)
    res.setHeader('Content-Type', rows[0].mime_type)
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(rows[0].original_name)}`)
    return res.sendFile(filePath)
  } catch (e: any) {
    console.error('读取公开案例附件失败:', e)
    return error(res, '读取附件失败', 500)
  }
})

router.get('/:caseCode', async (req, res) => {
  try {
    const rows = await query<any>(
      `SELECT c.case_code, c.is_featured, c.updated_at, v.*
       FROM cases c JOIN case_versions v ON v.id = c.current_version_id
       WHERE c.case_code = ? AND ${publicScope}`,
      [req.params.caseCode]
    )
    const version = rows[0]
    if (!version) return error(res, '案例不存在或尚未公开', 404)

    const works = await query<any>(
      `SELECT id, title, author_name, author_statement, medium, description, sort_order
       FROM case_works WHERE version_id = ? AND display_allowed = 1 ORDER BY sort_order, id`,
      [version.id]
    )
    const assets = await query<any>(
      `SELECT id, work_id, original_name, mime_type, visibility, rights_status, source_note
       FROM case_assets WHERE version_id = ? AND visibility = 'public' AND rights_status = 'confirmed' ORDER BY id`,
      [version.id]
    )
    const reviews = await query<any>(
      `SELECT COUNT(*) AS approved_count FROM case_reviews WHERE version_id = ? AND decision = 'approve'`,
      [version.id]
    )
    const sourceMetadata = parseJson(version.metadata_json, {})
    const metadata = {
      chineseAbstract: sourceMetadata.chineseAbstract || '',
      englishAbstract: sourceMetadata.englishAbstract || '',
      chineseKeywords: sourceMetadata.chineseKeywords || [],
      englishKeywords: sourceMetadata.englishKeywords || [],
      publicAuthors: sourceMetadata.publicAuthors || [],
      citation: sourceMetadata.citation || '',
      publicReferences: sourceMetadata.publicReferences || []
    }
    const tagRows = await query<any>(
      `SELECT dimension, tag_value FROM case_version_tags WHERE version_id = ? AND dimension IN ('method','theme') ORDER BY dimension, tag_value`,
      [version.id]
    )
    const guide = parseJson(version.teacher_guide_json, {})
    const relatedCodes = Array.isArray(sourceMetadata.relatedCaseCodes) ? sourceMetadata.relatedCaseCodes : []
    const related = relatedCodes.length
      ? await query<any>(
          `SELECT c.case_code, v.title, v.course_name, v.grade_year, v.topic_name
           FROM cases c JOIN case_versions v ON v.id = c.current_version_id
           WHERE c.case_code IN (?) AND ${publicScope}`,
          [relatedCodes]
        )
      : []
    return success(res, {
      case_code: version.case_code,
      version_number: version.version_number,
      is_featured: version.is_featured,
      updated_at: version.updated_at,
      title: version.title,
      case_type: version.case_type,
      course_name: version.course_name,
      course_module: version.course_module,
      grade_year: version.grade_year,
      topic_name: version.topic_name,
      project_time: version.project_time,
      permission_status: version.permission_status,
      introduction: version.introduction,
      assignment: version.assignment,
      problem: version.problem,
      case_body: version.case_body,
      teaching_takeaways: version.teaching_takeaways,
      metadata,
      tags: tagRows.reduce((out: Record<string, string[]>, tag: any) => ((out[tag.dimension] ||= []).push(tag.tag_value), out), {}),
      teacher_guide_available: Object.keys(guide).length > 0,
      approved_review_count: Number(reviews[0]?.approved_count || 0),
      works: works.map((work) => ({ ...work, assets: assets.filter((asset) => asset.work_id === work.id) })),
      assets: assets.filter((asset) => asset.work_id == null),
      related_cases: related
    })
  } catch (e: any) {
    console.error('查询案例详情失败:', e)
    return error(res, '查询案例详情失败', 500)
  }
})

export default router
