import { TEST_DATABASE_URL } from "./db-env";

// 每个测试 worker 在导入 @careeros/db（创建 prisma 单例）之前，把 DATABASE_URL 指向测试库。
process.env.DATABASE_URL = TEST_DATABASE_URL;
