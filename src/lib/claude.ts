export function claudeConfigured() {
  return !!process.env.ANTHROPIC_API_KEY;
}

type Usage = { input_tokens: number; output_tokens: number };

async function call(body: Record<string, unknown>) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: process.env.CLAUDE_MODEL || "claude-sonnet-5-5", ...body }),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as { content: { type: string; text?: string; input?: unknown }[]; usage: Usage };
}

export async function askClaude(prompt: string, maxTokens = 2000): Promise<string> {
  const data = await call({ max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] });
  return data.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
}

/** Forces a single tool call and returns its input, plus token usage. */
export async function askClaudeJson<T>(prompt: string, toolName: string, schema: Record<string, unknown>, maxTokens = 3000): Promise<{ data: T; usage: Usage }> {
  const data = await call({
    max_tokens: maxTokens,
    tools: [{ name: toolName, description: "Record the result.", input_schema: schema }],
    tool_choice: { type: "tool", name: toolName },
    messages: [{ role: "user", content: prompt }],
  });
  const block = data.content.find((b) => b.type === "tool_use");
  if (!block) throw new Error("Claude returned no tool call");
  return { data: block.input as T, usage: data.usage };
}

/** Rough cost in pence for Sonnet-class pricing ($3 / $15 per million tokens, ~0.79 GBP per USD). */
export function costPence(u: Usage) {
  return ((u.input_tokens * 3 + u.output_tokens * 15) / 1_000_000) * 100 * 0.79;
}
