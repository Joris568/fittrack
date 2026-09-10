/** Downscales an image file to a JPEG data URL so progress photos stay well
 * under the upload size limit — a raw phone photo can be several MB. */
export function resizeImageToDataUrl(file: File, maxDimension = 1080, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Kon bestand niet lezen"));
    reader.onload = () => {
      img.onerror = () => reject(new Error("Kon afbeelding niet laden"));
      img.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas niet ondersteund"));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
