import mysql from 'mysql2/promise'
import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'
import { resolveDatabaseConfig } from '../config/runtime.js'

dotenv.config()

async function main() {
  const config = resolveDatabaseConfig() as mysql.ConnectionOptions
  const conn = await mysql.createConnection(config)
  await conn.query(`USE \`${process.env.DB_NAME || 'banshan'}\``)

  console.log('写入板块...')
  const categories = [
    { slug: 'info', name: '设计艺术信息', name_en: 'Design Art News', sort_order: 1 },
    { slug: 'method', name: '教学方法文章', name_en: 'Teaching Methods', sort_order: 2 },
    { slug: 'frontier', name: '设计前沿研究', name_en: 'Frontiers in Design', sort_order: 3 },
  ]
  for (const c of categories) {
    await conn.query(
      `INSERT INTO categories (slug, name, name_en, sort_order)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), name_en = VALUES(name_en), sort_order = VALUES(sort_order)`,
      [c.slug, c.name, c.name_en, c.sort_order]
    )
  }

  console.log('写入管理员账号 admin / 123456 ...')
  const hash = bcrypt.hashSync('123456', 10)
  await conn.query(
    `INSERT IGNORE INTO admins (username, password_hash, role, is_active)
     VALUES (?, ?, 'admin', 1)`,
    ['admin', hash]
  )

  // 获取板块 id
  const [catRows] = await conn.query('SELECT id, slug FROM categories') as any
  const catMap: Record<string, number> = {}
  for (const r of catRows) catMap[r.slug] = r.id

  // 仅当 articles 表为空时才写入示例文章，避免重复种子数据
  const [countRows] = await conn.query('SELECT COUNT(*) AS cnt FROM articles') as any
  if (countRows[0]?.cnt > 0) {
    console.log('articles 表已有数据，跳过示例文章写入')
    await conn.end()
    console.log('✅ 种子数据检查完成（板块/管理员已确保存在）')
    return
  }

  console.log('写入示例文章...')
  const articles = [
    {
      category_id: catMap['method'],
      title: '形态构成的基础表现方法',
      title_en: 'Fundamental Expression Methods of Form',
      summary: '从点、线、面到体，梳理视觉传达设计中形态构成的基础表现路径与教学案例。',
      tags: '形态构成,表现方法,教学案例',
      content: `# 形态构成的基础表现方法

在视觉传达设计教学中，「表现方法」是连接观念与作品的桥梁。本案例围绕形态构成的基础单元，展开一套可复用的教学路径。

## 一、从点到线的秩序

点是最小的视觉单元。教学中先引导学生以「重复、渐变、发射、特异」四种方式组织点，观察秩序感的产生。

## 二、面与正负形

面由线的运动与围合产生。正负形（图底关系）训练，是建立空间感知的重要方法。

## 三、教学建议

1. 先做黑白练习，再引入色彩；
2. 强调「限制条件」——在约束中反而更容易产生创新；
3. 每次练习都要求学生口头陈述「为什么这样做」。

> 表现方法的本质，是让不可见的结构变得可见。
`,
      is_featured: 1,
    },
    {
      category_id: catMap['frontier'],
      title: '生成式设计在视觉传达中的新可能',
      title_en: 'New Possibilities of Generative Design',
      summary: '生成式设计正在重塑视觉语言的生产方式，本文探讨其在海报、品牌与动态视觉中的应用。',
      tags: '生成式设计,前沿,动态视觉',
      content: `# 生成式设计在视觉传达中的新可能

当算法成为设计的合作者，视觉语言的生产方式正发生根本变化。

## 参数与随机

生成式设计的核心，是把设计规则转化为参数与约束。设计者从「画结果」转向「设计规则」。

## 应用场景

- 海报的系列化延展
- 品牌动态识别系统
- 数据驱动的信息可视化

## 反思

工具的更新并不意味着审美判断的让渡。设计师仍需为「生成什么」负责。
`,
      is_featured: 1,
    },
    {
      category_id: catMap['info'],
      title: '2026 秋季学期视觉传达设计专业教学安排',
      title_en: 'Autumn Semester Teaching Plan',
      summary: '发布本学期视觉传达设计专业的课程安排与教学重点，供师生查阅。',
      tags: '通知,教学安排',
      content: `# 2026 秋季学期视觉传达设计专业教学安排

本学期教学安排如下，请相关师生留意。

## 课程重点

- 低年级：造型基础与构成训练
- 高年级：品牌设计、信息设计综合课题

## 时间节点

详见教务系统发布的最新周历表。

> 如有调整，以学院最新通知为准。
`,
      is_featured: 0,
    },
  ]

  for (const a of articles) {
    await conn.query(
      `INSERT INTO articles
       (category_id, title, title_en, summary, tags, content, status, is_featured, published_at)
       VALUES (?, ?, ?, ?, ?, ?, 'published', ?, NOW())
       ON DUPLICATE KEY UPDATE title = VALUES(title)`,
      [a.category_id, a.title, a.title_en, a.summary, a.tags, a.content, a.is_featured]
    )
  }

  await conn.end()
  console.log('✅ 种子数据写入完成（板块×3、管理员×1、示例文章×3）')
}

main().catch((e) => {
  console.error('❌ 种子数据写入失败:', e)
  process.exit(1)
})
