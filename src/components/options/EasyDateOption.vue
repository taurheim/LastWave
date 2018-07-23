<template>
<md-field>
  <label>
    {{ optionData.title }}: 
  </label>
  <md-select v-model="currentValue" v-on:md-selected="choseEasyDate($event)">
    <md-option v-for="(dates, name) in easyDates" :key="name" :value="name">
      {{ name }}
    </md-option>
  </md-select>
</md-field>
</template>
<script lang="ts">
// All of these easy dates are offset from today, in ms
// Each is an array of [FROM_OFFSET, TO_OFFSET]
import EasyDates from '@/config/easyDates.json';
import Vue from 'vue'
import OptionBase from './OptionBase.vue';
import Option from '@/models/Option';


export default Vue.extend({
  extends: OptionBase,
  mounted() {
    const optionData: Option = (<any> this).optionData;
    if (optionData.defaultValue) {
      this.choseEasyDate(optionData.defaultValue as string);
    }
  },
  data() {
    return {
      easyDates: EasyDates,
    }
  },
  methods: {
    choseEasyDate(chosen: string) {
      const optionData: Option = (<any> this).optionData;

      if (!optionData.connectedOptions || optionData.connectedOptions.length !== 2) {
        throw new Error('Not enough connected options');
      }

      const offsets = this.easyDates[chosen];
      const startDateMs = ((new Date()).valueOf() - offsets[0]);
      const endDateMs = ((new Date()).valueOf() - offsets[1]);
      const startDateString = new Date(startDateMs);
      const endDateString = new Date(endDateMs);

      const startDateAlias = optionData.connectedOptions[0].alias;
      const endDateAlias = optionData.connectedOptions[1].alias;

      if ((<any> this).optionData.owner === "dataSource") {
        Vue.set(this.$store.state.dataSourceOptions, startDateAlias, startDateString);
        Vue.set(this.$store.state.dataSourceOptions, endDateAlias, endDateString);
      } else {
        Vue.set(this.$store.state.rendererOptions, startDateAlias, startDateString);
        Vue.set(this.$store.state.rendererOptions, endDateAlias, endDateString);
      }
    }
  }
})
</script>
