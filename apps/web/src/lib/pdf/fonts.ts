import path from "node:path";
import fs from "node:fs";
import { Font } from "@react-pdf/renderer";

// 所有模板共用：CJK 字体注册 + 断行策略。
// 断行：CJK 逐字作为断点（配合 patches/@react-pdf__textkit 对 CJK 断点不插连字符）。

let registered = false;
let registrationError: Error | null = null;

// dev 从 apps/web 起（cwd=apps/web，命中 candidates[0]）；
// standalone/容器里可能从仓库根起，回退 candidates[1]。
function resolveFontsDir(): string {
  const candidates = [
    path.join(process.cwd(), "public/fonts"),
    path.join(process.cwd(), "apps/web/public/fonts"),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "NotoSansSC-Regular.ttf"))) return dir;
  }
  return candidates[0];
}

export function ensureFonts(): void {
  if (registered) {
    // 首次注册若失败，后续请求直接复用同一错误，避免静默跳过注册导致 CJK 丢字。
    if (registrationError) throw registrationError;
    return;
  }
  // 先标记，避免并发请求重复注册；若下方抛错则记录错误并上抛。
  registered = true;
  try {
    const fontsDir = resolveFontsDir();
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
  } catch (err) {
    registrationError = err instanceof Error ? err : new Error(String(err));
    throw registrationError;
  }
}
