<template>
  <span>
    {{ title }}:
    <input type="checkbox" v-if="defaultValue === 'checked'" checked @change="optionChanged($event.target.checked)">
    <input type="checkbox" v-else @change="optionChanged($event.target.checked)">
  </span>
</template>
<script lang="ts">
import Vue from 'vue';
import OptionBase from './OptionBase.vue';
export default Vue.extend({
  extends: OptionBase,
  props: ["title", "defaultValue"],
})
</script>
