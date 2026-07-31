// /welcome 作为 / 的别名，渲染同一内容。
// 真实页面在 @/app/page.tsx（也是 ISR 缓存的真实源头）。
// 这里只 re-export default 函数，不重导出 metadata / revalidate（避免路由段配置被 Next.js 忽略导致 500）。
export { default } from "@/app/page";
