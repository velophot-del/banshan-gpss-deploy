<template>
  <el-container class="admin-layout">
    <el-aside width="200px" class="admin-aside">
      <div class="admin-logo">
        <span>半山学堂</span>
        <em>CMS</em>
      </div>
      <el-menu :default-active="$route.path" router class="admin-menu">
        <el-menu-item index="/admin/articles">
          <el-icon><Document /></el-icon>
          <span>文章管理</span>
        </el-menu-item>
        <el-menu-item index="/admin/cases"><el-icon><Collection /></el-icon><span>教学案例库</span></el-menu-item>
        <el-menu-item index="/admin/teachers"><el-icon><User /></el-icon><span>教师账号</span></el-menu-item>
        <el-menu-item index="/admin/case-usage"><el-icon><DataAnalysis /></el-icon><span>课堂使用记录</span></el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="admin-header">
        <div class="header-title">内容管理后台</div>
        <div class="header-actions">
          <el-button text @click="goFront">返回前台</el-button>
          <el-button text @click="logout">退出登录</el-button>
        </div>
      </el-header>

      <el-main class="admin-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Document, Collection, User, DataAnalysis } from '@element-plus/icons-vue'

const router = useRouter()

function goFront() {
  window.location.href = '/'
}

function logout() {
  localStorage.removeItem('banshan_token')
  localStorage.removeItem('banshan_role')
  router.push('/admin/login')
}
</script>

<style scoped>
.admin-layout {
  height: 100vh;
}

.admin-aside {
  background: #1a1a1a;
  color: #fff;
}

.admin-logo {
  height: 64px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.admin-logo span {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.06em;
}

.admin-logo em {
  font-style: normal;
  font-family: var(--font-en);
  font-size: 10px;
  letter-spacing: 0.2em;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
}

.admin-menu {
  border-right: none;
  background: #1a1a1a;
  --el-menu-text-color: rgba(255, 255, 255, 0.75);
  --el-menu-hover-bg-color: rgba(255, 255, 255, 0.08);
  --el-menu-active-color: #fff;
}

.admin-menu :deep(.el-menu-item.is-active) {
  background: rgba(255, 255, 255, 0.1);
}

.admin-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
}

.header-title {
  font-size: 15px;
  font-weight: 600;
}

.admin-main {
  background: #f6f8fa;
}
</style>
