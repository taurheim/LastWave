import { fetchWithRetry } from '@/core/http/fetchWithRetry';

export default class CloudinaryAPI {
  private ACCOUNT_NAME = 'lastwave';
  private UPLOAD_PRESET = 'lastwave_unsigned_upload';
  private API_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${this.ACCOUNT_NAME}/upload`;

  public async uploadImage(
    imageBlob: Blob,
    fileName: string,
    schemeName: string,
    username: string,
  ): Promise<string> {
    const UPLOAD_TAGS = ['browser_upload', 'v4', `user:${username}`, `scheme:${schemeName}`];

    const formData = new FormData();
    formData.append('upload_preset', this.UPLOAD_PRESET);
    formData.append('tags', UPLOAD_TAGS.join(','));
    formData.append('file', imageBlob);

    const response = await fetchWithRetry(this.API_UPLOAD_URL, {
      method: 'POST',
      body: formData,
    });

    const data = (await response.json()) as { secure_url: string };
    return data.secure_url;
  }
}
