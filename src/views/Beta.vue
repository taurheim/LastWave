<template>
  <div class="beta">
    <h1>What's new</h1>
    At long last, version 3 of LastWave is out, and it's got some banging new features!
    <br><br>
    If you run into any issues (or have any feature requests), please give as much information as possible to niko@savas.ca.
    <h2>1. Group by tag & album</h2>
    The most obvious feature that has been added is grouping by album and tag respectively. They look like this:
    <br>
    <div>
      <img src="@/assets/group-by-album.png">
      Group by album
    </div>
    <div>
      <img src="@/assets/group-by-tag.png">
      Group by tag
    </div>
    <h2>2. High resolution sharing</h2>
    Version 2 used imgur as an upload destination, which necessarily involved compressing images, 
    resulting in larger waves being significantly less pretty. To fix this, I'm using cloudinary 
    as an upload source, which will give you pretty high resolution .png files (or full resolution svgs).
    <br>
    <div>
      <img src="@/assets/low-resolution.png">
      Before (imgur compressed png)
    </div>
    <div>
      <img src="@/assets/high-resolution.png">
      After (cloudinary compressed png)
    </div>
    <div>
      <img src="@/assets/full-resolution.svg">
      After (cloudinary full svg)
    </div>
    <h2>3. Graphical tweak: remove border</h2>
    A small extra checkbox can be found that will allow you to remove borders.
    <br>
    <div>
      <img src="@/assets/with-border.png">
      With border
    </div>
    <div>
      <img src="@/assets/no-border.png">
      Without border
    </div>
    <h2>4. Back-end rewrite</h2>
    While it might not look like it, version 3 is actually a complete rewrite. 
    Version 1 and 2 were both written in native Javascript and jQuery, while version 
    3 uses Vuejs and Typescript. Hopefully with these changes there is more opportunity
    for contribution on the <a href="https://github.com/taurheim/LastWave">GitHub</a> page.
    <h1>What's gone</h1>
    There are a few features that can no longer be found in version 3, notably:
    <ol>
      <li>Some themes have been removed</li>
      <li>Normalizing artist order has been removed (default off for now)</li>
      <li>Scheme creation is not supported</li>
      <li>Text placement has actually gotten slightly worse (but will be fixed soon!)</li>
    </ol>
    If you wish lastwave still had any of these features, please shoot an email to niko@savas.ca.

    <h1>What's next</h1>
    You decide! Send me an email at niko@savas.ca to let me know what features you want added to LastWave.<br>
    Alternatively, contribute to lastwave <a href="https://github.com/taurheim/LastWave">on GitHub</a>.
    <br><br>
    Some features that could be added:
    <ul>
      <li>Tooltips for options to make it more clear what they do</li>
      <li>Links to both the .svg and .png when sharing</li>
      <li>Links to the full resolution in the gallery</li>
      <li>Better tagging (last.fm's tags are pretty mediocre)</li>
      <li>Libre.fm integration (or other services)</li>
      <li>Embed fonts into svg so that more fonts can be supported</li>
    </ul>
  </div>
</template>
<style>
.beta {
  max-width: 1200px;
  padding: 0 10%;
  font-size: 15px;
}

.beta>div {
  display: inline-block;
  text-align: center;
  padding: 10px;
}

.beta img {
  width: 250px;
  display: block;
}
</style>
<script lang="ts">
import Vue from 'vue';
export default Vue.extend({
});
</script>
