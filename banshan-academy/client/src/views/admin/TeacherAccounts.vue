<template><div class="page"><div class="head"><div><h2>教师账号</h2><p>教师资源采用管理员创建账号，不开放自助注册</p></div></div><el-form inline @submit.prevent="create"><el-form-item label="账号"><el-input v-model="username" placeholder="3–50 位字母、数字或 ._-"/></el-form-item><el-form-item label="初始密码"><el-input v-model="password" type="password" show-password placeholder="至少 12 位"/></el-form-item><el-form-item><el-button type="primary" @click="create">创建账号</el-button></el-form-item></el-form><el-table :data="teachers" v-loading="loading"><el-table-column prop="username" label="账号"/><el-table-column prop="created_at" label="创建时间"/><el-table-column label="状态"><template #default="{row}">{{row.is_active?'启用':'停用'}}</template></el-table-column><el-table-column label="操作"><template #default="{row}"><el-button link :type="row.is_active?'danger':'success'" @click="toggle(row)">{{row.is_active?'停用':'启用'}}</el-button></template></el-table-column></el-table></div></template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { caseAdminApi } from '../../api'
const teachers=ref<any[]>([]),loading=ref(false),username=ref(''),password=ref('')
async function refresh(){loading.value=true;try{teachers.value=(await caseAdminApi.teachers()).list}finally{loading.value=false}}
async function create(){try{await caseAdminApi.createTeacher(username.value,password.value);ElMessage.success('教师账号已创建');username.value='';password.value='';await refresh()}catch(e:any){ElMessage.error(e.response?.data?.message||'创建失败')}}
async function toggle(row:any){try{await caseAdminApi.setTeacherActive(row.id,!row.is_active);ElMessage.success('账号状态已更新');await refresh()}catch(e:any){ElMessage.error(e.response?.data?.message||'更新失败')}}
onMounted(refresh)
</script>
<style scoped>.page{background:#fff;padding:22px}.head{margin-bottom:18px}.head h2{margin:0}.head p{font-size:13px;color:#777}</style>
