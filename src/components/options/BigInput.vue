<template>
  <input v-model="currentValue" :placeholder="optionData.title">
</template>
<style>
/* TODO use SCSS */
  input {
    height: 75px;
    width: 400px;
    font-weight: 300;
    font-size: 32px;
    text-align: center;
    font-family: "Roboto";
    border: 1px solid rgba(64, 196, 255, .5);
  }
  input:focus {
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
