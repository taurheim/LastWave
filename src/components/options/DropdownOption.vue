<template>
<md-field>
  <label>
    {{ optionData.title }}
  </label>
  <md-select v-model="currentValue">
    <md-option v-for="choice in optionData.choices" :key="choice" :value="choice">
      {{ choice }}
    </md-option>
  </md-select>
</md-field>
</template>
<script lang="ts">
import Vue from 'vue';
import OptionBase from './OptionBase.vue';
export default Vue.extend({
  extends: OptionBase,
});
</script>
