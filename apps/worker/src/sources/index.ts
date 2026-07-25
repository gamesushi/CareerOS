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
import {
  neteaseSource,
  riotgamesSource,
  scopelySource,
  kraftonSource,
  nintendoSource,
  epicgamesSource,
} from "./greenhouse";
import {
  sofiSource, brexSource, chimeSource, monzoSource, n26Source, upgradeSource,
  affirmSource, mercurySource, coinbaseSource, oscarSource, ethosSource,
  point72Source, imcSource, wintonSource, janestreetSource, mangroupSource,
  jumptradingSource, flowtradersSource, pinganSource, efundSource, cmbSource,
} from "./finance";
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
  // 游戏公司（Greenhouse 官方招聘板）
  [riotgamesSource.id]: riotgamesSource,
  [scopelySource.id]: scopelySource,
  [kraftonSource.id]: kraftonSource,
  [nintendoSource.id]: nintendoSource,
  [epicgamesSource.id]: epicgamesSource,
  // 金融：银行 / 保险 / 基金（Greenhouse + best-effort 中文官网）
  [sofiSource.id]: sofiSource,
  [brexSource.id]: brexSource,
  [chimeSource.id]: chimeSource,
  [monzoSource.id]: monzoSource,
  [n26Source.id]: n26Source,
  [upgradeSource.id]: upgradeSource,
  [affirmSource.id]: affirmSource,
  [mercurySource.id]: mercurySource,
  [coinbaseSource.id]: coinbaseSource,
  [oscarSource.id]: oscarSource,
  [ethosSource.id]: ethosSource,
  [point72Source.id]: point72Source,
  [imcSource.id]: imcSource,
  [wintonSource.id]: wintonSource,
  [janestreetSource.id]: janestreetSource,
  [mangroupSource.id]: mangroupSource,
  [jumptradingSource.id]: jumptradingSource,
  [flowtradersSource.id]: flowtradersSource,
  [pinganSource.id]: pinganSource,
  [efundSource.id]: efundSource,
  [cmbSource.id]: cmbSource,
};

export const SOURCE_IDS = Object.keys(SOURCES);
