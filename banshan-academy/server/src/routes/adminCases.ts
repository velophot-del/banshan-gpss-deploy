import { Router } from 'express'
import multer from 'multer'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { getConnection, query } from '../config/database.js'
import { authMiddleware, requireRole, type AuthRequest } from '../middleware/auth.js'
import { success, error, paginated } from '../utils/response.js'
import { splitKeywords, validatePublication } from '../services/casePolicy.js'

const router = Router()
router.use(authMiddleware, requireRole('admin'))

const privateDir = path.resolve(process.env.CASE_PRIVATE_DIR?.trim() || path.resolve(process.cwd(), 'case-private-files'))
fs.mkdirSync(privateDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, privateDir),
  filename: (_req, file, callback) => callback(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '')}`)
})
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const allowed = /\.(jpe?g|png|gif|webp|pdf|mp4|mov|mp3|wav|docx?|xlsx?|pptx?|zip)$/i.test(file.originalname)
    if (allowed) callback(null, true)
    else callback(new Error('不支持此附件类型'))
  }
})

const codes = new Set(['VC', 'DM', 'PK', 'IX'])
const tagDimensions = ['method', 'theme', 'source', 'teaching_mode', 'difficulty', 'case_type'] as const

function parseJson(value: unknown, fallback: any = {}) {
  if (typeof value !== 'string') return value ?? fallback
  try { return JSON.parse(value) } catch { return fallback }
}

function bodyWordCount(value: string) {
  return value.replace(/```[\s\S]*?```/g, '').replace(/[#>*_`~\[\]()!-]/g, '').replace(/\s/g, '').length
}

function normalizeVersionInput(input: any, previous?: any) {
  const source = { ...(previous || {}), ...(input || {}) }
  const metadata = { ...parseJson(previous?.metadata_json), ...(input?.metadata || {}) }
  const guide = input?.teacher_guide ?? parseJson(previous?.teacher_guide_json)
  const text = String(source.case_body || '')
  return {
    title: String(source.title || '').trim(),
    case_type: String(source.case_type || '教学型').trim(),
    course_name: String(source.course_name || '').trim(),
    course_module: String(source.course_module || '').trim(),
    grade_year: String(source.grade_year || '').trim(),
    topic_name: String(source.topic_name || '').trim(),
    project_time: String(source.project_time || '').trim(),
    target_audience: String(source.target_audience || '').trim(),
    introduction: String(source.introduction || '').trim(),
    assignment: String(source.assignment || '').trim(),
    problem: String(source.problem || '').trim(),
    case_body: text,
    teaching_takeaways: String(source.teaching_takeaways || '').trim(),
    teacher_guide_json: JSON.stringify(guide || {}),
    metadata_json: JSON.stringify(metadata),
    permission_status: String(source.permission_status || 'pending'),
    plagiarism_rate: source.plagiarism_rate === '' || source.plagiarism_rate == null ? null : Number(source.plagiarism_rate),
    body_word_count: bodyWordCount(text),
    tags: source.tags || {},
    works: Array.isArray(source.works) ? source.works : []
  }
}

async function latestVersion(caseId: number, executor: any = { query }) {
  const [rows] = await executor.query(
    'SELECT * FROM case_versions WHERE case_id = ? ORDER BY version_number DESC LIMIT 1',
    [caseId]
  )
  return rows[0]
}

async function replaceTags(executor: any, versionId: number, tags: Record<string, unknown>) {
  await executor.query('DELETE FROM case_version_tags WHERE version_id = ?', [versionId])
  for (const dimension of tagDimensions) {
    for (const value of splitKeywords(tags[dimension] ?? (dimension === 'method' ? tags.methods : dimension === 'theme' ? tags.themes : undefined))) {
      await executor.query(
        'INSERT IGNORE INTO case_version_tags (version_id, dimension, tag_value) VALUES (?, ?, ?)',
        [versionId, dimension, value]
      )
    }
  }
}

async function replaceWorks(executor: any, versionId: number, works: any[], previousVersionId?: number) {
  const previousWorks = previousVersionId
    ? (await executor.query('SELECT * FROM case_works WHERE version_id = ? ORDER BY sort_order, id', [previousVersionId]))[0]
    : []
  for (let index = 0; index < works.length; index++) {
    const work = works[index]
    const [result] = await executor.query(
      `INSERT INTO case_works (version_id, title, author_name, author_statement, medium, description, display_allowed, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [versionId, work.title || '', work.author_name || '', work.author_statement || '', work.medium || '', work.description || '', work.display_allowed ? 1 : 0, index]
    )
    if (previousVersionId && previousWorks[index]) {
      const [assets] = await executor.query('SELECT * FROM case_assets WHERE work_id = ?', [previousWorks[index].id])
      for (const asset of assets) {
        await executor.query(
          `INSERT INTO case_assets (version_id, work_id, original_name, storage_key, mime_type, file_size, visibility, rights_status, source_note, uploaded_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [versionId, result.insertId, asset.original_name, asset.storage_key, asset.mime_type, asset.file_size, asset.visibility, asset.rights_status, asset.source_note, asset.uploaded_by]
        )
      }
    }
  }
  if (previousVersionId) {
    const [assets] = await executor.query('SELECT * FROM case_assets WHERE version_id = ? AND work_id IS NULL', [previousVersionId])
    for (const asset of assets) {
      await executor.query(
        `INSERT INTO case_assets (version_id, work_id, original_name, storage_key, mime_type, file_size, visibility, rights_status, source_note, uploaded_by)
         VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [versionId, asset.original_name, asset.storage_key, asset.mime_type, asset.file_size, asset.visibility, asset.rights_status, asset.source_note, asset.uploaded_by]
      )
    }
  }
}

async function insertVersion(executor: any, caseId: number, number: number, editorId: number, data: ReturnType<typeof normalizeVersionInput>, previousVersionId?: number) {
  const [result] = await executor.query(
    `INSERT INTO case_versions
     (case_id, version_number, title, case_type, course_name, course_module, grade_year, topic_name, project_time, target_audience,
      introduction, assignment, problem, case_body, teaching_takeaways, teacher_guide_json, metadata_json, permission_status,
      review_status, plagiarism_rate, body_word_count, editor_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`,
    [caseId, number, data.title, data.case_type, data.course_name, data.course_module, data.grade_year, data.topic_name, data.project_time, data.target_audience,
      data.introduction, data.assignment, data.problem, data.case_body, data.teaching_takeaways, data.teacher_guide_json, data.metadata_json,
      data.permission_status, data.plagiarism_rate, data.body_word_count, editorId]
  )
  await replaceTags(executor, result.insertId, data.tags)
  await replaceWorks(executor, result.insertId, data.works, previousVersionId)
  return result.insertId as number
}

router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1)
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(String(req.query.pageSize || '20'), 10) || 20))
    const keyword = String(req.query.keyword || '').trim()
    const status = String(req.query.status || '').trim()
    const params: any[] = []
    let where = '1=1'
    if (keyword) { where += ' AND (c.case_code LIKE ? OR v.title LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`) }
    if (status) { where += ' AND c.status = ?'; params.push(status) }
    const counts = await query<any>(
      `SELECT COUNT(*) AS total FROM cases c LEFT JOIN case_versions v ON v.id = (SELECT MAX(v2.id) FROM case_versions v2 WHERE v2.case_id = c.id) WHERE ${where}`,
      params
    )
    const rows = await query<any>(
      `SELECT c.id, c.case_code, c.status, c.is_featured, c.updated_at, v.id AS version_id, v.version_number, v.title,
              v.course_name, v.grade_year, v.topic_name, v.permission_status, v.review_status, v.last_reviewed_at
       FROM cases c LEFT JOIN case_versions v ON v.id = (SELECT MAX(v2.id) FROM case_versions v2 WHERE v2.case_id = c.id)
       WHERE ${where} ORDER BY c.updated_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    )
    return paginated(res, rows, Number(counts[0]?.total || 0), page, pageSize)
  } catch (e: any) {
    console.error('查询后台案例失败:', e)
    return error(res, '查询后台案例失败', 500)
  }
})

router.get('/usage-records', async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1)
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(String(req.query.pageSize || '50'), 10) || 50))
    const [count] = await query<any>('SELECT COUNT(*) AS total FROM case_usage_records')
    const rows = await query<any>(
      `SELECT u.*, c.case_code, v.title FROM case_usage_records u
       JOIN cases c ON c.id = u.case_id JOIN case_versions v ON v.id = u.version_id
       ORDER BY u.used_at DESC, u.id DESC LIMIT ? OFFSET ?`,
      [pageSize, (page - 1) * pageSize]
    )
    return paginated(res, rows, Number(count?.total || 0), page, pageSize)
  } catch (e: any) {
    console.error('查询课堂使用记录失败:', e)
    return error(res, '查询课堂使用记录失败', 500)
  }
})

router.get('/:caseCode', async (req, res) => {
  try {
    const cases = await query<any>('SELECT * FROM cases WHERE case_code = ?', [req.params.caseCode])
    if (!cases[0]) return error(res, '案例不存在', 404)
    const version = await latestVersion(cases[0].id)
    if (!version) return error(res, '案例版本不存在', 404)
    const tags = await query<any>('SELECT dimension, tag_value FROM case_version_tags WHERE version_id = ? ORDER BY dimension, tag_value', [version.id])
    const works = await query<any>('SELECT * FROM case_works WHERE version_id = ? ORDER BY sort_order, id', [version.id])
    const assets = await query<any>('SELECT * FROM case_assets WHERE version_id = ? ORDER BY id', [version.id])
    const reviews = await query<any>('SELECT * FROM case_reviews WHERE version_id = ? ORDER BY reviewed_at, id', [version.id])
    return success(res, {
      ...cases[0], ...version,
      metadata: parseJson(version.metadata_json),
      teacher_guide: parseJson(version.teacher_guide_json),
      tags: tags.reduce((out: any, tag: any) => ((out[tag.dimension] ||= []).push(tag.tag_value), out), {}),
      works: works.map((work: any) => ({ ...work, assets: assets.filter((asset: any) => asset.work_id === work.id) })),
      assets: assets.filter((asset: any) => asset.work_id == null),
      reviews
    })
  } catch (e: any) {
    console.error('查询后台案例详情失败:', e)
    return error(res, '查询后台案例详情失败', 500)
  }
})

router.post('/import', async (req: AuthRequest, res) => {
  const cases = req.body?.cases
  if (!Array.isArray(cases) || cases.length < 1 || cases.length > 100) {
    return error(res, '请导入 1 至 100 条案例')
  }
  const normalized = cases.map((item: any, index: number) => {
    const title = String(item?.title || '').trim()
    const caseType = String(item?.case_type || '教学型').trim()
    if (!title || [...title].length > 20) return { error: `第 ${index + 1} 条标题不能为空且不能超过 20 字` }
    if (!['教学型', '工作型', '混合型'].includes(caseType)) return { error: `第 ${index + 1} 条案例类型无效` }
    return { ...item, title, case_type: caseType }
  })
  const invalid = normalized.find((item: any) => item.error)
  if (invalid) return error(res, invalid.error)

  const conn = await getConnection()
  try {
    await conn.beginTransaction()
    const created: { case_code: string; title: string }[] = []
    for (const input of normalized as any[]) {
      const programCode = String(input.program_code || 'VC').trim().toUpperCase()
      const year = Number(input.case_year || new Date().getFullYear())
      if (!codes.has(programCode) || !Number.isInteger(year) || year < 2000 || year > 9999) {
        throw new Error('专业代码或年份无效')
      }
      await conn.query(
        `INSERT INTO case_sequences (program_code, case_year, last_number) VALUES (?, ?, 0)
         ON DUPLICATE KEY UPDATE last_number = last_number`,
        [programCode, year]
      )
      const [sequences]: any = await conn.query('SELECT last_number FROM case_sequences WHERE program_code = ? AND case_year = ? FOR UPDATE', [programCode, year])
      const number = Number(sequences[0].last_number) + 1
      await conn.query('UPDATE case_sequences SET last_number = ? WHERE program_code = ? AND case_year = ?', [number, programCode, year])
      const caseCode = `${programCode}-${year}-${String(number).padStart(3, '0')}`
      const [insertedCase]: any = await conn.query('INSERT INTO cases (case_code, created_by, is_featured) VALUES (?, ?, 0)', [caseCode, req.user!.id])
      const data = normalizeVersionInput({
        ...input,
        is_featured: false,
        permission_status: 'pending',
        tags: {
          method: input.method_tags || [],
          theme: input.theme_tags || []
        }
      })
      await insertVersion(conn, insertedCase.insertId, 1, req.user!.id, data)
      created.push({ case_code: caseCode, title: data.title })
    }
    await conn.commit()
    return success(res, { cases: created }, `已创建 ${created.length} 条草稿`)
  } catch (e: any) {
    await conn.rollback()
    console.error('批量导入案例失败:', e)
    return error(res, e.message || '批量导入失败', 500)
  } finally {
    conn.release()
  }
})

router.post('/', async (req: AuthRequest, res) => {
  const programCode = String(req.body.program_code || 'VC').trim().toUpperCase()
  const year = Number(req.body.case_year || new Date().getFullYear())
  if (!codes.has(programCode) || !Number.isInteger(year) || year < 2000 || year > 9999) return error(res, '专业代码或年份无效')
  const conn = await getConnection()
  try {
    await conn.beginTransaction()
    await conn.query(
      `INSERT INTO case_sequences (program_code, case_year, last_number) VALUES (?, ?, 0)
       ON DUPLICATE KEY UPDATE last_number = last_number`,
      [programCode, year]
    )
    const [sequences]: any = await conn.query('SELECT last_number FROM case_sequences WHERE program_code = ? AND case_year = ? FOR UPDATE', [programCode, year])
    const number = Number(sequences[0].last_number) + 1
    await conn.query('UPDATE case_sequences SET last_number = ? WHERE program_code = ? AND case_year = ?', [number, programCode, year])
    const caseCode = `${programCode}-${year}-${String(number).padStart(3, '0')}`
    const [insertedCase]: any = await conn.query('INSERT INTO cases (case_code, created_by, is_featured) VALUES (?, ?, ?)', [caseCode, req.user!.id, req.body.is_featured ? 1 : 0])
    const data = normalizeVersionInput(req.body)
    const versionId = await insertVersion(conn, insertedCase.insertId, 1, req.user!.id, data)
    await conn.commit()
    return success(res, { id: insertedCase.insertId, case_code: caseCode, version_id: versionId, version_number: 1 }, '案例草稿已创建')
  } catch (e: any) {
    await conn.rollback()
    console.error('创建案例失败:', e)
    return error(res, e.code === 'ER_DUP_ENTRY' ? '案例编号冲突，请重试' : '创建案例失败', e.code === 'ER_DUP_ENTRY' ? 409 : 500)
  } finally {
    conn.release()
  }
})

router.put('/:caseCode/draft', async (req: AuthRequest, res) => {
  const conn = await getConnection()
  try {
    await conn.beginTransaction()
    const [cases]: any = await conn.query('SELECT * FROM cases WHERE case_code = ? FOR UPDATE', [req.params.caseCode])
    if (!cases[0] || cases[0].status === 'retired') { await conn.rollback(); return error(res, '案例不存在或已归档', 404) }
    const previous = await latestVersion(cases[0].id, conn)
    if (!previous) { await conn.rollback(); return error(res, '案例版本不存在', 404) }
    const tagsRows: any = (await conn.query('SELECT dimension, tag_value FROM case_version_tags WHERE version_id = ?', [previous.id]))[0]
    const tags = tagsRows.reduce((out: any, row: any) => ((out[row.dimension] ||= []).push(row.tag_value), out), {})
    const works = (await conn.query('SELECT * FROM case_works WHERE version_id = ? ORDER BY sort_order, id', [previous.id]))[0]
    const input = { ...req.body, tags: req.body.tags ?? tags, works: req.body.works ?? works }
    const data = normalizeVersionInput(input, previous)
    const versionId = await insertVersion(conn, cases[0].id, Number(previous.version_number) + 1, req.user!.id, data, previous.id)
    await conn.query('UPDATE cases SET status = ? WHERE id = ?', [cases[0].current_version_id ? 'published' : 'draft', cases[0].id])
    await conn.commit()
    return success(res, { version_id: versionId, version_number: Number(previous.version_number) + 1 }, '新版本草稿已创建')
  } catch (e: any) {
    await conn.rollback()
    console.error('创建案例修订版失败:', e)
    return error(res, '创建案例修订版失败', 500)
  } finally {
    conn.release()
  }
})

router.post('/:caseCode/submit-review', async (req, res) => {
  try {
    const cases = await query<any>('SELECT * FROM cases WHERE case_code = ?', [req.params.caseCode])
    if (!cases[0]) return error(res, '案例不存在', 404)
    const version = await latestVersion(cases[0].id)
    if (!version || version.review_status === 'published') return error(res, '请先保存新的案例版本')
    await query("UPDATE case_versions SET review_status = 'pending_review' WHERE id = ?", [version.id])
    await query("UPDATE cases SET status = 'pending_review' WHERE id = ? AND current_version_id IS NULL", [cases[0].id])
    return success(res, { version_id: version.id }, '案例已提交审核')
  } catch (e: any) {
    console.error('提交审核失败:', e)
    return error(res, '提交审核失败', 500)
  }
})

router.post('/:caseCode/reviews', async (req: AuthRequest, res) => {
  try {
    const cases = await query<any>('SELECT id FROM cases WHERE case_code = ?', [req.params.caseCode])
    if (!cases[0]) return error(res, '案例不存在', 404)
    const version = await latestVersion(cases[0].id)
    const label = String(req.body.reviewer_label || '').trim()
    const decision = String(req.body.decision || '')
    if (!version || !label || !['approve', 'revise', 'reject'].includes(decision)) return error(res, '请填写评审代号和有效结论')
    await query(
      'INSERT INTO case_reviews (version_id, reviewer_label, decision, comments) VALUES (?, ?, ?, ?)',
      [version.id, label, decision, String(req.body.comments || '').trim()]
    )
    const approvals = await query<any>(
      "SELECT COUNT(DISTINCT reviewer_label) AS count FROM case_reviews WHERE version_id = ? AND decision = 'approve'",
      [version.id]
    )
    if (Number(approvals[0]?.count || 0) >= 2) {
      await query("UPDATE case_versions SET review_status = 'approved' WHERE id = ?", [version.id])
      await query("UPDATE cases SET status = 'approved' WHERE id = ? AND current_version_id IS NULL", [cases[0].id])
    }
    return success(res, { version_id: version.id, approved_review_count: Number(approvals[0]?.count || 0) }, '评审记录已保存')
  } catch (e: any) {
    console.error('保存评审记录失败:', e)
    return error(res, '保存评审记录失败', 500)
  }
})

router.post('/:caseCode/publish', async (req: AuthRequest, res) => {
  const conn = await getConnection()
  try {
    await conn.beginTransaction()
    const [cases]: any = await conn.query('SELECT * FROM cases WHERE case_code = ? FOR UPDATE', [req.params.caseCode])
    if (!cases[0]) { await conn.rollback(); return error(res, '案例不存在', 404) }
    const [versions]: any = await conn.query('SELECT * FROM case_versions WHERE case_id = ? ORDER BY version_number DESC LIMIT 1 FOR UPDATE', [cases[0].id])
    const version = versions[0]
    if (!version || version.review_status !== 'approved') { await conn.rollback(); return error(res, '须先完成两名同行专家审核', 409) }
    const [reviewRows]: any = await conn.query(
      "SELECT COUNT(DISTINCT reviewer_label) AS count FROM case_reviews WHERE version_id = ? AND decision = 'approve'",
      [version.id]
    )
    const metadata = parseJson(version.metadata_json)
    const guide = parseJson(version.teacher_guide_json)
    const errors = validatePublication({
      title: version.title,
      caseType: version.case_type,
      chineseAbstract: String(metadata.chineseAbstract || ''),
      englishAbstract: String(metadata.englishAbstract || ''),
      chineseKeywords: splitKeywords(metadata.chineseKeywords),
      englishKeywords: splitKeywords(metadata.englishKeywords),
      bodyWordCount: Number(version.body_word_count || 0),
      plagiarismRate: version.plagiarism_rate == null ? null : Number(version.plagiarism_rate),
      similarityException: String(metadata.similarityException || ''),
      permissionStatus: version.permission_status,
      hasTeacherGuide: Object.keys(guide).length > 0,
      approvedReviewCount: Number(reviewRows[0]?.count || 0)
    })
    if (errors.length) { await conn.rollback(); return error(res, errors.join('；'), 422) }
    if (cases[0].current_version_id) await conn.query("UPDATE case_versions SET review_status = 'superseded' WHERE id = ?", [cases[0].current_version_id])
    await conn.query("UPDATE case_versions SET review_status = 'published', last_reviewed_at = COALESCE(last_reviewed_at, CURDATE()) WHERE id = ?", [version.id])
    await conn.query("UPDATE cases SET current_version_id = ?, status = 'published', is_featured = ? WHERE id = ?", [version.id, req.body.is_featured ? 1 : 0, cases[0].id])
    await conn.commit()
    return success(res, { case_code: req.params.caseCode, version_number: version.version_number }, '案例已发布')
  } catch (e: any) {
    await conn.rollback()
    console.error('发布案例失败:', e)
    return error(res, '发布案例失败', 500)
  } finally {
    conn.release()
  }
})

router.post('/:caseCode/assets', upload.single('file'), async (req: AuthRequest, res) => {
  try {
    const file = req.file
    if (!file) return error(res, '请选择附件')
    const cases = await query<any>('SELECT id FROM cases WHERE case_code = ?', [req.params.caseCode])
    if (!cases[0]) { fs.unlinkSync(file.path); return error(res, '案例不存在', 404) }
    const version = await latestVersion(cases[0].id)
    if (!version || version.review_status === 'published') { fs.unlinkSync(file.path); return error(res, '请先创建可编辑草稿版本', 409) }
    const workId = req.body.work_id ? Number(req.body.work_id) : null
    if (workId) {
      const works = await query<any>('SELECT id FROM case_works WHERE id = ? AND version_id = ?', [workId, version.id])
      if (!works.length) { fs.unlinkSync(file.path); return error(res, '作品条目与当前版本不匹配', 400) }
    }
    const visibility = ['public', 'teacher', 'classroom', 'internal'].includes(req.body.visibility) ? req.body.visibility : 'internal'
    const rights = ['confirmed', 'restricted'].includes(req.body.rights_status) ? req.body.rights_status : 'pending'
    const result: any = await query(
      `INSERT INTO case_assets (version_id, work_id, original_name, storage_key, mime_type, file_size, visibility, rights_status, source_note, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [version.id, workId, file.originalname, path.basename(file.filename), file.mimetype, file.size, visibility, rights, String(req.body.source_note || '').trim(), req.user!.id]
    )
    return success(res, { id: result.insertId, filename: file.originalname, visibility, rights_status: rights }, '附件已上传；确认授权后才能公开')
  } catch (e: any) {
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path)
    console.error('上传案例附件失败:', e)
    return error(res, '上传案例附件失败', 500)
  }
})

router.post('/:caseCode/retire', async (req, res) => {
  try {
    const result: any = await query("UPDATE cases SET status = 'retired' WHERE case_code = ?", [req.params.caseCode])
    if (!result.affectedRows) return error(res, '案例不存在', 404)
    return success(res, null, '案例已归档')
  } catch (e: any) {
    console.error('归档案例失败:', e)
    return error(res, '归档案例失败', 500)
  }
})

export default router
