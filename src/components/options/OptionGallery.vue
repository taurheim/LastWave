<template>
<div>
  <VueSelectImage :dataImages="dataImages" :selectedImages="selectedImages" @onselectimage="onSelectImage" :useLabel="true">
  </VueSelectImage>
</div>
</template>
<style>
  li.vue-select-image__item {
    margin: 0 12px 12px 0;
  }
  .vue-select-image {
    width: 800px;
    margin-left: auto;
    margin-right: auto;
  }
  .vue-select-image__thumbnail--selected {
    /* TODO SASS */
    background-color: rgba(64, 196, 255, 0.3);
  }
</style>
<script lang="ts">
import Vue from 'vue';
import OptionBase from './OptionBase.vue';
import VueSelectImage from 'vue-select-image'
import 'vue-select-image/dist/vue-select-image.css';

export default Vue.extend({
  extends: OptionBase,
  components: {
    VueSelectImage,
  },
  data() {
    return {
      selectedImages: [
        {
          id: 'lastwave',
          src: 'https://savas.ca/lastwave/images/examples/lastwave.png',
          alt: 'LastWave'
        },
      ],
      dataImages: [
        {
          id: 'lastwave',
          src: 'https://savas.ca/lastwave/images/examples/lastwave.png',
          alt: 'LastWave'
        },
        {
          id: '1',
          src: 'https://savas.ca/lastwave/images/examples/lastwave.png',
          alt: 'Theme Name Here'
        },
        {
          id: '2',
          src: 'https://savas.ca/lastwave/images/examples/lastwave.png',
          alt: 'Theme Name Here'
        },
        {
          id: '3',
          src: 'https://savas.ca/lastwave/images/examples/lastwave.png',
          alt: 'Theme Name Here'
        },
        {
          id: '4',
          src: 'https://savas.ca/lastwave/images/examples/lastwave.png',
          alt: 'Theme Name Here'
        },
        {
          id: '5',
          src: 'https://savas.ca/lastwave/images/examples/lastwave.png',
          alt: 'Theme Name Here'
        },
      ],
    };
  },
  methods: {
    onSelectImage(s: any) {
      this.currentValue = s.id;
    }
  }
})
</script>
