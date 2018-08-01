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
    <a @click="downloadPNG" href="#">
      <md-button class="md-primary md-raised">
        Download PNG
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
import canvg from 'canvg';
import FileSaver from 'file-saver';
/*
  Some of the actions we need to perform actually require the svg to be rendered
  on screen. The best solution would be to have some way of actually checking, but
  for now we will just timeout
*/
const SVG_RENDER_WAIT_MS = 100;

/*
  These image actions are grouped because they both require a base64
  representation of our image.

  TODO split these into two components with shared state
*/

export default Vue.extend({
  mounted() {
    setTimeout(this.onSvgRender, SVG_RENDER_WAIT_MS);
  },
  data() {
    return {
      svgFile: '',
      pngBlob: new Blob(),
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
    onSvgRender() {
      const svgWrapperElement = document.getElementById('svg-wrapper');
      if (!svgWrapperElement) {
        return;
      }

      // Determine the Base64 representation
      const svgElement = svgWrapperElement.getElementsByTagName('svg')[0];
      const svgData = (new XMLSerializer()).serializeToString(svgElement);
      const svgBase64 = Buffer.from(svgData).toString('base64');
      const file = 'data:image/svg+xml;base64,' + svgBase64;
      this.svgFile = file;

      // Turn the png into a canvas
      const pngCanvas = document.createElement('canvas');
      const svgHeight = svgElement.getAttribute('height');
      const svgWidth = svgElement.getAttribute('width');
      if (!(svgWidth && svgHeight && svgElement.parentNode)) {
        return;
      }
      pngCanvas.height = parseInt(svgHeight, 10);
      pngCanvas.width = parseInt(svgWidth, 10);
      canvg(pngCanvas, (svgElement.parentNode as Element).innerHTML.trim(), {});
      const dataURL = pngCanvas.toDataURL('image/png');
      const data = atob(dataURL.substring('data:image/png;base64,'.length));
      const asArray = new Uint8Array(data.length);
      for (let i = 0; i < data.length; i++) {
        asArray[i] = data.charCodeAt(i);
      }

      this.pngBlob = new Blob([asArray.buffer], {
        type: 'image/png',
      });

      // Remove the old svg, add canvas to page
      pngCanvas.removeAttribute('style');
      svgWrapperElement.appendChild(pngCanvas);
      svgElement.remove();
    },
    downloadPNG() {
      FileSaver.saveAs(this.pngBlob, `${this.fileName}.png`);
    },
    cloudinaryUpload() {
      if (this.sharingLink === '') {
        this.uploadInProgress = true;
        const api = new CloudinaryAPI();

        // TODO handle errors
        // TODO use async/await
        api.uploadBase64Image(
          this.pngBlob,
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
