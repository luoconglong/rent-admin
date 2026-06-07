<template>
  <div class="login-page">
    <div class="login-card">
      <h1>🏢 租务小帮手</h1>
      <p class="subtitle">登录管理后台</p>
      <div class="tab-bar">
        <span :class="['tab', { active: mode === 'email' }]" @click="mode = 'email'">邮箱登录</span>
        <span :class="['tab', { active: mode === 'phone' }]" @click="mode = 'phone'">手机登录</span>
      </div>
      <div v-if="mode === 'email'">
        <input v-model="email" class="input" placeholder="邮箱地址" />
        <input v-model="password" class="input" type="password" placeholder="密码" />
        <button class="btn primary full" @click="loginWithEmail" :disabled="loading">{{ loading ? '登录中...' : '登录' }}</button>
        <p class="link" @click="showRegister = !showRegister">{{ showRegister ? '已有账号？去登录' : '没有账号？去注册' }}</p>
        <div v-if="showRegister">
          <input v-model="restoreCode" class="input" placeholder="恢复码（选填）" />
          <button class="btn full" @click="register" :disabled="loading">注册</button>
        </div>
      </div>
      <div v-if="mode === 'phone'">
        <input v-model="phone" class="input" placeholder="手机号 (+86)" />
        <div v-if="!otpSent">
          <button class="btn primary full" @click="sendOTP" :disabled="loading">发送验证码</button>
        </div>
        <div v-else>
          <input v-model="otp" class="input" placeholder="验证码" />
          <input v-model="restoreCode2" class="input" placeholder="恢复码（首次登录必填）" />
          <button class="btn primary full" @click="verifyOTP" :disabled="loading">验证登录</button>
        </div>
      </div>
      <p class="error" v-if="errorMsg">{{ errorMsg }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { supabase } from '../supabase.js'

const mode = ref('email')
const email = ref(''), password = ref(''), phone = ref(''), otp = ref('')
const otpSent = ref(false), showRegister = ref(false), loading = ref(false)
const errorMsg = ref(''), restoreCode = ref(''), restoreCode2 = ref('')

async function loginWithEmail() {
  errorMsg.value = ''; loading.value = true
  const { error } = await supabase.auth.signInWithPassword({ email: email.value, password: password.value })
  loading.value = false
  if (error) errorMsg.value = error.message
  else location.reload()
}

async function register() {
  errorMsg.value = ''; loading.value = true
  const { error } = await supabase.auth.signUp({ email: email.value, password: password.value })
  loading.value = false
  if (error) errorMsg.value = error.message
  else {
    errorMsg.value = '注册成功！请登录。'
    showRegister.value = false
  }
}

async function sendOTP() {
  errorMsg.value = ''; loading.value = true
  const { error } = await supabase.auth.signInWithOtp({ phone: '+86' + phone.value })
  loading.value = false
  if (error) errorMsg.value = error.message
  else { otpSent.value = true; errorMsg.value = '验证码已发送' }
}

async function verifyOTP() {
  errorMsg.value = ''; loading.value = true
  const { error } = await supabase.auth.verifyOtp({ phone: '+86' + phone.value, token: otp.value, type: 'sms' })
  loading.value = false
  if (error) errorMsg.value = error.message
  else location.reload()
}
</script>

<style scoped>
.login-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f5f7fb; }
.login-card { background: white; border-radius: 20px; padding: 40px; width: 380px; max-width: 90%; box-shadow: 0 4px 20px rgba(0,0,0,0.06); text-align: center; }
h1 { font-size: 24px; color: #1e6f5c; margin-bottom: 4px; }
.subtitle { color: #94a3b8; margin-bottom: 24px; }
.tab-bar { display: flex; margin-bottom: 20px; background: #f1f5f9; border-radius: 10px; padding: 4px; }
.tab { flex: 1; padding: 8px; border-radius: 8px; cursor: pointer; font-size: 14px; }
.tab.active { background: white; font-weight: 600; color: #1e6f5c; }
.input { display: block; width: 100%; padding: 10px 14px; margin-bottom: 12px; border: 1px solid #e8ecf1; border-radius: 10px; font-size: 14px; outline: none; }
.btn { padding: 10px; border-radius: 10px; border: 1px solid #e8ecf1; background: white; cursor: pointer; font-size: 14px; }
.btn.primary { background: #1e6f5c; color: white; border-color: #1e6f5c; }
.btn.full { width: 100%; margin-top: 4px; }
.link { color: #1e6f5c; cursor: pointer; margin-top: 12px; font-size: 13px; }
.error { color: #dc2626; margin-top: 12px; font-size: 13px; }
</style>