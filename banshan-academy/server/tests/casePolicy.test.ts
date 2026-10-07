import test from 'node:test'
import assert from 'node:assert/strict'
import { canReadCase, splitKeywords, validatePublication, type PublicationInput } from '../src/services/casePolicy.js'

const validTeachingCase: PublicationInput = {
  title: '一次视觉方案取舍',
  caseType: '教学型',
  chineseAbstract: '中'.repeat(220),
  englishAbstract: Array.from({ length: 130 }, () => 'design').join(' '),
  chineseKeywords: ['视觉表达', '材料转译', '研究生教学'],
  englishKeywords: ['visual', 'material', 'teaching'],
  bodyWordCount: 12000,
  plagiarismRate: 0.12,
  permissionStatus: 'public',
  hasTeacherGuide: true,
  approvedReviewCount: 2
}

test('accepts a complete teaching case and blocks a case without guide, authorization or two reviews', () => {
  assert.deepEqual(validatePublication(validTeachingCase), [])
  assert.deepEqual(
    validatePublication({ ...validTeachingCase, hasTeacherGuide: false, permissionStatus: 'pending', approvedReviewCount: 1 }),
    ['教学型案例须配套教学指导手册', '须先确认授权与保密状态', '须有至少两名同行专家审核通过']
  )
})

test('requires an explicit institutional exception for similarity above fifteen percent', () => {
  assert.ok(validatePublication({ ...validTeachingCase, plagiarismRate: 0.18 }).includes('超过 15% 时须登记院级建设阶段例外依据'))
  assert.deepEqual(validatePublication({ ...validTeachingCase, plagiarismRate: 0.18, similarityException: '院级立项阶段例外' }), [])
})

test('limits classroom and campus cases to teachers while public cases remain public', () => {
  assert.equal(canReadCase('public', 'anonymous', true), true)
  assert.equal(canReadCase('campus', 'anonymous', true), false)
  assert.equal(canReadCase('classroom', 'teacher', true), true)
  assert.equal(canReadCase('pending', 'admin', true), false)
  assert.equal(canReadCase('public', 'admin', false), false)
})

test('splits multilingual comma-delimited keyword values and trims blanks', () => {
  assert.deepEqual(splitKeywords('材料转译，文字设计;传统文化；  ;'), ['材料转译', '文字设计', '传统文化'])
})
