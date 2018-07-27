<template>
<md-field>
  <label>
    {{ optionData.title }}
  </label>
  <md-input v-model="currentValue">
  </md-input>
</md-field>
</template>
<script lang="ts">
import Vue from 'vue';
import OptionBase from './OptionBase.vue';
export default Vue.extend({
  extends: OptionBase,
});
</script>
