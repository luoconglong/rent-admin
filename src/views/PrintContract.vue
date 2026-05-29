<template>
  <div class="mask" @click.self="$emit('close')">
    <div class="dialog" style="width:600px">
      <h3>🖨️ 打印合同</h3>
      <div ref="printRef" style="padding:20px;line-height:2">
        <h2 style="text-align:center">房屋租赁合同</h2>
        <p>甲方：房东</p><p>乙方：{{ contract?.tenantName }}</p><p>房间：{{ contract?.roomNo }}</p><p>月租金：¥{{ contract?.rentAmount }}</p><p>状态：{{ contract?.status }}</p>
      </div>
      <div class="dialog-btns"><button class="btn" @click="$emit('close')">取消</button><button class="btn primary" @click="window.print()">打印</button></div>
    </div>
  </div>
</template>
<script setup>
defineProps({ contract: Object })
</script>