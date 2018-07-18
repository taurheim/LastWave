<template>
</template>
<script lang="ts">
import Vue from 'vue'
import store from '@/store';
import LastFm from '@/datasources/lastfm';
import Option from '@/models/Option';

export default Vue.extend({
  // Include all possible props
  // Title:
  // Options:
  // DefaultValue:
  // Owner: "renderer" or "dataSource"
  props: ["option", "owner"],
  created() {
    // Set the default value
    let defaultValue = this.$props.option.defaultValue;
    if (this.$route.query[this.$props.option.alias]) {
      // Can be provided in url
      defaultValue = this.$route.query[this.$props.option.alias];
    }

    this.optionData = this.$props.option;
    this.optionData.defaultValue = defaultValue;

    // Set the default value in the data store
    let dataStore;
    if (this.$props.owner === "renderer") {
      dataStore = this.$store.state.rendererOptions;
    } else {
      dataStore = this.$store.state.dataSourceOptions;
    }
    Vue.set(dataStore, this.optionData.alias, defaultValue);
  },
  computed: {
    currentValue(): string {
      const alias = this.$props.option.alias;
      let currentValue;
      if (this.$props.owner === "renderer") {
        currentValue = (<any> store).state.rendererOptions[this.optionData.alias];
      } else {
        currentValue = (<any> store).state.dataSourceOptions[this.optionData.alias];
      }

      console.log("Current value: " + currentValue);
      return currentValue;
    },
    demoValue(): string {
      return (<any> store).state.demo[this.optionData.alias];
    }
  },
  data(): {[key: string]: any} {
    return {
      optionData: {},
    }
  },
  methods: {
    setOption: function(option: Option) {
      this.optionData = option;
    },
    optionChanged: function(newValue: any) {
      switch(this.$props.owner) {
        case "dataSource":
          Vue.set(this.$store.state.dataSourceOptions, this.optionData.alias, newValue);
        break;
        case "renderer":
          Vue.set(this.$store.state.rendererOptions, this.optionData.alias, newValue);
        break;
      }
    }
  },
})
</script>
