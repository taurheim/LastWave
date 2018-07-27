<template>
  <div>
    <md-button class="md-raised" @click="backToOptions">
      &lt; Modify options
    </md-button>
    <md-button class="md-raised" @click="showConfigString">
      Export options
    </md-button>
    <md-dialog-alert
      :md-active.sync="showDialog"
      :md-content="configDialogHtml"/>
  </div>
</template>
<style scoped>
input {
  height: 30px;
  width: 300px;
  font-family: "TypoPRO Roboto";
  border: 1px solid rgba(64, 196, 255, .5);
}
</style>
<style>
.md-dialog {
  -webkit-font-smoothing: subpixel-antialiased;
}

.md-dialog input {
  height: 30px;
  width: 100%;
}
</style>
<script lang="ts">
import Vue from 'vue';
import store from '@/store';
import Option from '@/models/Option';

/*
  This action allows the user to return to the
  exact configuration that created this graph.

  TODO Would be nice to just have it appear inline
  TODO Custom link (Like bit.ly)
*/

export default Vue.extend({
  data() {
    return {
      configString: '',
      showDialog: false,
    };
  },
  computed: {
    configDialogHtml: function() {
      const selectAllOnClick = 'this.setSelectionRange(0, this.value.length)';
      const inputHtml = `<input type="text" value="${this.$data.configString}" onClick="${selectAllOnClick}" />`;
      return `Use this path to share this configuration: <br><br>${inputHtml}`;
    },
  },
  methods: {
    showConfigString() {
      this.$data.showDialog = true;
      let configString = 'https://savas.ca/lastwave#/?';

      const allOptions = Object.assign(
        store.state.rendererOptions,
        store.state.dataSourceOptions,
      );
      Object.keys(allOptions).map((optionName: string) => {
        let optionValue = allOptions[optionName];

        // Compress dates
        if (optionValue instanceof Date) {
          optionValue = optionValue.getTime();
        }

        if (optionValue !== undefined) {
          configString += `${optionName}=${optionValue}`;
          configString += '&';
        }
      });

      this.$data.configString = encodeURI(configString);
    },
    backToOptions() {
      store.commit('showOptions');
      store.commit('hideLoadingBar');
      store.commit('hideActions');
      store.commit('hideVisualization');
    },
  },
});
</script>
