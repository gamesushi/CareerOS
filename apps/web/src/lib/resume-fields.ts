// 个人信息板块字段规则：按模板/国家差异化必填与可见性。
// 日本履歴書(rirekisho)强制照片+地址+生日+ふりがな；職務経歴書(shokumu)照片/地址可选；
// 其余模板隐藏地址、照片可选、其余为通用联系字段。

export type PersonalFieldKey =
  | "name"
  | "label"
  | "email"
  | "phone"
  | "location"
  | "address"
  | "photo"
  | "birthDate"
  | "furigana";

export type PersonalFieldRule = {
  key: PersonalFieldKey;
  i18nKey: string; // 标签 i18n key
  required: boolean;
  visible: boolean;
};

// 通用模板（classic/modern/sidebar/compact/ats）的个人信息字段
const baseFields: PersonalFieldRule[] = [
  { key: "name", i18nKey: "resumeDetail.name", required: true, visible: true },
  { key: "label", i18nKey: "resumeDetail.position", required: false, visible: true },
  { key: "email", i18nKey: "resumeDetail.email", required: false, visible: true },
  { key: "phone", i18nKey: "resumeDetail.phone", required: false, visible: true },
  { key: "location", i18nKey: "resumeDetail.location", required: false, visible: true },
  { key: "address", i18nKey: "resumeDetail.address", required: false, visible: false },
  { key: "photo", i18nKey: "resumeDetail.photo", required: false, visible: true },
];

export const PERSONAL_INFO_FIELDS: Record<string, PersonalFieldRule[]> = {
  rirekisho: [
    { key: "name", i18nKey: "resumeDetail.name", required: true, visible: true },
    { key: "furigana", i18nKey: "resumeDetail.furigana", required: false, visible: true },
    { key: "birthDate", i18nKey: "resumeDetail.birthDate", required: true, visible: true },
    { key: "address", i18nKey: "resumeDetail.address", required: true, visible: true },
    { key: "phone", i18nKey: "resumeDetail.phone", required: true, visible: true },
    { key: "email", i18nKey: "resumeDetail.email", required: true, visible: true },
    { key: "photo", i18nKey: "resumeDetail.photo", required: true, visible: true },
  ],
  shokumu: [
    { key: "name", i18nKey: "resumeDetail.name", required: true, visible: true },
    { key: "address", i18nKey: "resumeDetail.address", required: false, visible: true },
    { key: "phone", i18nKey: "resumeDetail.phone", required: false, visible: true },
    { key: "email", i18nKey: "resumeDetail.email", required: false, visible: true },
    { key: "photo", i18nKey: "resumeDetail.photo", required: false, visible: true },
  ],
  classic: baseFields,
  modern: baseFields,
  sidebar: baseFields,
  compact: baseFields,
  ats: baseFields,
};

// 照片输出尺寸预设（4:5 证件照比例）。用户可选尺寸与压缩质量，控制最终体积。
export type PhotoSizePreset = {
  id: "small" | "medium" | "large";
  w: number;
  h: number;
  i18nKey: string;
};

export const PHOTO_SIZE_PRESETS: PhotoSizePreset[] = [
  { id: "small", w: 240, h: 300, i18nKey: "resumeDetail.photoSizeSmall" },
  { id: "medium", w: 400, h: 500, i18nKey: "resumeDetail.photoSizeMedium" },
  { id: "large", w: 600, h: 750, i18nKey: "resumeDetail.photoSizeLarge" },
];

/** 把图片按目标框 cover 裁剪 + JPEG 压缩，返回 base64 data URL */
export function compressPhoto(
  file: File,
  maxW: number,
  maxH: number,
  quality: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("decode failed"));
      img.onload = () => {
        const scale = Math.max(maxW / img.width, maxH / img.height);
        const dw = Math.round(img.width * scale);
        const dh = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = maxW;
        canvas.height = maxH;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("no canvas ctx"));
        ctx.drawImage(img, (maxW - dw) / 2, (maxH - dh) / 2, dw, dh);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
