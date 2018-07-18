<template>
  <span>
    {{ optionData.title }}: 
    <select @change="choseEasyDate($event.target.value)">
      <option v-for="(dates, name) in easyDates" v-bind:key="name">
        {{ name }}
      </option>
    </select>
  </span>
</template>
<script lang="ts">
import Vue from 'vue'
import OptionBase from './OptionBase.vue';

// All of these easy dates are offset from today, in ms
// Each is an array of [FROM_OFFSET, TO_OFFSET]
import EasyDates from '@/config/easyDates.json';

export default Vue.extend({
  extends: OptionBase,
  data() {
    return {
      easyDates: EasyDates,
    }
  },
  methods: {
    choseEasyDate(chosen: string) {
      console.log("Chose easy date!: " + chosen);
    }
  }
})
</script>
