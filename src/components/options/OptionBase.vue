<template>
</template>
<script lang="ts">
import Vue from 'vue'
import store from '@/store';
import LastFm from '@/datasources/lastfm';

export default Vue.extend({
  // Include all possible props
  // Title:
  // Options:
  // DefaultValue:
  // Owner: "renderer" or "dataSource"
  props: ["option", "owner"],
  mounted() {
    this.optionChanged(this.$props.option.defaultValue);
  },
  methods: {
    optionChanged: function(newValue: any) {
      console.log(this.$props.option.title + " = " + newValue);
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
