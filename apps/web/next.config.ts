import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // react-pdf（含 fontkit / 原生 buffer / fs 读字体）必须排除出 server bundle，
  // 否则 Next 16 + Turbopack 打包后运行时报"文件损坏/无法识别"。
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default nextConfig;
