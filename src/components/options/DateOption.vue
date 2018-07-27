<template>
  <md-datepicker v-model="currentValue" md-immediately>
    <label>
      {{ optionData.title }}:
    </label>
  </md-datepicker>
</template>
<script lang="ts">
import Vue from 'vue';
import OptionBase from './OptionBase.vue';

export default Vue.extend({
  extends: OptionBase,
});
</script>
