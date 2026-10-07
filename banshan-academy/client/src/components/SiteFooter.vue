<template>
  <footer class="site-footer">
    <div class="container footer-inner">
      <div class="footer-brand">
        <router-link to="/" class="f-brand">半山学堂</router-link>
        <p class="f-en">Banshan Academy · Visual Communication Design</p>
      </div>

      <div class="footer-nav">
        <router-link to="/section/info">设计艺术信息</router-link>
        <router-link to="/cases">教学案例库</router-link>
        <router-link to="/section/frontier">设计前沿研究</router-link>
        <router-link to="/about">关于</router-link>
      </div>

      <div class="footer-gpss">
        <a :href="siteSettings.gpss_url" target="_blank" rel="noopener" class="btn btn-ghost">
          进入毕业设计管理系统
        </a>
      </div>
    </div>

    <div class="container footer-bottom">
      <span>© {{ year }} 半山学堂 Banshan Academy</span>
      <router-link to="/admin/login" class="admin-link">管理入口</router-link>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { siteSettings } from '../stores/site'

const year = new Date().getFullYear()
</script>

<style scoped>
.site-footer {
  background: var(--c-bg-soft);
  border-top: 1px solid var(--c-line);
  margin-top: var(--section-gap);
  padding: 64px 0 28px;
}

.footer-inner {
  display: flex;
  justify-content: space-between;
  gap: 40px;
  flex-wrap: wrap;
}

.f-brand {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.06em;
}

.f-en {
  margin-top: 8px;
  font-family: var(--font-en);
  font-size: 11px;
  letter-spacing: 0.12em;
  color: var(--c-muted);
}

.footer-nav {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.footer-nav a {
  font-size: 13px;
  color: var(--c-ink-soft);
  transition: color 0.25s ease;
}

.footer-nav a:hover {
  color: var(--c-ink);
}

.footer-bottom {
  margin-top: 48px;
  padding-top: 24px;
  border-top: 1px solid var(--c-line);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--c-muted);
}

.admin-link {
  color: var(--c-muted);
  transition: color 0.25s ease;
}

.admin-link:hover {
  color: var(--c-ink);
}

@media (max-width: 768px) {
  .footer-inner {
    flex-direction: column;
    gap: 32px;
  }
}
</style>
