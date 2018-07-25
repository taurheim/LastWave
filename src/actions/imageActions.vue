<template>
  <div>
    <md-dialog-alert
      :md-active.sync="showDialog"
      :md-content="cloudinaryDialogHtml"
    />
    <a
      href-lang="image/svg+xml"
      :href="svgFile"
      title="LastWave.svg"
      download="LastWave.svg"
    >
      <md-button class="md-primary md-raised">
        Download SVG
      </md-button>
    </a>
    <a @click="cloudinaryUpload" href="#">
      <md-button class="md-primary md-raised">
        <md-progress-spinner v-if="uploadInProgress" :md-diameter="20" :md-stroke="3" md-mode="indeterminate"></md-progress-spinner>
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
    cloudinaryDialogHtml: function() {
      const selectAllOnClick = 'this.setSelectionRange(0, this.value.length)';
      const inputHtml = `<input type="text" value="${this.$data.sharingLink}" onClick="${selectAllOnClick}" />`;
      return `Share this wave: <br><br>${inputHtml}`;
    }
  },
  methods:  {
    cloudinaryUpload() {
      if (this.sharingLink === '') {
        this.uploadInProgress = true;
        const api = new CloudinaryAPI();

        // TODO handle errors
        api.uploadBase64Svg(this.svgFile).then((url: string) => {
          this.sharingLink = url.replace('.svg', '.png');
          this.showDialog = true;
          this.uploadInProgress = false;
        });
      } else {
        this.showDialog = true;
      }
    }
  },
})
</script>
