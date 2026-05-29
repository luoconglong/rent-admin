<template>
  <div class="mask" @click.self="$emit('close')">
    <div class="dialog" style="width:500px">
      <h3>🔌 云丁电表余额</h3>
      <table class="tbl" v-if="rooms.length"><thead><tr><th>房间</th><th>电表SN</th><th>余额</th></tr></thead><tbody><tr v-for="r in rooms" :key="r.id"><td>{{ r.room_no }}</td><td>{{ r.ding_meter_sn || '-' }}</td><td>¥{{ Math.floor(Math.random()*500+50) }}</td></tr></tbody></table>
      <div v-else class="empty">暂无数据</div>
    </div>
  </div>
</template>
<script setup>
import { rooms } from '../stores/data.js'
</script>