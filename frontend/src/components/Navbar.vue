<template>
  <header>
    <a class="skip-link" href="#main-content">Skip to content</a>
    <nav class="navbar navbar-expand-md bg-body-tertiary border-bottom" aria-label="Primary navigation">
      <div class="container">
        <RouterLink class="navbar-brand" to="/">CarparkCompare SG</RouterLink>
        <div class="navbar-nav flex-row flex-wrap gap-3">
          <RouterLink class="nav-link" to="/">Search</RouterLink>
          <RouterLink class="nav-link" to="/map">Map</RouterLink>
          <RouterLink class="nav-link" to="/compare">Compare</RouterLink>
          <RouterLink class="nav-link" to="/favourites">Saved</RouterLink>
          <RouterLink class="btn btn-primary" to="/login">Login / Register</RouterLink>
          <RouterLink class="nav-link" to="/mock-accounts">Mock accounts</RouterLink>
        </div>
      </div>
    </nav>
  </header>
</template>

