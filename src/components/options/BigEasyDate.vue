<template>
<div>
  <select class="big-select" v-model="currentValue" v-on:change="choseEasyDate($event.target.value)">
    <option v-for="(dates, name) in easyDates" :key="name" :value="name">
      {{ name }}
    </option>
  </select>
  </div>
</template>
<style>
.big-select {
  border: 0px;
  height: 64px;
  font-size: 24px;
  width: 250px;
  text-align: center;
  text-align-last: center;
  margin: 10px 0;
}
.big-select:focus {
  outline: thin;
}
.big-select option, .big-select {
  font-weight: 300;
  font-family: "TypoPRO Roboto";
}
.big select option {
  font-size: 20px;
}
</style>
<script lang="ts">
// All of these easy dates are offset from today, in ms
// Each is an array of [FROM_OFFSET, TO_OFFSET]
// TODO Rename this, it's not really just for dates now since there are also other options
import EasyDates from '@/config/easyDates.json';
import Vue from 'vue';
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

      const easyDate = this.easyDates[chosen];
      const offsets = easyDate.offsets;
      const startDateMs = ((new Date()).valueOf() - offsets[0]);
      const endDateMs = ((new Date()).valueOf() - offsets[1]);
      const startDateString = new Date(startDateMs);
      const endDateString = new Date(endDateMs);

      const startDateAlias = optionData.linkedDateOptions[0].alias;
      const endDateAlias = optionData.linkedDateOptions[1].alias;

      let storeState: object;
      if (optionData.module === MODULE.DATA_SOURCE) {
        storeState = this.$store.state.dataSourceOptions;
      } else {
        storeState = this.$store.state.rendererOptions;
      }

      Vue.set(storeState, startDateAlias, startDateString);
      Vue.set(storeState, endDateAlias, endDateString);

      // Set all the other options as well
      Object.keys(easyDate.otherOptions as {[key: string]: string}).forEach((alias) => {
        Vue.set(storeState, alias, easyDate.otherOptions[alias]);
      });
    },
  },
});
</script>
