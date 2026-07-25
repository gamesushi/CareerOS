import type { JobSource } from "./types";
import { tencentSource } from "./tencent";
import { bytedanceSource } from "./bytedance";
import { liepinSource } from "./liepin";
import { bossSource } from "./boss";
import { greenSource } from "./green";
import { indeedSource } from "./indeed";
import { wantedlySource } from "./wantedly";
import { remoteokSource } from "./remoteok";
import { hackernewsSource } from "./hackernews";
import { neteaseSource } from "./greenhouse";
import { mihoyoSource } from "./mihoyo";

// 新增来源：实现 JobSource 后在此注册。
export const SOURCES: Record<string, JobSource> = {
  [tencentSource.id]: tencentSource,
  [bytedanceSource.id]: bytedanceSource,
  [liepinSource.id]: liepinSource,
  [bossSource.id]: bossSource,
  [greenSource.id]: greenSource,
  [indeedSource.id]: indeedSource,
  [wantedlySource.id]: wantedlySource,
  [remoteokSource.id]: remoteokSource,
  [hackernewsSource.id]: hackernewsSource,
  [neteaseSource.id]: neteaseSource,
  [mihoyoSource.id]: mihoyoSource,
};

export const SOURCE_IDS = Object.keys(SOURCES);
