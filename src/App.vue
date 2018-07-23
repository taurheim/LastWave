<template>
  <div id="app">
    <img src="@/assets/logo.png">
    <div id="nav">
      <router-link to="/">Home</router-link> |
      <router-link to="/gallery">Gallery</router-link> |
      <router-link to="/about">About</router-link>
    </div>
    <router-view/>
  </div>
</template>

<style lang="scss">
@import "~vue-material/dist/theme/engine"; // Import the theme engine

@include md-register-theme("default", (
  primary: md-get-palette-color(blue, A200), // The primary color of your application
  accent: md-get-palette-color(red, A200) // The accent or secondary color
));

@import "~vue-material/dist/theme/all"; // Apply the theme
</style>
