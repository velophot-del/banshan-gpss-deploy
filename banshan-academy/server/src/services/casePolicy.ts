export type CasePermission = 'public' | 'campus' | 'classroom' | 'pending'
export type CaseRole = 'admin' | 'teacher' | 'anonymous'

export interface PublicationInput {
  title: string
  caseType: string
  chineseAbstract: string
  englishAbstract: string
  chineseKeywords: string[]
  englishKeywords: string[]
  bodyWordCount: number
  plagiarismRate?: number | null
  similarityException?: string
  permissionStatus: CasePermission
  hasTeacherGuide: boolean
  approvedReviewCount: number
}

export function validatePublication(input: PublicationInput): string[] {
  const errors: string[] = []
  if (!input.title.trim() || input.title.trim().length > 20) errors.push('案例标题须为 1–20 字')
  const chineseLength = input.chineseAbstract.trim().length
  if (chineseLength < 200 || chineseLength > 300) errors.push('中文摘要须为 200–300 字')
  const englishWords = input.englishAbstract.trim().split(/\s+/).filter(Boolean).length
  if (englishWords < 120 || englishWords > 180) errors.push('英文摘要须为 120–180 词')
  if (input.chineseKeywords.length < 3 || input.chineseKeywords.length > 5) errors.push('中文关键词须为 3–5 个')
  if (input.englishKeywords.length < 3 || input.englishKeywords.length > 5) errors.push('英文关键词须为 3–5 个')
  if (input.caseType === '教学型' && input.bodyWordCount < 10000) errors.push('教学型案例正文不少于 10000 字')
  if (input.caseType === '教学型' && !input.hasTeacherGuide) errors.push('教学型案例须配套教学指导手册')
  if (input.caseType === '小微案例' && input.bodyWordCount > 4000) errors.push('小微案例正文不超过 4000 字')
  if (input.plagiarismRate == null) errors.push('请登记正文与手册合并查重结果')
  if (input.plagiarismRate != null && input.plagiarismRate > 0.15 && input.plagiarismRate <= 0.2 && !input.similarityException?.trim()) {
    errors.push('超过 15% 时须登记院级建设阶段例外依据')
  }
  if (input.plagiarismRate != null && input.plagiarismRate > 0.2) errors.push('查重率超过可登记例外范围 20%')
  if (input.permissionStatus === 'pending') errors.push('须先确认授权与保密状态')
  if (input.approvedReviewCount < 2) errors.push('须有至少两名同行专家审核通过')
  return errors
}

export function canReadCase(permission: CasePermission, role: CaseRole, published: boolean): boolean {
  if (!published || permission === 'pending') return false
  if (permission === 'public') return true
  return role === 'teacher' || role === 'admin'
}

export function splitKeywords(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean)
  if (typeof value !== 'string') return []
  return value.split(/[;,，；]/).map((item) => item.trim()).filter(Boolean)
}
