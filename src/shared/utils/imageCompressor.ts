/**
 * Client-side image compressor and optimizer.
 * Resizes excessively large images to max dimensions and compresses JPEG/PNG,
 * while preserving SVG, animated GIF, and non-image files intact.
 */
export async function compressImage(
  file: File,
  maxWidth = 1920,
  maxHeight = 1920,
  quality = 0.82
): Promise<File> {
  // If not an image or is SVG/GIF (preserve vector and animation), return original file untouched
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return file;
  }

  // If already under 500 KB, no need to recompress
  if (file.size < 500 * 1024) {
    return file;
  }

  return new Promise((resolve) => {
    // If running in an environment without Image/canvas (e.g. Node.js unit tests without DOM)
    if (typeof window === 'undefined' || typeof document === 'undefined' || typeof Image === 'undefined') {
      return resolve(file);
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;

      // Only resize if exceeds max dimensions
      if (width > maxWidth || height > maxHeight) {
        if (width > height) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return resolve(file);
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Prefer jpeg for photos, png for png with potential transparency
      const targetMime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';

      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            // If compressed result isn't smaller, keep original file
            return resolve(file);
          }
          const compressedFile = new File([blob], file.name, {
            type: targetMime,
            lastModified: Date.now(),
          });
          resolve(compressedFile);
        },
        targetMime,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file); // Fallback to original on error
    };

    img.src = objectUrl;
  });
}
