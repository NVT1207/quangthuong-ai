// Anthropic <-> OpenAI translation bridge.
// Dùng khi /api/v1/messages của Quang Thưởng AI (Anthropic-style) forward tới upstream OpenAI-compat
// (ChiaSeGPU, OpenRouter, LiteLLM, vv) — cần dịch request/response qua lại.

type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: string; media_type?: string; data?: string; url?: string } }
  | { type: "tool_use"; id: string; name: string; input: any }
  | { type: "tool_result"; tool_use_id: string; content: any; is_error?: boolean }
  | { type: string; [k: string]: any };

type AnthropicMessage = {
  role: "user" | "assistant" | string;
  content: string | AnthropicContentBlock[];
};

type AnthropicRequest = {
  model: string;
  max_tokens?: number;
  messages: AnthropicMessage[];
  system?: string | AnthropicContentBlock[];
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stop_sequences?: string[];
  stream?: boolean;
  tools?: Array<{ name: string; description?: string; input_schema?: any }>;
  tool_choice?: any;
  metadata?: any;
  [k: string]: any;
};

type OpenAIMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | Array<any> | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
};

// ────────────────────────────────────────────────────────────────────────
// REQUEST: Anthropic → OpenAI
// ────────────────────────────────────────────────────────────────────────

function flattenSystem(system: AnthropicRequest["system"]): string {
  if (!system) return "";
  if (typeof system === "string") return system;
  if (Array.isArray(system)) {
    return system
      .filter((b) => b?.type === "text" && typeof (b as any).text === "string")
      .map((b: any) => b.text)
      .join("\n");
  }
  return "";
}

// Chuyển 1 message Anthropic thành 1+ message OpenAI (vì tool_result phải tách thành role="tool")
function convertMessage(msg: AnthropicMessage): OpenAIMessage[] {
  const role = (msg.role === "assistant" ? "assistant" : "user") as "user" | "assistant";

  if (typeof msg.content === "string") {
    return [{ role, content: msg.content }];
  }

  if (!Array.isArray(msg.content)) {
    return [{ role, content: String(msg.content ?? "") }];
  }

  // Assistant: gom text blocks thành content + tool_use blocks → tool_calls
  if (role === "assistant") {
    const textParts: string[] = [];
    const toolCalls: NonNullable<OpenAIMessage["tool_calls"]> = [];
    for (const b of msg.content) {
      if (b.type === "text" && typeof (b as any).text === "string") {
        textParts.push((b as any).text);
      } else if (b.type === "tool_use") {
        toolCalls.push({
          id: (b as any).id,
          type: "function",
          function: {
            name: (b as any).name,
            arguments: JSON.stringify((b as any).input ?? {}),
          },
        });
      }
    }
    const out: OpenAIMessage = {
      role: "assistant",
      content: textParts.length ? textParts.join("\n") : null,
    };
    if (toolCalls.length) out.tool_calls = toolCalls;
    return [out];
  }

  // User: tool_result blocks → tách thành role="tool" messages, còn lại gom thành content array (vision)
  const toolResults: OpenAIMessage[] = [];
  const otherBlocks: AnthropicContentBlock[] = [];
  for (const b of msg.content) {
    if (b.type === "tool_result") {
      let content: string;
      const c = (b as any).content;
      if (typeof c === "string") content = c;
      else if (Array.isArray(c)) {
        content = c
          .map((x: any) => (typeof x === "string" ? x : x?.text ?? JSON.stringify(x)))
          .join("\n");
      } else content = JSON.stringify(c);
      toolResults.push({
        role: "tool",
        tool_call_id: (b as any).tool_use_id,
        content,
      });
    } else {
      otherBlocks.push(b);
    }
  }

  const out: OpenAIMessage[] = [];
  if (otherBlocks.length) {
    // Nếu chỉ có text → string content (đơn giản, ít gateway hỗ trợ vision array)
    const allText = otherBlocks.every((b) => b.type === "text");
    if (allText) {
      out.push({
        role: "user",
        content: otherBlocks.map((b: any) => b.text).join("\n"),
      });
    } else {
      // Mixed (vision) → OpenAI content parts array
      const parts = otherBlocks.map((b: any) => {
        if (b.type === "text") return { type: "text", text: b.text };
        if (b.type === "image") {
          const src = b.source || {};
          if (src.type === "url" && src.url) {
            return { type: "image_url", image_url: { url: src.url } };
          }
          if (src.type === "base64" && src.data) {
            return {
              type: "image_url",
              image_url: { url: `data:${src.media_type || "image/png"};base64,${src.data}` },
            };
          }
          return { type: "text", text: "[unsupported image]" };
        }
        return { type: "text", text: typeof b.text === "string" ? b.text : JSON.stringify(b) };
      });
      out.push({ role: "user", content: parts as any });
    }
  }
  out.push(...toolResults);
  return out;
}

function convertTools(tools?: AnthropicRequest["tools"]) {
  if (!tools || !tools.length) return undefined;
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema ?? { type: "object", properties: {} },
    },
  }));
}

function convertToolChoice(tc: any) {
  if (!tc) return undefined;
  if (tc.type === "auto") return "auto";
  if (tc.type === "any") return "required";
  if (tc.type === "none") return "none";
  if (tc.type === "tool" && tc.name) {
    return { type: "function", function: { name: tc.name } };
  }
  return undefined;
}

export function anthropicToOpenAIRequest(
  body: AnthropicRequest,
  upstreamModel: string
): Record<string, any> {
  const system = flattenSystem(body.system);
  const messages: OpenAIMessage[] = [];
  if (system) messages.push({ role: "system", content: system });
  for (const m of body.messages) {
    messages.push(...convertMessage(m));
  }
  const out: Record<string, any> = {
    model: upstreamModel,
    messages,
    stream: body.stream === true,
  };
  if (body.max_tokens != null) out.max_tokens = body.max_tokens;
  if (body.temperature != null) out.temperature = body.temperature;
  if (body.top_p != null) out.top_p = body.top_p;
  if (body.stop_sequences?.length) out.stop = body.stop_sequences;
  const tools = convertTools(body.tools);
  if (tools) out.tools = tools;
  const tc = convertToolChoice(body.tool_choice);
  if (tc) out.tool_choice = tc;
  return out;
}

// ────────────────────────────────────────────────────────────────────────
// RESPONSE: OpenAI → Anthropic
// ────────────────────────────────────────────────────────────────────────

function stopReasonFromOpenAI(finish?: string | null): string {
  switch (finish) {
    case "stop":
      return "end_turn";
    case "length":
      return "max_tokens";
    case "tool_calls":
    case "function_call":
      return "tool_use";
    case "content_filter":
      return "stop_sequence";
    default:
      return "end_turn";
  }
}

function newMsgId(): string {
  return `msg_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function openaiToAnthropicResponse(
  openai: any,
  modelSlug: string
): any {
  const choice = openai?.choices?.[0] || {};
  const msg = choice.message || {};
  const content: any[] = [];
  if (typeof msg.content === "string" && msg.content.length > 0) {
    content.push({ type: "text", text: msg.content });
  } else if (Array.isArray(msg.content)) {
    for (const part of msg.content) {
      if (part?.type === "text" && typeof part.text === "string") {
        content.push({ type: "text", text: part.text });
      }
    }
  }
  if (Array.isArray(msg.tool_calls)) {
    for (const tc of msg.tool_calls) {
      let input: any = {};
      try {
        input = tc?.function?.arguments
          ? JSON.parse(tc.function.arguments)
          : {};
      } catch {
        input = { _raw: tc?.function?.arguments };
      }
      content.push({
        type: "tool_use",
        id: tc.id || `toolu_${Math.random().toString(36).slice(2, 10)}`,
        name: tc?.function?.name,
        input,
      });
    }
  }
  if (content.length === 0) {
    // Đảm bảo luôn có ít nhất 1 text block để SDK không lỗi
    content.push({ type: "text", text: "" });
  }
  return {
    id: openai?.id ? `msg_${openai.id}` : newMsgId(),
    type: "message",
    role: "assistant",
    model: modelSlug,
    content,
    stop_reason: stopReasonFromOpenAI(choice.finish_reason),
    stop_sequence: null,
    usage: {
      input_tokens: openai?.usage?.prompt_tokens ?? 0,
      output_tokens: openai?.usage?.completion_tokens ?? 0,
    },
  };
}

// ────────────────────────────────────────────────────────────────────────
// STREAM: OpenAI SSE → Anthropic SSE
// ────────────────────────────────────────────────────────────────────────
// OpenAI emits: `data: {choices:[{delta:{content:"..."}}]}` then `data: [DONE]`
// Anthropic expects: message_start → content_block_start → content_block_delta(s)
//                  → content_block_stop → message_delta → message_stop

type StreamState = {
  msgId: string;
  modelSlug: string;
  emittedMessageStart: boolean;
  // Text block state
  textIdx: number | null;
  // Tool call state: index -> {idx, id, name, argsAcc, started}
  toolBlocks: Map<number, { idx: number; id: string; name: string; argsAcc: string; started: boolean }>;
  blockCursor: number; // next available content block index
  inputTokens: number;
  outputTokens: number;
  finishReason: string | null;
};

export function createAnthropicStreamTranslator(modelSlug: string, fallbackInputTokens = 0) {
  const state: StreamState = {
    msgId: newMsgId(),
    modelSlug,
    emittedMessageStart: false,
    textIdx: null,
    toolBlocks: new Map(),
    blockCursor: 0,
    inputTokens: fallbackInputTokens,
    outputTokens: 0,
    finishReason: null,
  };

  function fmtEvent(event: string, data: any): string {
    return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  }

  function emitMessageStart(out: string[]) {
    if (state.emittedMessageStart) return;
    state.emittedMessageStart = true;
    out.push(
      fmtEvent("message_start", {
        type: "message_start",
        message: {
          id: state.msgId,
          type: "message",
          role: "assistant",
          model: state.modelSlug,
          content: [],
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: state.inputTokens, output_tokens: 0 },
        },
      })
    );
  }

  function ensureTextBlock(out: string[]) {
    if (state.textIdx !== null) return;
    state.textIdx = state.blockCursor++;
    out.push(
      fmtEvent("content_block_start", {
        type: "content_block_start",
        index: state.textIdx,
        content_block: { type: "text", text: "" },
      })
    );
  }

  function closeTextBlock(out: string[]) {
    if (state.textIdx === null) return;
    out.push(
      fmtEvent("content_block_stop", { type: "content_block_stop", index: state.textIdx })
    );
    state.textIdx = null;
  }

  function ensureToolBlock(out: string[], openaiIdx: number, id: string, name: string) {
    let tb = state.toolBlocks.get(openaiIdx);
    if (tb && tb.started) return tb;
    if (!tb) {
      tb = { idx: state.blockCursor++, id, name, argsAcc: "", started: false };
      state.toolBlocks.set(openaiIdx, tb);
    }
    // Đóng text block (nếu đang mở) trước khi mở tool block
    closeTextBlock(out);
    tb.started = true;
    out.push(
      fmtEvent("content_block_start", {
        type: "content_block_start",
        index: tb.idx,
        content_block: { type: "tool_use", id: tb.id, name: tb.name, input: {} },
      })
    );
    return tb;
  }

  function closeAllOpenBlocks(out: string[]) {
    closeTextBlock(out);
    for (const tb of state.toolBlocks.values()) {
      if (tb.started) {
        out.push(
          fmtEvent("content_block_stop", { type: "content_block_stop", index: tb.idx })
        );
        tb.started = false;
      }
    }
  }

  function processChunk(openaiChunk: any, out: string[]) {
    emitMessageStart(out);

    // Usage có thể xuất hiện ở chunk cuối (OpenAI gửi usage trong chunk riêng nếu stream_options.include_usage=true)
    if (openaiChunk?.usage) {
      if (openaiChunk.usage.prompt_tokens != null) state.inputTokens = openaiChunk.usage.prompt_tokens;
      if (openaiChunk.usage.completion_tokens != null) state.outputTokens = openaiChunk.usage.completion_tokens;
    }

    const choice = openaiChunk?.choices?.[0];
    if (!choice) return;
    const delta = choice.delta || {};
    if (choice.finish_reason) state.finishReason = choice.finish_reason;

    // Text delta
    if (typeof delta.content === "string" && delta.content.length > 0) {
      ensureTextBlock(out);
      out.push(
        fmtEvent("content_block_delta", {
          type: "content_block_delta",
          index: state.textIdx,
          delta: { type: "text_delta", text: delta.content },
        })
      );
    }

    // Tool call deltas
    if (Array.isArray(delta.tool_calls)) {
      for (const tc of delta.tool_calls) {
        const openaiIdx = tc.index ?? 0;
        const id = tc.id || state.toolBlocks.get(openaiIdx)?.id || `toolu_${Math.random().toString(36).slice(2, 10)}`;
        const name = tc?.function?.name || state.toolBlocks.get(openaiIdx)?.name || "";
        // Chỉ start khi đã có name (vì Anthropic content_block_start cần tên function)
        let tb = state.toolBlocks.get(openaiIdx);
        if (!tb) {
          tb = { idx: state.blockCursor++, id, name, argsAcc: "", started: false };
          state.toolBlocks.set(openaiIdx, tb);
        } else {
          if (id && tb.id === "" ) tb.id = id;
          if (name && !tb.name) tb.name = name;
        }
        if (!tb.started && tb.name) {
          ensureToolBlock(out, openaiIdx, tb.id, tb.name);
        }
        const argsPart: string | undefined = tc?.function?.arguments;
        if (typeof argsPart === "string" && argsPart.length > 0) {
          tb.argsAcc += argsPart;
          if (tb.started) {
            out.push(
              fmtEvent("content_block_delta", {
                type: "content_block_delta",
                index: tb.idx,
                delta: { type: "input_json_delta", partial_json: argsPart },
              })
            );
          }
        }
      }
    }
  }

  function finalize(out: string[]) {
    emitMessageStart(out);
    closeAllOpenBlocks(out);
    out.push(
      fmtEvent("message_delta", {
        type: "message_delta",
        delta: {
          stop_reason: stopReasonFromOpenAI(state.finishReason),
          stop_sequence: null,
        },
        usage: { output_tokens: state.outputTokens },
      })
    );
    out.push(fmtEvent("message_stop", { type: "message_stop" }));
  }

  return {
    state,
    /**
     * Feed 1 line từ upstream SSE stream (đã tách theo \n).
     * Trả về 0+ events Anthropic SSE để forward về client.
     */
    feedLine(line: string): string {
      const out: string[] = [];
      const l = line.trim();
      if (!l.startsWith("data:")) return "";
      const payload = l.slice(5).trim();
      if (!payload || payload === "[DONE]") return "";
      try {
        const j = JSON.parse(payload);
        processChunk(j, out);
      } catch {
        /* ignore parse error */
      }
      return out.join("");
    },
    finish(): string {
      const out: string[] = [];
      finalize(out);
      return out.join("");
    },
    getInputTokens(): number { return state.inputTokens; },
    getOutputTokens(): number { return state.outputTokens; },
  };
}
