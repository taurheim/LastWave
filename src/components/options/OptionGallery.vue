<template>
<div>
  <VueSelectImage :dataImages="dataImages" :selectedImages="selectedImages" @onselectimage="onSelectImage" :useLabel="true">
  </VueSelectImage>
</div>
</template>
<style>
  li.vue-select-image__item {
    margin: 0 5px 0 5px;
  }
  .vue-select-image {
    margin-left: auto;
    margin-right: auto;
  }
  .vue-select-image__thumbnail--selected {
    /* TODO SASS */
    background-color: rgba(64, 196, 255, 0.3);
  }
  .vue-select-image__thumbnail {
    border-radius: 0px;
    border: 0;
  }
  .vue-select-image__wrapper {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
  }
</style>
<script lang="ts">
import Vue from 'vue';
import OptionBase from './OptionBase.vue';
import VueSelectImage from 'vue-select-image';
import 'vue-select-image/dist/vue-select-image.css';
import ImageChoiceOption from '@/models/options/ImageChoiceOption';

export default Vue.extend({
  extends: OptionBase,
  components: {
    VueSelectImage,
  },
  computed: {
    dataImages() {
      return ((this as any).optionData as ImageChoiceOption).choices.map( (image) => {
        return {
          id: image.alias,
          src: image.path,
        };
      });
    },
    selectedImages() {
      return [
        {
          id: ((this as any).optionData as ImageChoiceOption).defaultValue,
        },
      ];
    },
  },
  methods: {
    onSelectImage(s: any) {
      (this as any).currentValue = s.id;
    },
  },
});
</script>
