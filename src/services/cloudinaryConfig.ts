// Cloudinary Console → Settings → Upload → Upload presets → Add preset,
// Signing mode: "Unsigned". Only the cloud name and the unsigned preset name
// belong here. NEVER put the API secret (or API key) in the app.
export const cloudinaryConfig = {
  cloudName: 's3cq7md4',
  uploadPreset: 'chatudu',
};
export const cloudinaryConfigured =
  !cloudinaryConfig.cloudName.startsWith('YOUR_') &&
  !cloudinaryConfig.uploadPreset.startsWith('YOUR_');
