<template>
<md-checkbox v-model="currentValue">
  {{ optionData.title }}
</md-checkbox>
</template>
<script lang="ts">
import Vue from 'vue';
import OptionBase from './OptionBase.vue';
export default Vue.extend({
  extends: OptionBase,
});
</script>
