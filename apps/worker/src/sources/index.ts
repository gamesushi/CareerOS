import type { JobSource } from "./types";
import { tencentSource } from "./tencent";
import { bytedanceSource } from "./bytedance";

// 新增来源：实现 JobSource 后在此注册。
export const SOURCES: Record<string, JobSource> = {
  [tencentSource.id]: tencentSource,
  [bytedanceSource.id]: bytedanceSource,
};

export const SOURCE_IDS = Object.keys(SOURCES);
