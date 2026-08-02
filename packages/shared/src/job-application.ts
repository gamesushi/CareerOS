import { z } from "zod";

// 站内投递契约（Phase 3）。状态词表与 DB 的 JobApplicationStatus 一致。

export const JOB_APPLICATION_STATUSES = [
  "submitted",
  "screening",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
] as const;

export type JobApplicationStatusId = (typeof JOB_APPLICATION_STATUSES)[number];

export const jobApplicationCreateInput = z.object({
  resumeId: z.string().uuid().optional(),
  coverLetter: z.string().trim().max(5000).optional(),
});

/**
 * 状态变更 / 备注。雇主可置 screening|interview|offer|rejected 并写备注；
 * 候选人只能置 withdrawn。真正的权限判定在服务端（lib/job-applications.ts），
 * 这里只做形状校验。
 */
export const jobApplicationUpdateInput = z
  .object({
    status: z.enum(JOB_APPLICATION_STATUSES).optional(),
    employerNote: z.string().trim().max(1000).optional(),
  })
  .refine((v) => v.status !== undefined || v.employerNote !== undefined, {
    message: "至少要改状态或备注其中之一",
  });
