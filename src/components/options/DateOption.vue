<template>
  <span>
    {{ option.title }}:
    <input type="text" v-bind:value="option.defaultValue" @keyup="optionChanged($event.target.value)">
  </span>
</template>
<script lang="ts">
import Vue from 'vue'
import OptionBase from './OptionBase.vue';

export default Vue.extend({
  extends: OptionBase,
})
</script>
