<template>
  <div class="gallery">
    <gallery :images="images" :index="index" @close="index = null"></gallery>
    <div
      class="image"
      v-for="(image, imageIndex) in images"
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

export default Vue.extend({
  mounted() {
    jQuery.get("https://res.cloudinary.com/lastwave/image/list/browser_upload.json", (res) => {
      res.resources.forEach((imageResource: any) => {
        const version = imageResource.version;
        const imageName = imageResource.public_id;
        this.images.push(`https://res.cloudinary.com/lastwave/image/upload/${imageName}.svg`);
      });
      console.log(res);
    });
  },
  data: function () {
    return {
      images: <string[]> [],
      index: null
    };
  },

  components: {
    'gallery': VueGallery
  },
});
</script>
