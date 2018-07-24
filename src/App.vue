<template>
  <div id="app">
    <div id="titlebar">
    <img src="@/assets/logo.svg">
    LastWave
    </div>

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
  primary: md-get-palette-color(lightblue, A200), // The primary color of your application
  accent: md-get-palette-color(bluegrey, A200) // The accent or secondary color
));

@import "~vue-material/dist/theme/all"; // Apply the theme

#titlebar {
  font-size: 64px;
  margin: 0px auto 75px auto;
  text-align: center;
  font-weight: 100;
  padding-top: 75px;
}

#titlebar img {
  height: 64px;
}

#nav {
  font-size: 26px;
  margin: 10px 0 30px 0;
  text-align: center;
}

</style>
