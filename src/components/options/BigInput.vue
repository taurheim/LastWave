<template>
  <input class="big-input" v-model="currentValue" :placeholder="optionData.title">
</template>
<style scoped>
/* TODO use SCSS */
.big-input {
  height: 75px;
  width: 400px;
  max-width: 90%;
  font-weight: 300;
  font-size: 32px;
  text-align: center;
  font-family: "TypoPRO Roboto";
  border: 1px solid rgba(64, 196, 255, 0.5);
}
.big-input:focus {
  border: 1px solid rgba(64, 196, 255, 1);
}
</style>
<script lang="ts">
import Vue from 'vue';
import OptionBase from './OptionBase.vue';

export default Vue.extend({
  extends: OptionBase,
});
</script>
