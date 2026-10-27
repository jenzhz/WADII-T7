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
const registerForm = reactive({
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
})

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
  <section class="row justify-content-center">
    <div class="col-xl-10">
      <div class="row g-4 align-items-start">
        <div class="col-lg-5">
          <p class="text-uppercase text-primary fw-semibold small mb-2">Your account</p>
          <h1 class="h2 mb-3">Login or create an account</h1>
          <p class="text-secondary">
            Sign in to search, compare, and save Singapore carparks.
          </p>
        </div>

        <div class="col-lg-7">
          <div class="card shadow-sm">
            <div class="card-body">
              <div class="nav nav-pills nav-fill mb-4" role="tablist" aria-label="Account options">
                <button
                  class="nav-link"
                  :class="{ active: activeForm === 'login' }"
                  type="button"
                  @click="switchForm('login')"
                >
                  Login
                </button>
                <button
                  class="nav-link"
                  :class="{ active: activeForm === 'register' }"
                  type="button"
                  @click="switchForm('register')"
                >
                  Register
                </button>
              </div>

              <div
                v-if="notice.message"
                class="alert"
                :class="`alert-${notice.type}`"
                role="status"
              >
                {{ notice.message }}
              </div>

              <form v-if="activeForm === 'login'" @submit.prevent="submitLogin">
                <div class="mb-3">
                  <label class="form-label" for="login-email">Email address</label>
                  <input
                    id="login-email"
                    v-model.trim="loginForm.email"
                    class="form-control"
                    type="email"
                    autocomplete="email"
                    required
                  />
                </div>
                <div class="mb-4">
                  <label class="form-label" for="login-password">Password</label>
                  <input
                    id="login-password"
                    v-model="loginForm.password"
                    class="form-control"
                    type="password"
                    autocomplete="current-password"
                    required
                  />
                </div>
                <button class="btn btn-primary w-100" type="submit" :disabled="isSubmitting">
                  {{ isSubmitting ? 'Logging in…' : 'Login' }}
                </button>
              </form>

              <form v-else @submit.prevent="submitRegistration">
                <div class="mb-3">
                  <label class="form-label" for="register-name">Name</label>
                  <input
                    id="register-name"
                    v-model.trim="registerForm.name"
                    class="form-control"
                    type="text"
                    autocomplete="name"
                    required
                  />
                </div>
                <div class="mb-3">
                  <label class="form-label" for="register-email">Email address</label>
                  <input
                    id="register-email"
                    v-model.trim="registerForm.email"
                    class="form-control"
                    type="email"
                    autocomplete="email"
                    required
                  />
                </div>
                <div class="mb-3">
                  <label class="form-label" for="register-password">Password</label>
                  <input
                    id="register-password"
                    v-model="registerForm.password"
                    class="form-control"
                    type="password"
                    minlength="8"
                    autocomplete="new-password"
                    required
                  />
                  <div class="form-text">Use at least 8 characters.</div>
                </div>
                <div class="mb-4">
                  <label class="form-label" for="confirm-password">Confirm password</label>
                  <input
                    id="confirm-password"
                    v-model="registerForm.confirmPassword"
                    class="form-control"
                    type="password"
                    minlength="8"
                    autocomplete="new-password"
                    required
                  />
                </div>
                <button class="btn btn-primary w-100" type="submit" :disabled="isSubmitting">
                  {{ isSubmitting ? 'Creating account…' : 'Create account' }}
                </button>
              </form>
            </div>
          </div>

        </div>
      </div>
    </div>
  </section>
</template>

