<template>
  <div>
    <a
      href-lang="image/svg+xml"
      :href="svgFile"
      title="LastWave.svg"
      download="LastWave.svg"
    >
    Download SVG
    </a>
    <br>
    <a @click="cloudinaryUpload" href="#">Upload to cloudinary</a>
  </div>
</template>
<script lang="ts">
import Vue from 'vue'
import jQuery from 'jquery';

export default Vue.extend({
  mounted() {
    // SVG -> Base64
    const svgWrapperElement = document.getElementById("visualization");
    if (!svgWrapperElement) {
      return;
    }

    const svgElement = svgWrapperElement.getElementsByTagName("svg")[0];
    const svgData = (new XMLSerializer).serializeToString(svgElement);
    const svgBase64 = Buffer.from(svgData).toString("base64");
    const file = "data:image/svg+xml;base64," + svgBase64;
    this.svgFile = file;
  },
  data() {
    return {
      svgFile: "",
    };
  },
  methods:  {
    cloudinaryUpload: function() {
      // Build the form data that will make cloudinary happy
      // TODO move this into its own file
      const url = "https://api.cloudinary.com/v1_1/lastwave/upload";
      const unsignedUploadPreset = "lastwave_unsigned_upload";
      let xhr = new XMLHttpRequest();
      let fd = new FormData();
      xhr.open("POST", url, true);
      xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
      xhr.onreadystatechange = function(e) {
        if (xhr.readyState == 4 && xhr.status == 200) {
          // File uploaded successfully
          var response = JSON.parse(xhr.responseText);
          // https://res.cloudinary.com/cloudName/image/upload/v1483481128/public_id.jpg
          var url = response.secure_url;
          // Create a thumbnail of the uploaded image, with 150px width
          var tokens = url.split('/');
          tokens.splice(-2, 0, 'w_150,c_scale');
          var img = new Image(); // HTML5 Constructor
          img.src = tokens.join('/');
          img.alt = response.public_id;
          document.body.appendChild(img);
        }
      };

      fd.append('upload_preset', unsignedUploadPreset);
      fd.append('tags', 'browser_upload'); // Optional - add tag for image admin in Cloudinary
      fd.append('file', this.svgFile);
      xhr.send(fd);
    }
  },
})
</script>
