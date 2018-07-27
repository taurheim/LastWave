<template>
  <div class="about">
    <h1>What is LastWave?</h1>
    LastWave is a web-app that takes data from your last.fm profile and creates a beautiful
    wave graph that represents your music listening trends by artist, album, or tag. The
    artists that you listen to more at a given time has a larger area on the graph.
    <h1>Who built LastWave?</h1>
    LastWave is written and maintained by <a href="https://savas.ca/">Niko Savas</a>. Swing by my 
    <a href="http://last.fm/user/taurheim">last.fm</a> profile and say hi!
    <h1>Donate to support LastWave</h1>
    Any money donated will go directly to hosting and server costs for LastWave, so that I can keep LastWave
    completely free!
    <br><br>
    Donate here: <a href="http://paypal.me/nikosavas">PayPal</a>

    <h1>Contribute to LastWave</h1>
    If you're a developer who wants a feature or wants to help develop this tool, please swing by this project's
    <a href="https://github.com/taurheim/LastWave">GitHub repository</a> and submit a pull request!

    <h1>Technologies used</h1>
    Version 3 of LastWave is built using <a href="https://vuejs.org/">Vue.js</a> and 
    <a href="https://www.typescriptlang.org">TypeScript</a>. For a full list of dependencies, visit the project's
    <a href="https://github.com/taurheim/LastWave">GitHub</a>.
  </div>
</template>
<style>
.about {
  font-size: 16px;
  max-width: 800px;
  margin: 0 auto;
  padding: 0 10px;
}

.about h1 {
  margin-top: 40px;
  line-height: 30px;
}
</style>
<script lang="ts">
import Vue from 'vue';
export default Vue.extend({
});
</script>
