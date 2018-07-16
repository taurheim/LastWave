<template>
  <span>
    {{ title }}:
    <input type="text" v-if="defaultValue" v-bind:value="defaultValue">
    <input type="text" v-else>
  </span>
</template>
<script lang="ts">
import Vue from 'vue'
export default Vue.extend({
  props: ["title", "defaultValue"],
})
</script>
