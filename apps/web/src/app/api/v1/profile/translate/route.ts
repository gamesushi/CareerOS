import { handler, ok, parseBody, requireUser } from "@/lib/api";
import { chat } from "@/lib/ai";
import { z } from "zod";

const translateInput = z.object({
  name: z.string().optional(),
  headline: z.string().optional(),
  summary: z.string().optional(),
  preferredCity: z.string().optional(),
  address: z.string().optional(),
});

export const POST = handler(async (req) => {
  await requireUser();
  const input = await parseBody(req, translateInput);

  const system = `你是一个专业的求职简历多语言翻译专家。请将用户提供的个人基本信息（姓名、职业头衔/Headline、个人简介/Summary、意向工作城市、联系地址）翻译地道并符合当地职场习惯，分别翻译为英文 (en) 和日文 (ja)。
格式要求：必须返回 JSON 对象，结构如下：
{
  "en": {
    "name": "英文姓名 (如拼音/英文名)",
    "headline": "地道的英文职业头衔",
    "summary": "地道的英文职业简介",
    "preferredCity": "英文城市名 (如 Tokyo)",
    "address": "英文地址"
  },
  "ja": {
    "name": "日文姓名 (如日文汉字或片假名)",
    "headline": "日文職種・肩書",
    "summary": "日文職務要約・自己PR",
    "preferredCity": "日文城市名 (如 東京)",
    "address": "日文地址"
  }
}`;

  const res = await chat({
    system,
    user: JSON.stringify(input),
    json: true,
    temperature: 0.2,
  });

  try {
    const data = JSON.parse(res.content);
    return ok(data);
  } catch {
    return ok({
      en: {
        name: input.name ?? "",
        headline: input.headline ?? "",
        summary: input.summary ?? "",
        preferredCity: input.preferredCity ?? "",
        address: input.address ?? "",
      },
      ja: {
        name: input.name ?? "",
        headline: input.headline ?? "",
        summary: input.summary ?? "",
        preferredCity: input.preferredCity ?? "",
        address: input.address ?? "",
      },
    });
  }
});
