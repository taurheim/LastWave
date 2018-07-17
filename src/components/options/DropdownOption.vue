<template>
  <span>
    {{ option.title }}: 
    <select @change="optionChanged($event.target.value)">
      <option v-for="opt in option.options" :key="opt">
        {{ opt }}
      </option>
    </select>
  </span>
</template>
<script lang="ts">
import Vue from 'vue'
import OptionBase from './OptionBase.vue';
export default Vue.extend({
  extends: OptionBase,
})
</script>
