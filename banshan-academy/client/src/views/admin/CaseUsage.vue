<template><div class="page"><div class="head"><div><h2>课堂使用记录</h2><p>教师提交的案例教学实践登记</p></div><el-tag>共 {{ total }} 条</el-tag></div><el-table :data="rows" v-loading="loading" stripe><el-table-column prop="used_at" label="使用日期" width="120"/><el-table-column prop="case_code" label="案例编号" width="140"/><el-table-column prop="title" label="案例标题" min-width="180"/><el-table-column prop="class_name" label="班级"/><el-table-column prop="teacher_name" label="教师"/><el-table-column prop="teaching_form" label="教学形式"/><el-table-column prop="teaching_hours" label="学时" width="80"/><el-table-column prop="student_count" label="学生数" width="90"/><el-table-column prop="satisfaction" label="满意度" width="90"/><el-table-column prop="feedback_summary" label="课堂反馈" min-width="180"/></el-table><div class="note">记录用于案例复盘与后续修订；教师账号只能查看自己的登记，管理员可查看全部。</div></div></template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { caseAdminApi } from '../../api'
const rows=ref<any[]>([]),total=ref(0),loading=ref(false)
onMounted(async()=>{loading.value=true;try{const result=await caseAdminApi.usageRecords({page:1,pageSize:100});rows.value=result.list;total.value=result.pagination.total}finally{loading.value=false}})
</script>
<style scoped>.page{padding:22px;background:#fff}.head{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}.head h2{margin:0}.head p,.note{font-size:13px;color:#777}.note{padding-top:16px}</style>
