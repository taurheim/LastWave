<template>
  <span>
    {{ title }}:
    <input type="text" v-bind:value="defaultValue" @keyup="optionChanged($event.target.value)">
  </span>
</template>
<script lang="ts">
import Vue from 'vue'
import OptionBase from './OptionBase.vue';

export default Vue.extend({
  extends: OptionBase,
  props: ["title", "defaultValue"],
})
</script>
