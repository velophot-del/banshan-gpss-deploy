export interface Category {
  id: number
  slug: string
  name: string
  name_en: string
  sort_order: number
  article_count: number
}

export interface Article {
  id: number
  category_id: number
  title: string
  title_en: string
  summary: string
  cover_url: string
  content?: string
  tags: string
  author: string
  status: 'draft' | 'published'
  is_featured: number
  published_at: string | null
  created_at: string
  updated_at?: string
  category_slug?: string
  category_name?: string
  category_name_en?: string
  prev?: { id: number; title: string } | null
  next?: { id: number; title: string } | null
}

export interface Paginated<T> {
  list: T[]
  pagination: { total: number; page: number; pageSize: number; totalPages: number }
}

export interface SiteSettings {
  site_name: string
  site_name_en: string
  gpss_url: string
}
