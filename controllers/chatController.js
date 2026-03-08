const { randomUUID } = require("crypto");
const OpenAI = require("openai");
const { query } = require("../db/postgres");
const { SUPPORTED_LANGUAGES, normalizeLanguageCode } = require("../utils/language");

const SAFETY_DISCLAIMER =
  "This assistant provides informational support only and does not replace a licensed doctor.";
const DEFAULT_FALLBACK_RESPONSE =
  "I could not generate a complete response. Please monitor symptoms and contact a licensed doctor if symptoms worsen.";

let openAiClient = null;

const getOpenAiClient = () => {
  if (!process.env.OPENAI_API_KEY) {
    const error = new Error("OPENAI_API_KEY is not configured.");
    error.statusCode = 500;
    throw error;
  }

  if (!openAiClient) {
    openAiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  return openAiClient;
};

const getModelName = () => process.env.OPENAI_MODEL || "gpt-4.1-mini";

const asListString = (value) => {
  if (!Array.isArray(value) || value.length === 0) {
    return "None reported";
  }

  return value.join(", ");
};

const buildPatientHistory = (record) => {
  if (!record) {
    return "No patient record found in the database.";
  }

  const lastVisitDate = record.last_visit ? new Date(record.last_visit) : null;
  const lastVisit =
    lastVisitDate && !Number.isNaN(lastVisitDate.getTime())
      ? lastVisitDate.toISOString().slice(0, 10)
      : "Unknown";

  return [
    `Patient ID: ${record.patient_id}`,
    `Name: ${record.name || "Unknown"}`,
    `Age: ${record.age ?? "Unknown"}`,
    `Gender: ${record.gender || "Unknown"}`,
    `Allergies: ${asListString(record.allergies)}`,
    `Conditions: ${asListString(record.conditions)}`,
    `Medications: ${asListString(record.medications)}`,
    `Recent symptoms: ${asListString(record.recent_symptoms)}`,
    `Last visit: ${lastVisit}`
  ].join("\n");
};

const buildSystemPrompt = ({ patientHistory, languageCode }) => {
  const languageLabel = SUPPORTED_LANGUAGES[languageCode]?.label || "English";

  return `You are an AI medical assistant.

Patient medical history:
${patientHistory}

Tasks:
1. Identify possible minor illnesses
2. Explain reasoning
3. Suggest safe home remedies
4. Suggest OTC medicines if appropriate
5. Warn about drug allergies
6. Tell the user when to visit a doctor

Rules:
- Never provide dangerous medical advice
- Never claim to replace a doctor
- Always include this exact disclaimer at the end of every response: "${SAFETY_DISCLAIMER}"
- Keep guidance conservative and safety-focused
- If symptoms indicate emergency risk, clearly advise immediate emergency care
- Use markdown headings and bullet lists for readability
- Keep the response concise and practical
${languageCode !== "en" ? `- Respond in ${languageLabel}.` : ""}`;
};

const ensureDisclaimer = (text) => {
  const normalized = String(text || "").trim();
  if (!normalized) {
    return `${DEFAULT_FALLBACK_RESPONSE}\n\n${SAFETY_DISCLAIMER}`;
  }

  if (normalized.toLowerCase().includes("does not replace a licensed doctor")) {
    return normalized;
  }

  return `${normalized}\n\n${SAFETY_DISCLAIMER}`;
};

const extractMessageText = (content) => {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((entry) => {
      if (typeof entry === "string") {
        return entry;
      }

      if (entry?.type === "text") {
        return entry.text || "";
      }

      return "";
    })
    .join("");
};

const fetchPatientRecord = async (userId) => {
  const result = await query(
    `SELECT patient_id, name, age, gender, allergies, conditions, medications, recent_symptoms, last_visit, created_at
     FROM patient_records
     WHERE patient_id = $1
     LIMIT 1`,
    [userId]
  );

  return result.rows[0] || null;
};

const fetchConversationContext = async (userId, conversationId, limit = 10) => {
  if (!conversationId) {
    return [];
  }

  const result = await query(
    `SELECT role, content
     FROM chat_history
     WHERE user_id = $1 AND conversation_id = $2
     ORDER BY created_at DESC
     LIMIT $3`,
    [userId, conversationId, limit]
  );

  return result.rows
    .reverse()
    .filter((entry) => entry.role === "user" || entry.role === "assistant")
    .map((entry) => ({
      role: entry.role,
      content: entry.content
    }));
};

const saveChatMessage = async ({ conversationId, userId, role, content, language }) => {
  await query(
    `INSERT INTO chat_history (conversation_id, user_id, role, content, language)
     VALUES ($1, $2, $3, $4, $5)`,
    [conversationId, userId, role, content, language]
  );
};

const buildChatMessages = ({ patientHistory, userMessage, languageCode, contextMessages }) => [
  {
    role: "system",
    content: buildSystemPrompt({ patientHistory, languageCode })
  },
  ...contextMessages,
  {
    role: "user",
    content: `Patient medical history:\n${patientHistory}\n\nUser symptoms:\n${userMessage}`
  }
];

const sendSseEvent = (res, payload) => {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
};

const runStreamingCompletion = async ({
  req,
  res,
  userId,
  conversationId,
  languageCode,
  aiMessages
}) => {
  const openai = getOpenAiClient();
  const model = getModelName();
  const abortController = new AbortController();
  let responseText = "";

  req.on("close", () => {
    abortController.abort();
  });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  sendSseEvent(res, { type: "ready", conversationId });

  try {
    const stream = await openai.chat.completions.create({
      model,
      messages: aiMessages,
      temperature: 0.2,
      stream: true,
      signal: abortController.signal
    });

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content || "";
      if (!delta) {
        continue;
      }

      responseText += delta;
      sendSseEvent(res, { type: "chunk", content: delta });
    }

    const safeResponse = ensureDisclaimer(responseText);
    if (safeResponse.length > responseText.length) {
      const appendix = safeResponse.slice(responseText.length);
      if (appendix) {
        sendSseEvent(res, { type: "chunk", content: appendix });
      }
    }

    await saveChatMessage({
      conversationId,
      userId,
      role: "assistant",
      content: safeResponse,
      language: languageCode
    });

    sendSseEvent(res, {
      type: "done",
      conversationId,
      reply: safeResponse
    });

    res.end();
  } catch (error) {
    if (error.name === "AbortError") {
      return;
    }

    throw error;
  }
};

const handleChatRequest = async (req, res, next) => {
  try {
    const payload = req.validatedBody;
    const userId = payload.userId;
    const languageCode = normalizeLanguageCode(payload.language);
    const conversationId = payload.conversationId || randomUUID();
    const patientRecord = await fetchPatientRecord(userId);
    const patientHistory = buildPatientHistory(patientRecord);
    const contextMessages = await fetchConversationContext(userId, conversationId);

    await saveChatMessage({
      conversationId,
      userId,
      role: "user",
      content: payload.message,
      language: languageCode
    });

    const aiMessages = buildChatMessages({
      patientHistory,
      userMessage: payload.message,
      languageCode,
      contextMessages
    });

    if (payload.stream) {
      await runStreamingCompletion({
        req,
        res,
        userId,
        conversationId,
        languageCode,
        aiMessages
      });
      return;
    }

    const openai = getOpenAiClient();
    const completion = await openai.chat.completions.create({
      model: getModelName(),
      messages: aiMessages,
      temperature: 0.2
    });

    const rawContent = completion.choices?.[0]?.message?.content;
    const responseText = ensureDisclaimer(extractMessageText(rawContent));

    await saveChatMessage({
      conversationId,
      userId,
      role: "assistant",
      content: responseText,
      language: languageCode
    });

    return res.status(200).json({
      conversationId,
      reply: responseText
    });
  } catch (error) {
    if (req.validatedBody?.stream && res.headersSent) {
      sendSseEvent(res, {
        type: "error",
        message: "Chat response generation failed."
      });
      res.end();
      return;
    }

    error.statusCode = error.statusCode || 500;
    return next(error);
  }
};

const getChatHistory = async (req, res, next) => {
  try {
    const { userId } = req.validatedParams;
    const { conversationId, limit } = req.validatedQuery;
    const params = [userId];
    let sql = `SELECT conversation_id, role, content, language, created_at
               FROM chat_history
               WHERE user_id = $1`;

    if (conversationId) {
      params.push(conversationId);
      sql += ` AND conversation_id = $${params.length}`;
    }

    params.push(limit);
    sql += ` ORDER BY created_at DESC LIMIT $${params.length}`;

    const result = await query(sql, params);
    const messages = result.rows
      .reverse()
      .map((entry) => ({
        conversationId: entry.conversation_id,
        role: entry.role,
        content: entry.content,
        language: entry.language,
        createdAt: entry.created_at
      }));

    return res.status(200).json({
      conversationId: conversationId || messages[0]?.conversationId || null,
      messages
    });
  } catch (error) {
    error.statusCode = 500;
    return next(error);
  }
};

module.exports = {
  handleChatRequest,
  getChatHistory
};
