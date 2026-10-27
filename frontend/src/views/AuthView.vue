<script setup>
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { loginAccount, registerAccount } from '@/services/auth'

const route = useRoute()
const router = useRouter()
const activeForm = ref('login')
const isSubmitting = ref(false)
const notice = reactive({ type: '', message: '' })

const loginForm = reactive({ email: '', password: '' })
const registerForm = reactive({ name: '', email: '', password: '', confirmPassword: '' })

function showNotice(type, message) {
  notice.type = type
  notice.message = message
}

function errorMessage(error) {
  return error.response?.data?.message || error.message || 'Unable to complete the request.'
}

function continueToApp() {
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
  router.replace(redirect)
}

function switchForm(form) {
  activeForm.value = form
  showNotice('', '')
}

async function submitLogin() {
  isSubmitting.value = true
  showNotice('', '')
  try {
    await loginAccount(loginForm)
    loginForm.password = ''
    continueToApp()
  } catch (error) {
    showNotice('danger', errorMessage(error))
  } finally {
    isSubmitting.value = false
  }
}

async function submitRegistration() {
  showNotice('', '')
  if (registerForm.password.length < 8) {
    showNotice('danger', 'Password must contain at least 8 characters.')
    return
  }
  if (registerForm.password !== registerForm.confirmPassword) {
    showNotice('danger', 'Passwords do not match.')
    return
  }

  isSubmitting.value = true
  try {
    await registerAccount(registerForm)
    continueToApp()
  } catch (error) {
    showNotice('danger', errorMessage(error))
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <section class="auth-page">
    <div class="auth-brand-panel">
      <div class="auth-brand">
        <span class="auth-brand-mark">P</span>
        <span>Carpark<span>Compare</span>SG</span>
      </div>

      <div class="brand-copy">
        <p class="brand-eyebrow">Your account</p>
        <h1>Less searching.<br><span>Easier parking.</span></h1>
        <p>Sign in to search, compare, and save Singapore carparks.</p>
      </div>

      <p class="brand-source">Live availability from LTA DataMall</p>
      <div class="road-line" aria-hidden="true"></div>
      <div class="road-curve" aria-hidden="true"></div>
    </div>

    <div class="parking-connector" aria-hidden="true"><span>P</span></div>

    <div class="auth-form-panel">
      <div class="auth-form-wrap">
        <h2>{{ activeForm === 'login' ? 'Welcome back' : 'Create your account' }}</h2>

        <div class="auth-tabs" role="tablist" aria-label="Account options">
          <button :class="{ active: activeForm === 'login' }" type="button" @click="switchForm('login')">Login</button>
          <button :class="{ active: activeForm === 'register' }" type="button" @click="switchForm('register')">Register</button>
        </div>

        <div v-if="notice.message" class="alert" :class="`alert-${notice.type}`" role="status">
          {{ notice.message }}
        </div>

        <form v-if="activeForm === 'login'" @submit.prevent="submitLogin">
          <div class="field-group">
            <label for="login-email">Email address</label>
            <input id="login-email" v-model.trim="loginForm.email" type="email" autocomplete="email"
              placeholder="you@example.com" required />
          </div>
          <div class="field-group">
            <label for="login-password">Password</label>
            <input id="login-password" v-model="loginForm.password" type="password" autocomplete="current-password"
              placeholder="Your password" required />
          </div>
          <button class="auth-submit" type="submit" :disabled="isSubmitting">
            {{ isSubmitting ? 'Logging in…' : 'Login' }}
          </button>
        </form>

        <form v-else @submit.prevent="submitRegistration">
          <div class="field-group">
            <label for="register-name">Name</label>
            <input id="register-name" v-model.trim="registerForm.name" type="text" autocomplete="name"
              placeholder="Your name" required />
          </div>
          <div class="field-group">
            <label for="register-email">Email address</label>
            <input id="register-email" v-model.trim="registerForm.email" type="email" autocomplete="email"
              placeholder="you@example.com" required />
          </div>
          <div class="field-group">
            <label for="register-password">Password</label>
            <input id="register-password" v-model="registerForm.password" type="password" minlength="8"
              autocomplete="new-password" placeholder="At least 8 characters" required />
          </div>
          <div class="field-group">
            <label for="confirm-password">Confirm password</label>
            <input id="confirm-password" v-model="registerForm.confirmPassword" type="password" minlength="8"
              autocomplete="new-password" placeholder="Repeat your password" required />
          </div>
          <button class="auth-submit" type="submit" :disabled="isSubmitting">
            {{ isSubmitting ? 'Creating account…' : 'Create account' }}
          </button>
        </form>
      </div>
    </div>
  </section>
</template>

<style scoped>
.auth-page {
  position: relative;
  display: grid;
  min-height: 100vh;
  grid-template-columns: 1fr 1fr;
  overflow: hidden;
  color: #071c18;
}

.auth-brand-panel {
  position: relative;
  display: flex;
  min-height: 100vh;
  flex-direction: column;
  padding: clamp(2rem, 5vw, 4rem);
  overflow: hidden;
  color: white;
  background: #073f32;
}

.auth-brand {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: .65rem;
  font-size: 1rem;
  font-weight: 650;
}

.auth-brand > span:last-child span { color: #2cd790; }
.auth-brand-mark {
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border-radius: .55rem;
  color: #073f32;
  background: white;
  font-weight: 800;
}

.brand-copy {
  position: relative;
  z-index: 2;
  width: min(34rem, 90%);
  margin-block: auto;
}

.brand-eyebrow {
  margin-bottom: .75rem;
  color: #2cd790;
  font-size: .78rem;
  font-weight: 800;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.brand-copy h1 {
  font-size: clamp(2.5rem, 5vw, 4.8rem);
  line-height: .98;
  letter-spacing: -.055em;
}

.brand-copy h1 span { color: #2cd790; }
.brand-copy > p:last-child { max-width: 28rem; margin-top: 1.25rem; font-size: 1.05rem; line-height: 1.5; }
.brand-source { position: relative; z-index: 2; margin: 0; color: #b6ead5; font-size: .78rem; }

.road-line {
  position: absolute;
  top: 28%;
  right: -4rem;
  width: 65%;
  height: 1.5rem;
  border-block: .4rem solid #168063;
  background: #2cd790;
  opacity: .72;
}

.road-curve {
  position: absolute;
  right: 31%;
  bottom: 24%;
  width: 10rem;
  height: 10rem;
  border-right: 1.5rem solid #168063;
  border-bottom: 1.5rem solid #168063;
  border-radius: 0 0 7rem 0;
  opacity: .5;
}

.parking-connector {
  position: absolute;
  z-index: 5;
  top: 28%;
  left: 50%;
  display: grid;
  width: 5.25rem;
  height: 5.25rem;
  transform: translate(-50%, -35%);
  place-items: center;
  border-radius: 50%;
  color: #073f32;
  background: #2cd790;
  box-shadow: 0 0 0 .6rem #073f32;
  font-size: 2.6rem;
  font-weight: 800;
}

.auth-form-panel {
  display: grid;
  min-height: 100vh;
  padding: 3rem clamp(1.5rem, 8vw, 7rem);
  place-items: center;
  background-color: #f0fbf6;
  background-image: radial-gradient(#bfe9d7 1.2px, transparent 1.2px);
  background-size: 18px 18px;
}

.auth-form-wrap { width: min(100%, 27rem); }
.auth-form-wrap h2 { margin-bottom: 1.5rem; font-size: clamp(2rem, 4vw, 3rem); font-weight: 750; letter-spacing: -.04em; }
.auth-tabs { display: grid; grid-template-columns: 1fr 1fr; margin-bottom: 1.5rem; padding: .3rem; border-radius: .85rem; background: #e4ecef; }
.auth-tabs button { padding: .7rem 1rem; border: 1px solid transparent; border-radius: .65rem; color: #344559; background: transparent; font-weight: 650; }
.auth-tabs button.active { border-color: #07875f; color: #06271f; background: #2cd790; box-shadow: 0 2px 8px #07875f22; }
.field-group { display: grid; gap: .45rem; margin-bottom: 1.15rem; }
.field-group label { font-size: .82rem; font-weight: 700; }
.field-group input { width: 100%; min-height: 3.2rem; padding: .8rem 1rem; border: 1.5px solid #285849; border-radius: .8rem; outline: 0; background: rgba(255, 255, 255, .88); }
.field-group input:focus { border-color: #0a9e70; box-shadow: 0 0 0 .22rem #2cd7902e; }
.auth-submit { width: 100%; min-height: 3.2rem; margin-top: .35rem; border: 1px solid #07875f; border-radius: .8rem; color: #06271f; background: #2cd790; font-weight: 750; box-shadow: 0 5px 14px #07875f20; }
.auth-submit:hover:not(:disabled) { background: #25c985; transform: translateY(-1px); }
.auth-submit:disabled { cursor: wait; opacity: .65; }
.alert { border-radius: .75rem; font-size: .88rem; }

@media (max-width: 850px) {
  .auth-page { grid-template-columns: 1fr; overflow: visible; }
  .auth-brand-panel { min-height: 20rem; padding: 2rem; }
  .brand-copy { margin-block: 3rem 1.5rem; }
  .brand-copy h1 { font-size: clamp(2.5rem, 11vw, 4rem); }
  .brand-source, .road-curve { display: none; }
  .road-line { top: auto; right: -10%; bottom: 0; }
  .parking-connector { display: none; }
  .auth-form-panel { min-height: auto; padding-block: 3.5rem; }
}
</style>
