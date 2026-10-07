import mysql from 'mysql2/promise'
import dotenv from 'dotenv'
import { resolveDatabaseConfig } from '../config/runtime.js'

dotenv.config()

const DB_NAME = process.env.DB_NAME || 'banshan'

async function main() {
  // 先以「不带数据库」的方式连接，创建数据库
  const baseConfig = resolveDatabaseConfig(process.env, false) as mysql.ConnectionOptions
  const conn = await mysql.createConnection(baseConfig)

  console.log(`创建数据库 ${DB_NAME}（如不存在）...`)
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
  await conn.query(`USE \`${DB_NAME}\``)

  console.log('创建数据表...')

  await conn.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id INT PRIMARY KEY AUTO_INCREMENT,
      slug VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(50) NOT NULL,
      name_en VARCHAR(100) NOT NULL DEFAULT '',
      sort_order INT NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await conn.query(`
    CREATE TABLE IF NOT EXISTS articles (
      id INT PRIMARY KEY AUTO_INCREMENT,
      category_id INT NOT NULL,
      title VARCHAR(200) NOT NULL,
      title_en VARCHAR(200) NOT NULL DEFAULT '',
      summary VARCHAR(500) NOT NULL DEFAULT '',
      cover_url VARCHAR(500) NOT NULL DEFAULT '',
      content MEDIUMTEXT,
      tags VARCHAR(300) NOT NULL DEFAULT '',
      author VARCHAR(100) NOT NULL DEFAULT '半山学堂',
      status ENUM('draft','published') NOT NULL DEFAULT 'draft',
      is_featured TINYINT(1) NOT NULL DEFAULT 0,
      published_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_category (category_id),
      INDEX idx_status (status),
      INDEX idx_published (published_at),
      CONSTRAINT fk_articles_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await conn.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id INT PRIMARY KEY AUTO_INCREMENT,
      username VARCHAR(50) NOT NULL UNIQUE,
      password_hash VARCHAR(100) NOT NULL,
      role ENUM('admin','teacher') NOT NULL DEFAULT 'admin',
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  const ensureAdminColumn = async (name: string, definition: string) => {
    const [rows] = await conn.query<any[]>(
      `SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'admins' AND COLUMN_NAME = ?`,
      [DB_NAME, name]
    )
    if (Number(rows[0]?.count) === 0) {
      try {
        await conn.query(`ALTER TABLE admins ADD COLUMN ${name} ${definition}`)
      } catch (e: any) {
        if (e.code !== 'ER_DUP_FIELDNAME') throw e
      }
    }
  }

  await ensureAdminColumn('role', "ENUM('admin','teacher') NOT NULL DEFAULT 'admin'")
  await ensureAdminColumn('is_active', 'TINYINT(1) NOT NULL DEFAULT 1')

  await conn.query(`
    CREATE TABLE IF NOT EXISTS case_sequences (
      program_code VARCHAR(8) NOT NULL,
      case_year SMALLINT NOT NULL,
      last_number INT NOT NULL DEFAULT 0,
      PRIMARY KEY (program_code, case_year)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await conn.query(`
    CREATE TABLE IF NOT EXISTS cases (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      case_code VARCHAR(32) NOT NULL UNIQUE,
      status ENUM('draft','pending_review','published','retired') NOT NULL DEFAULT 'draft',
      current_version_id BIGINT NULL,
      is_featured TINYINT(1) NOT NULL DEFAULT 0,
      created_by INT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_cases_status (status),
      INDEX idx_cases_featured (is_featured, status),
      CONSTRAINT fk_cases_creator FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await conn.query(`
    CREATE TABLE IF NOT EXISTS case_versions (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      case_id BIGINT NOT NULL,
      version_number INT NOT NULL,
      title VARCHAR(200) NOT NULL,
      case_type VARCHAR(30) NOT NULL,
      course_name VARCHAR(200) NOT NULL DEFAULT '',
      course_module VARCHAR(200) NOT NULL DEFAULT '',
      grade_year VARCHAR(30) NOT NULL DEFAULT '',
      topic_name VARCHAR(200) NOT NULL DEFAULT '',
      project_time VARCHAR(100) NOT NULL DEFAULT '',
      target_audience VARCHAR(100) NOT NULL DEFAULT '',
      introduction TEXT NOT NULL,
      assignment TEXT NOT NULL,
      problem TEXT NOT NULL,
      case_body MEDIUMTEXT NOT NULL,
      teaching_takeaways MEDIUMTEXT NOT NULL,
      teacher_guide_json JSON NOT NULL,
      metadata_json JSON NOT NULL,
      permission_status ENUM('public','campus','classroom','pending') NOT NULL DEFAULT 'pending',
      review_status ENUM('draft','pending_review','approved','rejected','published','superseded') NOT NULL DEFAULT 'draft',
      plagiarism_rate DECIMAL(5,4) NULL,
      body_word_count INT NOT NULL DEFAULT 0,
      last_reviewed_at DATE NULL,
      editor_id INT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_case_version (case_id, version_number),
      INDEX idx_case_course_year_topic (course_name, grade_year, topic_name),
      INDEX idx_case_version_state (review_status, permission_status),
      CONSTRAINT fk_case_version_case FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE RESTRICT,
      CONSTRAINT fk_case_version_editor FOREIGN KEY (editor_id) REFERENCES admins(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await conn.query(`
    CREATE TABLE IF NOT EXISTS case_version_tags (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      version_id BIGINT NOT NULL,
      dimension ENUM('method','theme','source','teaching_mode','difficulty','case_type') NOT NULL,
      tag_value VARCHAR(100) NOT NULL,
      UNIQUE KEY uq_case_version_tag (version_id, dimension, tag_value),
      INDEX idx_case_tag_lookup (dimension, tag_value),
      CONSTRAINT fk_case_tag_version FOREIGN KEY (version_id) REFERENCES case_versions(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await conn.query(`
    CREATE TABLE IF NOT EXISTS case_works (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      version_id BIGINT NOT NULL,
      title VARCHAR(200) NOT NULL,
      author_name VARCHAR(100) NOT NULL DEFAULT '',
      author_statement TEXT NOT NULL,
      medium VARCHAR(100) NOT NULL DEFAULT '',
      description TEXT NOT NULL,
      display_allowed TINYINT(1) NOT NULL DEFAULT 0,
      sort_order INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_case_works_version (version_id, sort_order),
      CONSTRAINT fk_case_work_version FOREIGN KEY (version_id) REFERENCES case_versions(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await conn.query(`
    CREATE TABLE IF NOT EXISTS case_assets (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      version_id BIGINT NOT NULL,
      work_id BIGINT NULL,
      original_name VARCHAR(255) NOT NULL,
      storage_key VARCHAR(100) NOT NULL,
      mime_type VARCHAR(120) NOT NULL,
      file_size BIGINT NOT NULL,
      visibility ENUM('public','teacher','classroom','internal') NOT NULL DEFAULT 'internal',
      rights_status ENUM('confirmed','pending','restricted') NOT NULL DEFAULT 'pending',
      source_note TEXT NOT NULL,
      uploaded_by INT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_case_assets_version (version_id, visibility),
      INDEX idx_case_asset_storage (storage_key),
      CONSTRAINT fk_case_asset_version FOREIGN KEY (version_id) REFERENCES case_versions(id) ON DELETE RESTRICT,
      CONSTRAINT fk_case_asset_work FOREIGN KEY (work_id) REFERENCES case_works(id) ON DELETE RESTRICT,
      CONSTRAINT fk_case_asset_uploader FOREIGN KEY (uploaded_by) REFERENCES admins(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await conn.query(`
    CREATE TABLE IF NOT EXISTS case_reviews (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      version_id BIGINT NOT NULL,
      reviewer_label VARCHAR(100) NOT NULL,
      decision ENUM('approve','revise','reject') NOT NULL,
      comments TEXT NOT NULL,
      reviewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_case_reviews_version (version_id, decision),
      CONSTRAINT fk_case_review_version FOREIGN KEY (version_id) REFERENCES case_versions(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await conn.query(`
    CREATE TABLE IF NOT EXISTS case_usage_records (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      case_id BIGINT NOT NULL,
      version_id BIGINT NOT NULL,
      used_at DATE NOT NULL,
      class_name VARCHAR(150) NOT NULL,
      teacher_name VARCHAR(100) NOT NULL,
      teaching_form VARCHAR(100) NOT NULL,
      teaching_hours DECIMAL(4,1) NOT NULL DEFAULT 0,
      student_count INT NOT NULL DEFAULT 0,
      satisfaction DECIMAL(2,1) NULL,
      feedback_summary TEXT NOT NULL,
      improvement_notes TEXT NOT NULL,
      recorded_by INT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_case_usage (case_id, used_at),
      CONSTRAINT fk_case_usage_case FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE RESTRICT,
      CONSTRAINT fk_case_usage_version FOREIGN KEY (version_id) REFERENCES case_versions(id) ON DELETE RESTRICT,
      CONSTRAINT fk_case_usage_recorder FOREIGN KEY (recorded_by) REFERENCES admins(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await conn.end()
  console.log('✅ 数据库初始化完成')
}

main().catch((e) => {
  console.error('❌ 数据库初始化失败:', e)
  process.exit(1)
})
