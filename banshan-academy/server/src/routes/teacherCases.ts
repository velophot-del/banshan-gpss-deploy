import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { query } from '../config/database.js'
import { authMiddleware, requireTeacherOrAdmin, type AuthRequest } from '../middleware/auth.js'
import { success, error, paginated } from '../utils/response.js'

const router = Router()
router.use(authMiddleware, requireTeacherOrAdmin)

router.get('/', async (_req, res) => {
  try {
    const rows = await query<any>(
      `SELECT c.case_code, c.updated_at, v.title, v.course_name, v.grade_year, v.topic_name, v.introduction, v.permission_status
       FROM cases c JOIN case_versions v ON v.id = c.current_version_id
       WHERE c.status = 'published' AND v.review_status = 'published' AND v.permission_status IN ('public','campus','classroom')
       ORDER BY c.updated_at DESC`
    )
    return success(res, rows)
  } catch (e: any) {
    console.error('查询教师可用案例失败:', e)
    return error(res, '查询教师可用案例失败', 500)
  }
})

router.get('/:caseCode', async (req, res) => {
  try {
    const rows = await query<any>(
      `SELECT c.case_code, c.updated_at, v.case_type, v.title, v.course_name, v.grade_year, v.topic_name, v.project_time,
              v.introduction, v.assignment, v.problem, v.case_body, v.teaching_takeaways, v.permission_status,
              v.teacher_guide_json, v.metadata_json, v.id AS version_id
       FROM cases c JOIN case_versions v ON v.id = c.current_version_id
       WHERE c.case_code = ? AND c.status = 'published' AND v.review_status = 'published'
         AND v.permission_status IN ('public','campus','classroom')`, [req.params.caseCode]
    )
    if (!rows[0]) return error(res, '案例不存在或当前账号无权访问', 404)
    const row = rows[0]
    const works = await query<any>('SELECT id, title, author_statement, medium, description FROM case_works WHERE version_id = ? ORDER BY sort_order, id', [row.version_id])
    const tagRows = await query<any>("SELECT dimension, tag_value FROM case_version_tags WHERE version_id = ? AND dimension IN ('method','theme') ORDER BY dimension, tag_value", [row.version_id])
    const attachments = await query<any>(
      `SELECT id, original_name, visibility FROM case_assets
       WHERE version_id = ? AND visibility IN ('teacher','classroom') AND rights_status = 'confirmed' ORDER BY id`,
      [row.version_id]
    )
    return success(res, {
      case_code: row.case_code, updated_at: row.updated_at, case_type: row.case_type, title: row.title, course_name: row.course_name, grade_year: row.grade_year,
      topic_name: row.topic_name, project_time: row.project_time, introduction: row.introduction,
      assignment: row.assignment, problem: row.problem, case_body: row.case_body,
      teaching_takeaways: row.teaching_takeaways, permission_status: row.permission_status,
      tags: tagRows.reduce((out: Record<string, string[]>, tag: any) => ((out[tag.dimension] ||= []).push(tag.tag_value), out), {}), works, attachments,
      teacher_guide: parseJson(row.teacher_guide_json),
      metadata: (() => {
        const metadata = parseJson(row.metadata_json)
        return { chineseAbstract: metadata.chineseAbstract || '', chineseKeywords: metadata.chineseKeywords || [], publicAuthors: metadata.publicAuthors || [], citation: metadata.citation || '' }
      })()
    })
  } catch (e: any) {
    console.error('查询教师案例详情失败:', e)
    return error(res, '查询教师案例详情失败', 500)
  }
})

function parseJson(value: unknown) {
  if (typeof value !== 'string') return value || {}
  try { return JSON.parse(value) } catch { return {} }
}

router.get('/:caseCode/guide', async (req, res) => {
  try {
    const rows = await query<any>(
      `SELECT v.id, v.case_type, v.title, v.version_number, v.teacher_guide_json, v.permission_status
       FROM cases c JOIN case_versions v ON v.id = c.current_version_id
       WHERE c.case_code = ? AND c.status = 'published' AND v.review_status = 'published'
         AND v.permission_status IN ('public','campus','classroom')`,
      [req.params.caseCode]
    )
    if (!rows[0]) return error(res, '案例不存在或当前不可供教师使用', 404)
    const guide = parseJson(rows[0].teacher_guide_json)
    if (!Object.keys(guide).length) return error(res, '该案例尚未录入教学指导手册', 404)
    return success(res, {
      case_code: req.params.caseCode,
      title: rows[0].title,
      version_number: rows[0].version_number,
      permission_status: rows[0].permission_status,
      teacher_guide: guide
    })
  } catch (e: any) {
    console.error('读取教师手册失败:', e)
    return error(res, '读取教师手册失败', 500)
  }
})

router.get('/:caseCode/assets/:assetId', async (req, res) => {
  try {
    const assetId = Number(req.params.assetId)
    const rows = await query<any>(
      `SELECT a.storage_key, a.mime_type, a.original_name, a.visibility, a.rights_status
       FROM case_assets a
       JOIN case_versions v ON v.id = a.version_id
       JOIN cases c ON c.current_version_id = v.id
       WHERE c.case_code = ? AND a.id = ? AND c.status = 'published' AND v.review_status = 'published'
         AND v.permission_status IN ('public','campus','classroom')
         AND a.visibility IN ('public','teacher','classroom') AND a.rights_status = 'confirmed'`,
      [req.params.caseCode, assetId]
    )
    if (!rows[0]) return error(res, '附件不存在或当前账号无权访问', 404)
    const root = path.resolve(process.env.CASE_PRIVATE_DIR?.trim() || path.resolve(process.cwd(), 'case-private-files'))
    const filePath = path.resolve(root, rows[0].storage_key)
    if (!filePath.startsWith(`${root}${path.sep}`) || !fs.existsSync(filePath)) return error(res, '附件不存在', 404)
    res.setHeader('Content-Type', rows[0].mime_type)
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(rows[0].original_name)}`)
    return res.sendFile(filePath)
  } catch (e: any) {
    console.error('读取教师附件失败:', e)
    return error(res, '读取附件失败', 500)
  }
})

router.get('/usage', async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1)
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(String(req.query.pageSize || '20'), 10) || 20))
    const ownOnly = req.user!.role === 'teacher'
    const condition = ownOnly ? 'WHERE u.recorded_by = ?' : ''
    const params = ownOnly ? [req.user!.id] : []
    const countRows = await query<any>(`SELECT COUNT(*) AS total FROM case_usage_records u ${condition}`, params)
    const rows = await query<any>(
      `SELECT u.*, c.case_code, v.title FROM case_usage_records u
       JOIN cases c ON c.id = u.case_id JOIN case_versions v ON v.id = u.version_id
       ${condition} ORDER BY u.used_at DESC, u.id DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    )
    return paginated(res, rows, Number(countRows[0]?.total || 0), page, pageSize)
  } catch (e: any) {
    console.error('查询课堂使用登记失败:', e)
    return error(res, '查询课堂使用登记失败', 500)
  }
})

router.post('/usage', async (req: AuthRequest, res) => {
  try {
    const { case_code, used_at, class_name, teaching_form, teaching_hours, student_count, satisfaction, feedback_summary, improvement_notes } = req.body
    const cases = await query<any>(
      `SELECT c.id AS case_id, v.id AS version_id, v.title
       FROM cases c JOIN case_versions v ON v.id = c.current_version_id
       WHERE c.case_code = ? AND c.status = 'published' AND v.review_status = 'published'
         AND v.permission_status IN ('public','campus','classroom')`,
      [case_code]
    )
    if (!cases[0]) return error(res, '案例不存在或当前不可登记', 404)
    if (!used_at || !class_name?.trim() || !teaching_form?.trim()) return error(res, '请填写使用日期、班级与教学形式')
    const hours = Number(teaching_hours || 0)
    const students = Number(student_count || 0)
    const rating = satisfaction == null || satisfaction === '' ? null : Number(satisfaction)
    if (!Number.isFinite(hours) || hours < 0 || !Number.isInteger(students) || students < 0) return error(res, '学时或学生人数无效')
    if (rating != null && (!Number.isFinite(rating) || rating < 0 || rating > 5)) return error(res, '满意度须为 0–5 分')
    const result: any = await query(
      `INSERT INTO case_usage_records
       (case_id, version_id, used_at, class_name, teacher_name, teaching_form, teaching_hours, student_count, satisfaction, feedback_summary, improvement_notes, recorded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [cases[0].case_id, cases[0].version_id, used_at, String(class_name).trim(), req.user!.username, String(teaching_form).trim(), hours, students, rating, String(feedback_summary || '').trim(), String(improvement_notes || '').trim(), req.user!.id]
    )
    return success(res, { id: result.insertId, case_code, title: cases[0].title }, '使用记录已保存')
  } catch (e: any) {
    console.error('创建课堂使用登记失败:', e)
    return error(res, '创建课堂使用登记失败', 500)
  }
})

export default router
