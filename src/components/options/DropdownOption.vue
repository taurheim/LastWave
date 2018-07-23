<template>
<md-field>
  <label>
    {{ optionData.title }}
  </label>
  <md-select v-model="currentValue">
    <md-option v-for="opt in optionData.options" :key="opt" :value="opt">
      {{ opt }}
    </md-option>
  </md-select>
</md-field>
</template>
<script lang="ts">
import Vue from 'vue'
import OptionBase from './OptionBase.vue';
export default Vue.extend({
  extends: OptionBase,
})
</script>
