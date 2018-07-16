<template>
  <span>
    {{ title }}: 
    <select>
      <option v-for="opt in options" :key="opt">
        {{ opt }}
      </option>
    </select>
  </span>
</template>
<script lang="ts">
import Vue from 'vue'
export default Vue.extend({
  props: ["title", "options"],
})
</script>
