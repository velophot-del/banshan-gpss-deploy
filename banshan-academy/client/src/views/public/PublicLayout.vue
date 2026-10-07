<template>
  <div class="public-layout">
    <SiteHeader />
    <main class="page-main">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
    <SiteFooter />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import SiteHeader from '../../components/SiteHeader.vue'
import SiteFooter from '../../components/SiteFooter.vue'
import { ensureSiteSettings } from '../../stores/site'

onMounted(() => {
  ensureSiteSettings()
})
</script>

<style scoped>
.public-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.page-main {
  flex: 1;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
