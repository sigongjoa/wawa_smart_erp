const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string;

export const uploadToCloudinary = async (dataUrl: string): Promise<string> => {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error('Cloudinary 설정이 없습니다. .env에 VITE_CLOUDINARY_CLOUD_NAME, VITE_CLOUDINARY_UPLOAD_PRESET을 추가하세요.');
  }

  const formData = new FormData();
  formData.append('file', dataUrl);          // Cloudinary는 base64 dataURL을 직접 지원
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', 'wawa-reports');

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `업로드 실패 (${res.status})`);
  }

  const data = await res.json();
  return data.secure_url as string;
};
