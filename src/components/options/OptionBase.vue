<template>
</template>
<script lang="ts">
import Vue from 'vue'
import store from '@/store';
import LastFm from '@/datasources/lastfm';
import Option from '@/models/Option';
import MODULE from '@/models/MODULE';

export default Vue.extend({
  // Include all possible props
  // Title:
  // Options:
  // DefaultValue:
  props: [
    'option',
  ],
  created() {
    // Set the default value
    this.optionData = this.$props.option as Option;
    let defaultValue = this.optionData.defaultValue;
    if (this.$route.query[this.$props.option.alias]) {
      // Can be provided in url
      const urlValue = this.$route.query[this.$props.option.alias];
      defaultValue = this.optionData.convertToOptionType(urlValue);
    }

    this.optionData.defaultValue = defaultValue;

    // Set the default value in the data store
    let dataStore;
    if ((this.optionData as Option).module === MODULE.DATA_SOURCE) {
      dataStore = this.$store.state.dataSourceOptions;
    } else {
      dataStore = this.$store.state.rendererOptions;
    }

    Vue.set(dataStore, this.optionData.alias, defaultValue);
  },
  computed: {
    currentValue: {
      get(): string {
        const alias = this.$props.option.alias;
        let currentValue;
        if ((this.optionData as Option).module === MODULE.DATA_SOURCE) {
          currentValue = (store as any).state.dataSourceOptions[this.optionData.alias];
        } else {
          currentValue = (store as any).state.rendererOptions[this.optionData.alias];
        }

        return currentValue;
      },
      set(newValue: string) {
        if ((this.optionData as Option).module === MODULE.DATA_SOURCE) {
          Vue.set(this.$store.state.dataSourceOptions, this.optionData.alias, newValue);
        } else {
          Vue.set(this.$store.state.rendererOptions, this.optionData.alias, newValue);
        }
      },
    }
  },
  data(): {[key: string]: any} {
    return {
      optionData: {} as Option,
    };
  },
  methods: {
    setOption(option: Option) {
      this.optionData = option;
    },
  },
});
</script>
