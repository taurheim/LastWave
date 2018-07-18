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
  mounted() {
    // Set the default value
    let defaultValue = this.$props.option.defaultValue;
    if (this.$route.query[this.$props.option.alias]) {
      // Can be provided in url
      defaultValue = this.$route.query[this.$props.option.alias];
    }

    this.optionData = this.$props.option;
    this.optionData.defaultValue = defaultValue;
    
    // Broadcast default value
    this.optionChanged(this.optionData.defaultValue);
  },
  data(): any {
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
          store.commit('updateDataSourceOption', {
            alias: this.$props.option.alias,
            value: newValue,
          });
        break;
        case "renderer":
          store.commit('updateRendererOption', {
            alias: this.$props.option.alias,
            value: newValue,
          });
        break;
      }
    }
  },
})
</script>
