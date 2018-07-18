<template>
  <span>
    {{ optionData.title }}: 
    <select @change="optionChanged($event.target.value)">
      <option v-for="opt in optionData.options" :key="opt">
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
