-- Prisma 不支持的索引类型，migrate 后执行：pnpm --filter @careeros/db db:indexes
-- 幂等，可重复执行。

-- trigram：公司名/技能名模糊匹配与查重
CREATE INDEX IF NOT EXISTS idx_exp_company_trgm
  ON career_experiences USING gin (company_norm gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_skill_name_trgm
  ON skills USING gin (name_norm gin_trgm_ops);

-- 日志 tags 数组检索
CREATE INDEX IF NOT EXISTS idx_wl_tags ON work_logs USING gin (tags);

-- 实体向量：按维度分区的 HNSW（新增维度时在此追加）
CREATE INDEX IF NOT EXISTS idx_emb_1536 ON embeddings
  USING hnsw ((embedding::halfvec(1536)) halfvec_cosine_ops)
  WITH (m = 16, ef_construction = 64) WHERE (dimension = 1536);
