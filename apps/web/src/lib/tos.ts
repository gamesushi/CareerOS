/**
 * 条款版本管理。
 *
 * 更新《用户协议》或《隐私政策》后，把 CURRENT_TOS_VERSION 改为新日期，
 * 所有 tosVersion 不一致的老用户下次进入应用会被 TosGate 弹窗要求重新同意。
 */
export const CURRENT_TOS_VERSION = "2026-07-30";

export const TERMS_PATH = "/terms";
export const PRIVACY_PATH = "/privacy";
