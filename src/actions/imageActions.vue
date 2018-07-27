<template>
  <div>
    <md-dialog-alert
      :md-active.sync="showDialog"
      :md-content="cloudinaryDialogHtml"
    />
    <a
      v-if="isDesktop"
      href-lang="image/svg+xml"
      :href="svgFile"
      :title="fileName + '.svg'"
      :download="fileName + '.svg'"
    >
      <md-button class="md-primary md-raised">
        Download SVG
      </md-button>
    </a>
    <a @click="cloudinaryUpload" href="#">
      <md-button class="md-primary md-raised">
        <md-progress-spinner class="md-accent" v-if="uploadInProgress" :md-diameter="20" :md-stroke="3" md-mode="indeterminate"></md-progress-spinner>
        <span v-else>
          Get image link
        </span>
      </md-button>
    </a>
  </div>
</template>
<style scoped>
.md-button {
  display: inline-block;
}
</style>
<script lang="ts">
import Vue from 'vue';
import jQuery from 'jquery';
import CloudinaryAPI from '@/actions/CloudinaryAPI';
import store from '@/store';
import mobile from 'is-mobile';

/*
  These image actions are grouped because they both require a base64
  representation of our image.

  TODO split these into two components with shared state
*/

export default Vue.extend({
  mounted() {
    // Determine the Base64 representation
    const svgWrapperElement = document.getElementById('visualization');
    if (!svgWrapperElement) {
      return;
    }

    const svgElement = svgWrapperElement.getElementsByTagName('svg')[0];
    const svgData = (new XMLSerializer()).serializeToString(svgElement);
    const svgBase64 = Buffer.from(svgData).toString('base64');
    const file = 'data:image/svg+xml;base64,' + svgBase64;
    this.svgFile = file;
  },
  data() {
    return {
      svgFile: '',
      sharingLink: '',
      showDialog: false,
      uploadInProgress: false,
    };
  },
  computed: {
    isDesktop(): boolean {
      return !mobile.isMobile();
    },
    cloudinaryDialogHtml(): string {
      const selectAllOnClick = 'this.setSelectionRange(0, this.value.length)';
      const inputHtml = `<input type="text" value="${this.$data.sharingLink}" onClick="${selectAllOnClick}" />`;
      const directLink = `<a target="_blank" href="${this.$data.sharingLink}">Direct Link</a>`;
      return `Share this wave: <br><br>${inputHtml}<br><br>${directLink}`;
    },
    fileName(): string {
      const username: string = store.state.dataSourceOptions.username;
      const start: Date = store.state.dataSourceOptions.time_start;
      const end: Date = store.state.dataSourceOptions.time_end;
      const startString = start.toLocaleDateString('en-US').replace(/\//g, '-');
      const endString = end.toLocaleDateString('en-US').replace(/\//g, '-');

      return `LastWave_${username}_${startString}_${endString}`;
    },
  },
  methods:  {
    cloudinaryUpload() {
      if (this.sharingLink === '') {
        this.uploadInProgress = true;
        const api = new CloudinaryAPI();

        // TODO handle errors
        // TODO use async/await
        api.uploadBase64Svg(
          this.svgFile,
          this.fileName,
          store.state.rendererOptions.color_scheme,
          store.state.dataSourceOptions.username,
        ).then((url: string) => {
          this.sharingLink = url.replace('.svg', '.png');
          this.showDialog = true;
          this.uploadInProgress = false;
        }).then(() => {
          // TODO telemetry?
        });
      } else {
        this.showDialog = true;
      }
    },
  },
});
</script>
