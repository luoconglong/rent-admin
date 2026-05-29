<template>
  <div>
    <h2>📊 经营概览</h2>
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-num">{{ stats.houseCount }}</div><div class="stat-label">楼栋</div></div>
      <div class="stat-card"><div class="stat-num">{{ stats.roomCount }}</div><div class="stat-label">房间</div></div>
      <div class="stat-card"><div class="stat-num">{{ stats.rentingCount }}</div><div class="stat-label">在住</div></div>
      <div class="stat-card"><div class="stat-num">{{ stats.ownerCount }}</div><div class="stat-label">业主</div></div>
      <div class="stat-card"><div class="stat-num">{{ stats.pendingCount }}</div><div class="stat-label">待收笔数</div></div>
      <div class="stat-card"><div class="stat-num">{{ stats.urgentCount }}</div><div class="stat-label">逾期</div></div>
      <div class="stat-card"><div class="stat-num">¥{{ stats.pendingRent }}</div><div class="stat-label">待收租金</div></div>
      <div class="stat-card"><div class="stat-num">¥{{ stats.pendingPay }}</div><div class="stat-label">待付业主</div></div>
      <div class="stat-card"><div class="stat-num">{{ stats.expiringCount }}</div><div class="stat-label">将到期</div></div>
    </div>

    <div class="card" v-if="expiringList.length">
      <h3>⏳ 30天内到期合同</h3>
      <div v-for="e in expiringList" :key="e.id" class="remind-item">
        <span>{{ e.name }} · {{ e.room }}</span>
        <span class="tag warn">{{ e.end_date }} 到期</span>
      </div>
    </div>

    <div class="card" v-if="urgentBills.length">
      <h3>🚨 逾期账单</h3>
      <div v-for="b in urgentBills" :key="b.id" class="remind-item">
        <span>{{ b.tenant_name || b.tenant_id }}</span>
        <span class="tag warn">¥{{ (b.total_amount || 0) - (b.paid_amount || 0) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { stats, expiringList, urgentBills } from '../stores/data.js'
</script>