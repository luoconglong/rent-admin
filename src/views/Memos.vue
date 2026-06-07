<template>
  <div>
    <div class="page-head">
      <h2>📝 备忘提醒</h2>
      <button class="btn primary" @click="showForm = true">+ 添加</button>
    </div>

    <div v-if="memos.length === 0" class="empty">暂无备忘</div>
    <div v-for="m in memos" :key="m.id" class="card memo-card" :class="{ done: m.completed }">
      <div class="memo-content" @click="toggle(m)">
        <span class="memo-check">{{ m.completed ? '✅' : '⬜' }}</span>
        <span class="memo-text">{{ m.content }}</span>
      </div>
      <div class="memo-meta">
        <span>{{ formatDate(m.created_at) }}</span>
        <button class="btn-sm danger" @click="del(m.id)">删除</button>
      </div>
    </div>

    <div class="mask" v-if="showForm" @click.self="showForm = false">
      <div class="dialog">
        <h3>添加备忘</h3>
        <div class="form-item"><label>内容</label><input v-model="content" class="input" placeholder="备忘内容" /></div>
        <div class="dialog-btns">
          <button class="btn" @click="showForm = false">取消</button>
          <button class="btn primary" @click="save">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { memos, loadAll } from '../stores/data.js'
import { supabase } from '../supabase.js'

const showForm = ref(false)
const content = ref('')

function formatDate(t) {
  if (!t) return '-'
  return new Date(t).toLocaleDateString('zh-CN')
}

async function save() {
  if (!content.value.trim()) return alert('请输入内容')
  await supabase.from('memos').insert({ content: content.value.trim() })
  content.value = ''
  showForm.value = false
  loadAll()
}

async function toggle(m) {
  await supabase.from('memos').update({ completed: !m.completed }).eq('id', m.id)
  loadAll()
}

async function del(id) {
  if (!confirm('删除备忘？')) return
  await supabase.from('memos').delete().eq('id', id)
  loadAll()
}
</script>

<style scoped>
.memo-card { display: flex; justify-content: space-between; align-items: center; }
.memo-card.done { opacity: 0.5; }
.memo-content { display: flex; align-items: center; gap: 8px; cursor: pointer; flex: 1; }
.memo-check { font-size: 18px; }
.memo-text { font-size: 14px; }
.memo-meta { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #94a3b8; }
</style>