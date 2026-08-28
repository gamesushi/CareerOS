import { createHash } from "node:crypto";
import { prisma, Prisma } from "@careeros/db";

// 实体级向量（docs/design/01 §3.3）：experiences/projects/skills 持久化到 embeddings 表，
// content_hash 相同跳过重嵌。JD 条目向量不持久化，匹配时现算（一次性）。
//
// provider：有 OPENAI_API_KEY 用 text-embedding-3-small（1536 维）；
// 否则 mock = 字符三元组哈希向量——确定性、且文本重叠度会真实反映在余弦相似度上，
// 保证无 key 联调时匹配分数仍有区分度（但语义近义词无法命中，正式使用请配 key）。

export const EMBEDDING_DIMENSION = 1536;

function providerInfo(): { name: "openai"; model: string } | { name: "mock"; model: string } {
  if (process.env.AI_PROVIDER !== "mock" && process.env.OPENAI_API_KEY) {
    return { name: "openai", model: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small" };
  }
  return { name: "mock", model: "mock-trigram-1536" };
}

export function embeddingModelId(): string {
  return providerInfo().model;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const provider = providerInfo();
  if (provider.name === "mock") return texts.map(trigramEmbed);

  const res = await fetch(`${process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1"}/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: provider.model, input: texts.map((t) => t.slice(0, 8000)) }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`embedding 调用失败 HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { data: { index: number; embedding: number[] }[] };
  return data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

function trigramEmbed(text: string): number[] {
  const vec = new Array<number>(EMBEDDING_DIMENSION).fill(0);
  const normalized = text.toLowerCase().replace(/\s+/g, " ");
  for (let i = 0; i < normalized.length - 2; i++) {
    const tri = normalized.slice(i, i + 3);
    let h = 0;
    for (let j = 0; j < tri.length; j++) h = (h * 31 + tri.charCodeAt(j)) >>> 0;
    vec[h % EMBEDDING_DIMENSION] += 1;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

/** 余弦相似度（用于跨语言行业/标签匹配；无 key 的 trigram 向量也能真实反映文本重叠度）。 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

type EntityText = { sourceType: "experience" | "project" | "skill"; sourceId: string; text: string };

/** 汇总用户实体的嵌入文本 */
async function collectEntityTexts(userId: string): Promise<EntityText[]> {
  const [experiences, projects, skills] = await Promise.all([
    prisma.careerExperience.findMany({ where: { userId, deletedAt: null } }),
    prisma.project.findMany({ where: { userId, deletedAt: null } }),
    prisma.skill.findMany({ where: { userId } }),
  ]);
  return [
    ...experiences.map((e): EntityText => ({
      sourceType: "experience",
      sourceId: e.id,
      text: [e.company, e.title, e.location, e.description, ...e.highlights].filter(Boolean).join("\n"),
    })),
    ...projects.map((p): EntityText => ({
      sourceType: "project",
      sourceId: p.id,
      text: [p.name, p.role, p.description, p.outcome, p.techStack.join(" ")].filter(Boolean).join("\n"),
    })),
    ...skills.map((s): EntityText => ({
      sourceType: "skill",
      sourceId: s.id,
      text: [s.name, s.category].filter(Boolean).join(" "),
    })),
  ];
}

/** 匹配前惰性补齐：只嵌入缺失或内容变化的实体，返回补齐数量 */
export async function ensureEntityEmbeddings(userId: string): Promise<number> {
  const modelId = embeddingModelId();
  const entities = (await collectEntityTexts(userId)).filter((e) => e.text.trim());
  if (entities.length === 0) return 0;

  const existing = await prisma.embedding.findMany({
    where: { userId, modelId, sourceId: { in: entities.map((e) => e.sourceId) } },
    select: { sourceType: true, sourceId: true, contentHash: true },
  });
  const existingMap = new Map(existing.map((e) => [`${e.sourceType}:${e.sourceId}`, e.contentHash]));

  const stale = entities.filter((e) => existingMap.get(`${e.sourceType}:${e.sourceId}`) !== sha256(e.text));
  if (stale.length === 0) return 0;

  // 分批嵌入（openai 单次上限内），逐条 upsert
  const BATCH = 64;
  for (let i = 0; i < stale.length; i += BATCH) {
    const batch = stale.slice(i, i + BATCH);
    const vectors = await embedTexts(batch.map((b) => b.text));
    for (let j = 0; j < batch.length; j++) {
      await upsertEmbedding(userId, batch[j], vectors[j], modelId);
    }
  }
  return stale.length;
}

async function upsertEmbedding(userId: string, entity: EntityText, vector: number[], modelId: string) {
  const vectorLiteral = `[${vector.join(",")}]`;
  await prisma.$executeRaw`
    INSERT INTO embeddings (user_id, source_type, source_id, content_hash, model_id, dimension, embedding)
    VALUES (${userId}::uuid, ${entity.sourceType}, ${entity.sourceId}::uuid, ${sha256(entity.text)},
            ${modelId}, ${EMBEDDING_DIMENSION}, ${vectorLiteral}::halfvec)
    ON CONFLICT (source_type, source_id, model_id)
    DO UPDATE SET embedding = EXCLUDED.embedding, content_hash = EXCLUDED.content_hash,
                  dimension = EXCLUDED.dimension`;
}

/** 对单个查询向量在用户实体中取 top-1 相似（HNSW 索引路径） */
export async function topSimilar(
  userId: string,
  queryVector: number[],
  sourceTypes: string[],
): Promise<{ sourceType: string; sourceId: string; similarity: number } | null> {
  const modelId = embeddingModelId();
  const vectorLiteral = `[${queryVector.join(",")}]`;
  const rows = await prisma.$queryRaw<{ source_type: string; source_id: string; sim: number }[]>`
    SELECT source_type, source_id,
           1 - (embedding::halfvec(1536) <=> ${vectorLiteral}::halfvec(1536)) AS sim
    FROM embeddings
    WHERE user_id = ${userId}::uuid
      AND model_id = ${modelId}
      AND source_type IN (${Prisma.join(sourceTypes)})
    ORDER BY sim DESC
    LIMIT 1`;
  const row = rows[0];
  return row ? { sourceType: row.source_type, sourceId: row.source_id, similarity: Number(row.sim) } : null;
}
