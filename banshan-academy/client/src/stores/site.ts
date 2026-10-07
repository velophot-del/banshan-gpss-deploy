import { ref } from 'vue'
import { publicApi } from '../api'
import type { SiteSettings } from '../types'

export const siteSettings = ref<SiteSettings>({
  site_name: '半山学堂',
  site_name_en: 'Banshan Academy',
  gpss_url: '/gpss/'
})

let loaded = false
export async function ensureSiteSettings() {
  if (loaded) return
  loaded = true
  try {
    const s = await publicApi.getSettings()
    siteSettings.value = s
  } catch {
    // 使用默认值
  }
}
