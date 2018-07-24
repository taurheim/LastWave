<template>
<div>
  <select v-model="currentValue" v-on:change="choseEasyDate($event.target.value)">
    <option v-for="(dates, name) in easyDates" :key="name" :value="name">
      {{ name }}
    </option>
  </select>
  </div>
</template>
<style>
select {
  border: 0px;
  height: 64px;
  font-size: 24px;
  width: 250px;
  text-align: center;
}
select:focus {
  outline: thin;
}
option, select {
  font-weight: 300;
  font-family: "Roboto";
}
option {
  font-size: 20px;
}
</style>
<script lang="ts">
// All of these easy dates are offset from today, in ms
// Each is an array of [FROM_OFFSET, TO_OFFSET]
import EasyDates from '@/config/easyDates.json';
import Vue from 'vue'
import OptionBase from './OptionBase.vue';
import Option from '@/models/Option';
import EasyDateOption from '@/models/options/EasyDateOption';
import MODULE from '@/models/MODULE';

export default Vue.extend({
  extends: OptionBase,
  components: {
  },
  mounted() {
    const optionData: EasyDateOption = (this as any).optionData;
    if (optionData.defaultValue) {
      this.choseEasyDate(optionData.defaultValue);
    }
  },
  data() {
    return {
      easyDates: EasyDates,
    };
  },
  methods: {
    choseEasyDate(chosen: string) {
      const optionData: EasyDateOption = (this as any).optionData;

      if (!optionData.linkedDateOptions || optionData.linkedDateOptions.length !== 2) {
        throw new Error('Not enough connected options');
      }

      const offsets = this.easyDates[chosen];
      const startDateMs = ((new Date()).valueOf() - offsets[0]);
      const endDateMs = ((new Date()).valueOf() - offsets[1]);
      const startDateString = new Date(startDateMs);
      const endDateString = new Date(endDateMs);

      const startDateAlias = optionData.linkedDateOptions[0].alias;
      const endDateAlias = optionData.linkedDateOptions[1].alias;

      if (optionData.module === MODULE.DATA_SOURCE) {
        Vue.set(this.$store.state.dataSourceOptions, startDateAlias, startDateString);
        Vue.set(this.$store.state.dataSourceOptions, endDateAlias, endDateString);
      } else {
        Vue.set(this.$store.state.rendererOptions, startDateAlias, startDateString);
        Vue.set(this.$store.state.rendererOptions, endDateAlias, endDateString);
      }
    },
  },
});
</script>
