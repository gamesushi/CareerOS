import path from "node:path";
import { Font } from "@react-pdf/renderer";

// 所有模板共用：CJK 字体注册 + 断行策略。
// 断行：CJK 逐字作为断点（配合 patches/@react-pdf__textkit 对 CJK 断点不插连字符）。

let registered = false;

export function ensureFonts() {
  if (registered) return;
  registered = true;

  const fontsDir = path.join(process.cwd(), "public/fonts");
  Font.register({
    family: "NotoSansSC",
    fonts: [
      { src: path.join(fontsDir, "NotoSansSC-Regular.ttf") },
      { src: path.join(fontsDir, "NotoSansSC-Bold.ttf"), fontWeight: 700 },
    ],
  });
  // 日文文书（履歴書/職務経歴書）：完整版 Noto Sans CJK JP——
  // 日式字形优先且覆盖全部 CJK（含简体专有名词，如中国公司名），避免子集字体缺字。
  Font.register({
    family: "NotoSansJP",
    fonts: [
      { src: path.join(fontsDir, "NotoSansCJKjp-Regular.otf") },
      { src: path.join(fontsDir, "NotoSansCJKjp-Bold.otf"), fontWeight: 700 },
    ],
  });
  Font.registerHyphenationCallback((word) =>
    /[぀-ヿ㐀-鿿豈-﫿]/.test(word) ? word.split("") : [word],
  );
}
