<template>
  <div>
    <a
      href-lang="image/svg+xml"
      :href="svgFile"
      title="LastWave.svg"
      download="LastWave.svg"
    >
    Download SVG
    </a>
  </div>
</template>
<script lang="ts">
import Vue from 'vue'
export default Vue.extend({
  mounted() {
    // SVG -> Base64
    const svgWrapperElement = document.getElementById("visualization");
    if (!svgWrapperElement) {
      return;
    }

    const svgElement = svgWrapperElement.getElementsByTagName("svg")[0];
    const svgData = (new XMLSerializer).serializeToString(svgElement);
    const svgBase64 = Buffer.from(svgData).toString("base64");
    const file = "data:image/svg+xml;base64,\n" + svgBase64;
    this.svgFile = file;
  },
  data() {
    return {
      svgFile: "",
    }
  }
})
</script>
