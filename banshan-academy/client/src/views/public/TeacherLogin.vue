<template><main class="login"><div class="card"><router-link to="/cases">← 返回案例库</router-link><p class="eyebrow">TEACHER ACCESS</p><h1>教师资源登录</h1><p class="hint">登录后可查看有权限的教学指导手册及配套材料。</p><form @submit.prevent="submit"><label>教师账号<input v-model="username" autocomplete="username" required></label><label>密码<input v-model="password" type="password" autocomplete="current-password" required></label><button :disabled="loading">{{ loading ? '登录中…' : '登录' }}</button></form><p class="small">教师账号由案例库管理员创建，不开放自行注册。</p></div></main></template>
<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { teacherApi } from '../../api'
const router = useRouter(), username = ref(''), password = ref(''), loading = ref(false)
async function submit(){ loading.value=true; try{const result=await teacherApi.login(username.value,password.value);localStorage.setItem('banshan_token',result.token);localStorage.setItem('banshan_role',result.user.role);ElMessage.success('登录成功');router.push('/teacher/cases')}catch(e:any){ElMessage.error(e.response?.data?.message||'登录失败')}finally{loading.value=false} }
</script>
<style scoped>.login{min-height:72vh;display:grid;place-items:center;padding:30px}.card{width:min(100%,430px);padding:38px;border:1px solid var(--c-line)}.card>a,.small{font-size:12px;color:var(--c-muted)}.eyebrow{margin-top:35px;font-size:11px;letter-spacing:.14em;color:var(--c-muted)}h1{font-size:28px;margin:10px 0}.hint{font-size:13px;color:var(--c-muted);line-height:1.8}.card form{margin:24px 0;display:grid;gap:16px}.card label{font-size:12px;display:grid;gap:7px}.card input{height:42px;padding:0 10px;border:1px solid var(--c-line)}button{height:44px;background:#20201e;color:white;border:0;cursor:pointer}.small{line-height:1.6}</style>
