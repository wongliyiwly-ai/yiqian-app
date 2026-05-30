export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { messages, lang } = req.body;

    const systemPrompt = `你是「意签 AI」，一位温柔、理性、有东方哲理感的 AI 陪伴者。
你会用佛系、道系、禅意的方式，引导用户思考问题，但绝不迷信预测，也不制造焦虑。

请严格按照以下格式回答，每个部分之间空一行：

💬 你的感受
用1-2句话温柔回应用户情绪，让他们感到被理解。

🌿 一句哲理
引用一句道家、佛学或禅意智慧，并用一句话解释它的意思。

🔍 帮你看清楚
用简单直白的话，帮用户看清问题本质。3句内说完。

✅ 今天可以做的一件事
给一个具体、可执行的小行动建议。要实际，不要空泛。

✨ 今日提醒：
以一句简洁有力的话作结尾。

禁止说"你一定会怎样"、"肯定会成功"之类的绝对预测。语气温柔，不说教，不吓人。
整体回答不超过300字。`;

    const finalSystemPrompt =
      lang === "en"
        ? systemPrompt + `

IMPORTANT: Reply in English only. Use these English section headers:
💬 How You Feel
🌿 A Word of Wisdom
🔍 Seeing Clearly
✅ One Thing You Can Do Today
✨ Today's Reminder:`
        : systemPrompt;

    let cleanMessages = Array.isArray(messages)
      ? messages
          .filter(
            (m) =>
              m &&
              (m.role === "user" || m.role === "assistant") &&
              m.content
          )
          .map((m) => ({
            role: m.role,
            content: String(m.content),
          }))
      : [];

    cleanMessages = cleanMessages.filter((m) => {
      return !(
        m.role === "assistant" &&
        (m.content.includes("你好，我是意签 AI") ||
          m.content.includes("Hello, I am Yiqian AI"))
      );
    });

    while (cleanMessages.length > 0 && cleanMessages[0].role !== "user") {
      cleanMessages.shift();
    }

    const mergedMessages = [];

    for (const msg of cleanMessages) {
      const last = mergedMessages[mergedMessages.length - 1];

      if (last && last.role === msg.role) {
        last.content += "\n\n" + msg.content;
      } else {
        mergedMessages.push(msg);
      }
    }

    if (mergedMessages.length === 0) {
      return res.status(400).json({
        error: "No user message provided",
      });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-latest",
        max_tokens: 800,
        system: finalSystemPrompt,
        messages: mergedMessages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Anthropic API error:", JSON.stringify(data, null, 2));

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          data?.message ||
          "Claude API error. Please check API key, credits, or model.",
      });
    }

    const reply =
      data.content?.map((block) => block.text || "").join("") ||
      "暂时无法回应，请稍后再试。";

    return res.status(200).json({ reply });
  } catch (error) {
    console.error("Server error:", error);

    return res.status(500).json({
      error: error.message || "Server error",
    });
  }
}
