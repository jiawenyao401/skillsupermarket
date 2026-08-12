// LLM Judge - 用大模型给 skill 打分
// 默认用 DeepSeek (便宜), 可切换到 OpenAI / Anthropic

interface JudgeConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

function getConfig(): JudgeConfig {
  if (process.env.DEEPSEEK_API_KEY) {
    return {
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseUrl: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
    };
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
    };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      apiKey: process.env.ANTHROPIC_API_KEY,
      baseUrl: "https://api.anthropic.com",
      model: "claude-haiku-4-5",
    };
  }
  throw new Error("需要配置 DEEPSEEK_API_KEY / OPENAI_API_KEY / ANTHROPIC_API_KEY 其中之一");
}

export interface JudgeInput {
  name: string;
  type: string;
  description: string;
  readme: string;
}

export interface JudgeResult {
  score: number; // 0-100
  details: string;
  comment: string;
}

const JUDGE_PROMPT = `你是一个 AI Skill 质量评审专家。请根据以下信息给这个 AI Skill 打分（0-100）。

## 评分维度（每项 0-20 分，共 100 分）

1. **实用性 (utility)**: 解决什么问题？是否真实需求？场景是否清晰？
2. **清晰度 (clarity)**: 描述和文档是否清晰、易懂？目标用户是否明确？
3. **可复用性 (reusability)**: 其他开发者能直接使用吗？是否有清晰的使用示例？
4. **设计质量 (design)**: API/接口/参数设计是否合理？是否符合最佳实践？
5. **文档质量 (documentation)**: README 是否完整？是否有示例、参数说明、错误处理？

## 待评审 Skill

名称: {name}
类型: {type}
描述: {description}

README（前 3000 字符）:
"""
{readme}
"""

## 输出要求

请输出严格的 JSON（不要 markdown 代码块）:
{{
  "scores": {{
    "utility": <0-20>,
    "clarity": <0-20>,
    "reusability": <0-20>,
    "design": <0-20>,
    "documentation": <0-20>
  }},
  "comment": "<一句话总结优缺点，100字以内>"
}}`;

export async function judgeSkill(input: JudgeInput): Promise<JudgeResult> {
  const config = getConfig();

  const prompt = JUDGE_PROMPT.replace("{name}", input.name)
    .replace("{type}", input.type)
    .replace("{description}", input.description || "(无)")
    .replace("{readme}", (input.readme || "(无 README)").slice(0, 3000));

  // 兼容不同 provider
  const isAnthropic = config.baseUrl.includes("anthropic.com");

  let response: Response;
  if (isAnthropic) {
    response = await fetch(`${config.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } else {
    response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 1024,
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content: "你是 AI Skill 质量评审专家，严格输出 JSON。",
          },
          { role: "user", content: prompt },
        ],
      }),
    });
  }

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`LLM Judge 失败: ${response.status} ${err}`);
  }

  const data = await response.json();
  let text: string;
  if (isAnthropic) {
    text = data.content?.[0]?.text ?? "";
  } else {
    text = data.choices?.[0]?.message?.content ?? "";
  }

  // 解析 JSON (可能包了 markdown 代码块)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`LLM 返回非 JSON: ${text}`);

  const parsed = JSON.parse(jsonMatch[0]);
  const scores = parsed.scores ?? {};
  const total = Object.values(scores).reduce<number>(
    (a, b) => a + (typeof b === "number" ? b : 0),
    0
  );

  return {
    score: Math.max(0, Math.min(100, total)),
    details: `实用:${scores.utility} 清晰:${scores.clarity} 复用:${scores.reusability} 设计:${scores.design} 文档:${scores.documentation}`,
    comment: parsed.comment ?? "",
  };
}
