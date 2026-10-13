<script setup>
import { onMounted, reactive, ref } from 'vue'
import {
  ensureMockAccounts,
  getMockSession,
  loginMockAccount,
  logoutMockAccount,
  registerMockAccount,
} from '@/services/mockAuth'

const activeForm = ref('login')
const currentUser = ref(null)
const isSubmitting = ref(false)
const notice = reactive({ type: '', message: '' })

const loginForm = reactive({ email: '', password: '' })
const registerForm = reactive({
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
})

onMounted(async () => {
  await ensureMockAccounts()
  currentUser.value = getMockSession()
})

function showNotice(type, message) {
  notice.type = type
  notice.message = message
}

function switchForm(form) {
  activeForm.value = form
  showNotice('', '')
}

async function submitLogin() {
  isSubmitting.value = true
  showNotice('', '')

  try {
    currentUser.value = await loginMockAccount(loginForm)
    loginForm.password = ''
    showNotice('success', `Welcome back, ${currentUser.value.name}.`)
  } catch (error) {
    showNotice('danger', error.message)
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
    await registerMockAccount(registerForm)
    loginForm.email = registerForm.email
    registerForm.name = ''
    registerForm.email = ''
    registerForm.password = ''
    registerForm.confirmPassword = ''
    activeForm.value = 'login'
    showNotice('success', 'Mock account created. You can now log in.')
  } catch (error) {
    showNotice('danger', error.message)
  } finally {
    isSubmitting.value = false
  }
}

function logout() {
  logoutMockAccount()
  currentUser.value = null
  showNotice('success', 'You have logged out of the local mock session.')
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
            This page currently uses local mock accounts so the team can test the user flow before MongoDB authentication is connected.
          </p>

          <RouterLink to="/mock-accounts">View and manage local mock accounts</RouterLink>
        </div>

        <div class="col-lg-7">
          <div v-if="currentUser" class="card shadow-sm">
            <div class="card-body">
              <h2 class="h4">Signed in locally</h2>
              <p class="mb-1"><strong>Name:</strong> {{ currentUser.name }}</p>
              <p><strong>Email:</strong> {{ currentUser.email }}</p>
              <button class="btn btn-outline-danger" type="button" @click="logout">Log out</button>
            </div>
          </div>

          <div v-else class="card shadow-sm">
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

          <div
            v-if="currentUser && notice.message"
            class="alert mt-3"
            :class="`alert-${notice.type}`"
            role="status"
          >
            {{ notice.message }}
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

