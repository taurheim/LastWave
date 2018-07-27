export default class CloudinaryAPI {
  private ACCOUNT_NAME = 'lastwave';
  private UPLOAD_PRESET = 'lastwave_unsigned_upload';
  private API_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${this.ACCOUNT_NAME}/upload`;

  public uploadBase64Svg(
    b64Svg: string,
    fileName: string,
    schemeName: string,
    username: string,
  ): Promise<string> {
    return new Promise((resolve, reject)  => {
      const UPLOAD_TAGS = [
        'browser_upload',
        'v3',
        `user:${username}`,
        `scheme:${schemeName}`,
      ];

      const xhr = new XMLHttpRequest();
      const formData = new FormData();

      xhr.open('POST', this.API_UPLOAD_URL, true);
      xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
      xhr.onreadystatechange = (e) => {
        // TODO handle errors
        if (xhr.readyState === 4 && xhr.status === 200) {
          resolve(JSON.parse(xhr.responseText).secure_url);
        }
      };

      formData.append('upload_preset', this.UPLOAD_PRESET);
      formData.append('tags', UPLOAD_TAGS.join(','));
      formData.append('file', b64Svg);
      formData.append('public_id', fileName);

      xhr.send(formData);
    });
  }
}
