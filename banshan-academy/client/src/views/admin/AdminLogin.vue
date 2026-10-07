<template>
  <div class="login-page">
    <div class="login-card">
      <router-link to="/" class="back">← 返回前台</router-link>
      <h1 class="login-title">半山学堂</h1>
      <p class="login-sub en-sub">Content Management</p>

      <el-form @submit.prevent="handleLogin" class="login-form">
        <el-form-item>
          <el-input v-model="username" placeholder="用户名" size="large" @keyup.enter="handleLogin" />
        </el-form-item>
        <el-form-item>
          <el-input v-model="password" type="password" placeholder="密码" size="large" show-password @keyup.enter="handleLogin" />
        </el-form-item>
        <el-button type="primary" size="large" class="login-btn" :loading="loading" @click="handleLogin">
          登录
        </el-button>
      </el-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { adminApi } from '../../api'

const router = useRouter()
const username = ref('')
const password = ref('')
const loading = ref(false)

async function handleLogin() {
  if (!username.value || !password.value) {
    ElMessage.warning('请输入用户名和密码')
    return
  }
  loading.value = true
  try {
    const res = await adminApi.login(username.value, password.value)
    localStorage.setItem('banshan_token', res.token)
    localStorage.setItem('banshan_role', res.user.role)
    ElMessage.success('登录成功')
    router.push('/admin/articles')
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '登录失败')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--c-bg-soft);
  padding: 20px;
}

.login-card {
  width: 100%;
  max-width: 380px;
  background: #fff;
  border: 1px solid var(--c-line);
  padding: 48px 40px;
}

.back {
  font-size: 13px;
  color: var(--c-muted);
  transition: color 0.25s ease;
}

.back:hover {
  color: var(--c-ink);
}

.login-title {
  margin-top: 24px;
  font-size: 28px;
  font-weight: 600;
  letter-spacing: 0.08em;
}

.login-sub {
  margin-top: 6px;
  font-size: 12px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.login-form {
  margin-top: 32px;
}

.login-btn {
  width: 100%;
}
</style>
