<template>
  <div class="gallery">
    <div id="gallery-nav">
      <md-button :disabled="currentPage === 0" class='md-primary' v-on:click="currentPage -= 1">Previous Page</md-button>
      <md-button :disabled="currentPage === pageCount - 1" class='md-primary' v-on:click="currentPage += 1">Next Page</md-button>
    </div>
    <div id="gallery-wrapper">
      <gallery :images="thisPageImages" :index="index" @close="index = null"></gallery>
      <div
        class="image"
        v-for="(image, imageIndex) in thisPageImages"
        :key="imageIndex"
        @click="index = imageIndex"
        :style="{ backgroundImage: 'url(' + image + ')', width: '200px', height: '150px' }"
      ></div>
    </div>
    <div id="gallery-footer">
      Page {{ currentPage + 1 }} / {{ pageCount }}
    </div>
  </div>
</template>

<style scoped>
.image {
  background-size: cover;
  background-repeat: no-repeat;
  background-position: center center;
  border: 1px solid #ebebeb;
  margin: 5px;
  display: inline-block;
  cursor: pointer;
}

#gallery-wrapper {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  max-width: 800px;
  justify-content: center;
  flex: 0 1 auto;
  margin: 0 auto;
}

#gallery-nav {
  text-align: center;
}

#gallery-footer {
  text-align: center;
}
</style>


<script lang="ts">
import Vue from 'vue';
import VueGallery from 'vue-gallery';
import jQuery from 'jquery';

const IMAGES_PER_PAGE = 9;

/*
  TODOs
  - Fix the infinite scrolling on the gallery so that pages are switched automatically
  - Add loading spinner while things are loading
  - Add pages in the url so you can jump around
*/

export default Vue.extend({
  mounted() {
    jQuery.get('https://res.cloudinary.com/lastwave/image/list/browser_upload.json', (res) => {
      res.resources.forEach((imageResource: any) => {
        const version = imageResource.version;
        const imageName = imageResource.public_id;
        this.allImages.push(`https://res.cloudinary.com/lastwave/image/upload/${imageName}.svg`);
      });
    });
  },
  data() {
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
    pageCount(): number {
      return Math.ceil(this.allImages.length / IMAGES_PER_PAGE);
    },
  },
  components: {
    gallery: VueGallery,
  },
});
</script>
