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
  props: ["title", "options", "defaultValue", "owner"],
  mounted() {
    this.optionChanged(this.$props.defaultValue);
  },
  methods: {
    optionChanged: function(newValue: any) {
      switch(this.$props.owner) {
        case "dataSource":
          store.commit('updateDataSourceOption', {
            title: this.$props.title,
            value: newValue,
          });
        break;
        case "renderer":
          store.commit('updateRendererOption', {
            title: this.$props.title,
            value: newValue,
          });
        break;
      }
    }
  },
})
</script>
