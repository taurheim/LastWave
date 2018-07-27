<template>
  <div id="app">
    <div id="titlebar">
      <div class="logo">
        <img src="@/assets/logo.svg">
      </div>
      <div>
        LastWave
        <div class="foot">
          <router-link to="/beta">
            v3 beta
          </router-link>
        </div>
      </div>
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
@import '~@typopro/web-roboto/TypoPRO-Roboto.css';

body {
  font-family: "TypoPRO Roboto", "Open Sans", "Open Sans", sans-serif;
}

#titlebar {
  font-size: 64px;
  margin: 0 auto;
  text-align: center;
  font-weight: 100;
  padding-top: 75px;
}

@media only screen and (max-width: 400px) {
  #titlebar {
    padding-top: 20px;
  }
}

#titlebar>div {
  display: inline-block;
  height: 80px;
}

#titlebar img {
  height: 64px;
}

#titlebar .foot {
  font-size: 20px;
  line-height: 0px; /* Probably shouldn't do this */
  position: relative;
  top: 24px;
}

#nav {
  font-size: 26px;
  margin: 10px 0 30px 0;
  text-align: center;
}

h1, h2 {
  font-weight: 300;
}

</style>
