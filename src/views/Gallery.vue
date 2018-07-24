<template>
  <div class="gallery">
    <gallery :images="thisPageImages" :index="index" @close="index = null"></gallery>
    <div
      class="image"
      v-for="(image, imageIndex) in thisPageImages"
      :key="imageIndex"
      @click="index = imageIndex"
      :style="{ backgroundImage: 'url(' + image + ')', width: '300px', height: '200px' }"
    ></div>
  </div>
</template>

<style scoped>
.image {
  float: left;
  background-size: cover;
  background-repeat: no-repeat;
  background-position: center center;
  border: 1px solid #ebebeb;
  margin: 5px;
}
</style>


<script lang="ts">
import Vue from 'vue';
import VueGallery from 'vue-gallery';
import jQuery from 'jquery';

const IMAGES_PER_PAGE = 20;

export default Vue.extend({
  mounted() {
    jQuery.get("https://res.cloudinary.com/lastwave/image/list/browser_upload.json", (res) => {
      res.resources.forEach((imageResource: any) => {
        const version = imageResource.version;
        const imageName = imageResource.public_id;
        this.allImages.push(`https://res.cloudinary.com/lastwave/image/upload/${imageName}.svg`);
      });
    });
  },
  data: function () {
    return {
      allImages: [] as string[],
      index: null,
      currentPage: 0,
    };
  },
  computed: {
    thisPageImages(): string[] {
      const firstImage = this.currentPage * IMAGES_PER_PAGE;
      const lastImage = firstImage + IMAGES_PER_PAGE;
      return this.allImages.slice(firstImage, lastImage);
    },
  },
  components: {
    'gallery': VueGallery
  },
});
</script>
