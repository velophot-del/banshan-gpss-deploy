<template>
  <header class="site-header">
    <div class="container header-inner">
      <router-link to="/" class="brand">
        <span class="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 32 32" width="26" height="26" fill="none">
            <path d="M4 24 L13 8 L19 18 L22 13 L28 24 Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
          </svg>
        </span>
        <span class="brand-text">
          <strong>半山学堂</strong>
          <em>Banshan Academy</em>
        </span>
      </router-link>

      <nav class="nav" :class="{ open: mobileOpen }">
        <router-link to="/" class="nav-link" exact-active-class="active">首页</router-link>
        <router-link to="/section/info" class="nav-link" active-class="active">设计艺术信息</router-link>
        <router-link to="/cases" class="nav-link" active-class="active">教学案例库</router-link>
        <router-link to="/section/frontier" class="nav-link" active-class="active">设计前沿研究</router-link>
        <router-link to="/about" class="nav-link" active-class="active">关于</router-link>
      </nav>

      <button class="menu-toggle" @click="mobileOpen = !mobileOpen" aria-label="菜单">
        <span :class="{ bar: true, open: mobileOpen }"></span>
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const mobileOpen = ref(false)
</script>

<style scoped>
.site-header {
  position: sticky;
  top: 0;
  z-index: 50;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--c-line);
}

.header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 72px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-mark {
  color: var(--c-accent);
  display: flex;
}

.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.brand-text strong {
  font-size: 17px;
  font-weight: 600;
  letter-spacing: 0.06em;
}

.brand-text em {
  font-style: normal;
  font-family: var(--font-en);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--c-muted);
}

.nav {
  display: flex;
  align-items: center;
  gap: 30px;
}

.nav-link {
  font-size: 14px;
  letter-spacing: 0.04em;
  color: var(--c-ink-soft);
  transition: color 0.25s ease;
  position: relative;
}

.nav-link::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: -4px;
  width: 100%;
  height: 1px;
  background: var(--c-ink);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.25s ease;
}

.nav-link:hover,
.nav-link.active {
  color: var(--c-ink);
}

.nav-link:hover::after,
.nav-link.active::after {
  transform: scaleX(1);
}

.menu-toggle {
  display: none;
  background: none;
  border: none;
  cursor: pointer;
  width: 28px;
  height: 28px;
  position: relative;
}

.menu-toggle .bar {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 1.5px;
  background: var(--c-ink);
  transition: all 0.3s ease;
}

.menu-toggle .bar::before,
.menu-toggle .bar::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: 1.5px;
  background: var(--c-ink);
  transition: all 0.3s ease;
}

.menu-toggle .bar::before {
  top: -7px;
}

.menu-toggle .bar::after {
  top: 7px;
}

.menu-toggle .bar.open {
  background: transparent;
}

.menu-toggle .bar.open::before {
  top: 0;
  transform: rotate(45deg);
}

.menu-toggle .bar.open::after {
  top: 0;
  transform: rotate(-45deg);
}

@media (max-width: 900px) {
  .menu-toggle {
    display: block;
  }

  .nav {
    position: absolute;
    top: 72px;
    left: 0;
    right: 0;
    flex-direction: column;
    align-items: stretch;
    gap: 0;
    background: #fff;
    border-bottom: 1px solid var(--c-line);
    padding: 12px var(--gutter) 20px;
    display: none;
  }

  .nav.open {
    display: flex;
  }

  .nav-link {
    padding: 14px 0;
    border-bottom: 1px solid var(--c-line);
    font-size: 15px;
  }

  .nav-link::after {
    display: none;
  }
}
</style>
