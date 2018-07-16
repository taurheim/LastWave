<template>
  <span>
    {{ title }}:
    <input type="checkbox" v-if="defaultValue === 'checked'" checked>
    <input type="checkbox" v-else>
  </span>
</template>
<script lang="ts">
import Vue from 'vue'
export default Vue.extend({
  props: ["title", "defaultValue"],
})
</script>
