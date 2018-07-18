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
      this.choseEasyDate(optionData.defaultValue);
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
        return;
      }

      console.log(EasyDates);
      const offsets = this.easyDates[chosen];
      const startDateMs = ((new Date()).valueOf() - offsets[0]);
      const endDateMs = ((new Date()).valueOf() - offsets[1]);
      const startDateString = new Date(startDateMs).toLocaleDateString();
      const endDateString = new Date(endDateMs).toLocaleDateString();

      const startDateAlias = optionData.connectedOptions[0].alias;
      const endDateAlias = optionData.connectedOptions[1].alias;

      if (this.$props.owner === "dataSource") {
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
