<script setup>
import { onMounted, ref } from 'vue'
import {
  deleteMockAccount,
  ensureMockAccounts,
  listMockAccounts,
  resetMockAccounts,
} from '@/services/mockAuth'

const accounts = ref([])
const message = ref('')

function refreshAccounts() {
  accounts.value = listMockAccounts()
}

onMounted(async () => {
  await ensureMockAccounts()
  refreshAccounts()
})

function removeAccount(account) {
  if (!window.confirm(`Delete the local mock account for ${account.email}?`)) return

  deleteMockAccount(account.id)
  refreshAccounts()
  message.value = 'Mock account deleted from this browser.'
}

async function resetAccounts() {
  await resetMockAccounts()
  refreshAccounts()
  message.value = 'All mock accounts and the local session have been cleared.'
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : 'Never'
}
</script>

<template>
  <section>
    <div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
      <div>
        <p class="text-uppercase text-primary fw-semibold small mb-2">Local development</p>
        <h1 class="h2 mb-2">Mock Accounts</h1>
        <p class="text-secondary mb-0">
          Accounts on this page exist only in this browser's local storage.
        </p>
      </div>
      <RouterLink class="btn btn-outline-primary" to="/login">Back to login</RouterLink>
    </div>

    <div class="alert alert-warning small" role="note">
      Create test accounts through the registration form. Do not use real personal passwords in this development-only system.
    </div>

    <div v-if="message" class="alert alert-success" role="status">{{ message }}</div>

    <div class="card shadow-sm p-0 overflow-hidden">
      <div class="table-responsive">
        <table class="table table-striped align-middle mb-0">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Email</th>
              <th scope="col">Created</th>
              <th scope="col">Last login</th>
              <th scope="col"><span class="visually-hidden">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="account in accounts" :key="account.id">
              <td>{{ account.name }}</td>
              <td>{{ account.email }}</td>
              <td>{{ formatDate(account.createdAt) }}</td>
              <td>{{ formatDate(account.lastLoginAt) }}</td>
              <td class="text-end">
                <button class="btn btn-sm btn-outline-danger" type="button" @click="removeAccount(account)">
                  Delete
                </button>
              </td>
            </tr>
            <tr v-if="accounts.length === 0">
              <td colspan="5" class="text-center text-secondary py-4">No mock accounts found.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <button class="btn btn-secondary mt-3" type="button" @click="resetAccounts">
      Clear all mock accounts
    </button>
  </section>
</template>
