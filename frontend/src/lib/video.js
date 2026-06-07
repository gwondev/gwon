// 간단한 영상 — base64 data URL 로 DB 저장 (용량 제한)

const MAX_VIDEO_BYTES = 12 * 1024 * 1024;

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function fileToVideoDataUrl(file) {
  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error("영상은 12MB 이하만 업로드할 수 있습니다.");
  }
  const dataUrl = await readAsDataURL(file);
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:video/")) {
    throw new Error("지원하지 않는 영상 형식입니다.");
  }
  return dataUrl;
}
