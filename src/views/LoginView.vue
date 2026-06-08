<template>
  <PublicHomeView />
</template>

<script setup>
import { onMounted } from 'vue'
import PublicHomeView from '@/views/PublicHomeView.vue'
import { useMasterAuth } from '@/composables/useMasterAuth'

onMounted(() => {
  useMasterAuth().initializeSuperAdmin().then(res => console.log('Init SuperAdmin:', res))
})
</script>
