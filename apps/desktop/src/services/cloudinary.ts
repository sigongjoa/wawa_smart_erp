import { useReportStore } from '../stores/reportStore';

export const uploadToCloudinary = async (dataUrl: string): Promise<string> => {
  const { appSettings } = useReportStore.getState();
  const cloudName = appSettings.cloudinaryCloudName;
  const uploadPreset = appSettings.cloudinaryUploadPreset;

  if (!cloudName || !uploadPreset) {
    throw new Error('Cloudinary 설정이 없습니다. notion_config.json에 cloudinaryCloudName, cloudinaryUploadPreset을 추가하세요.');
  }

  const formData = new FormData();
  formData.append('file', dataUrl);
  formData.append('upload_preset', uploadPreset);
  formData.append('folder', 'wawa-reports');

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
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
