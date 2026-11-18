const DEFAULT_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3.1-flash-lite-preview',
];
const REQUEST_TIMEOUT_MS = 25000;
const MAX_ROUNDS = 5;
let stickyWorkingModel = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getModelCandidates() {
  const configured = process.env.GEMINI_MODEL?.trim();
  const base = configured ? [configured, ...DEFAULT_MODELS] : DEFAULT_MODELS;
  const list = stickyWorkingModel ? [stickyWorkingModel, ...base] : base;
  return [...new Set(list)];
}

export async function generateStructuredJson({ apiKey, prompt, responseSchema }) {
  if (!apiKey) {
    throw new Error('缺少 GEMINI_API_KEY 環境變數');
  }

  const unavailableModels = new Set();
  let lastError = null;

  // 最多進行 MAX_ROUNDS 輪備援與指數退避，應對尖峰期暫時性 503 / 429 / 逾時
  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const models = getModelCandidates().filter((m) => !unavailableModels.has(m));
    if (models.length === 0) break;

    for (const model of models) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.3,
              responseMimeType: 'application/json',
              responseSchema,
            },
          }),
        });

        if (res.ok) {
          const payload = await res.json();
          const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!text) {
            throw new Error(`Gemini (${model}) 回傳空內容`);
          }
          const parsed = JSON.parse(text);
          stickyWorkingModel = model;
          return { data: parsed, model };
        }

        const errBody = await res.text();
        lastError = new Error(`Gemini API (${model}) HTTP ${res.status}: ${errBody.slice(0, 240)}`);

        if (res.status === 404) {
          unavailableModels.add(model);
          continue;
        }
        if (res.status === 429 || res.status >= 500) {
          console.warn(
            `  [Gemini 備援] ${model} 回應 HTTP ${res.status}（第 ${round + 1} 輪），切換下一個模型...`
          );
          await sleep(1000 * (round + 1));
          continue;
        }
        throw lastError;
      } catch (err) {
        if (err.name === 'AbortError' || err.name === 'SyntaxError' || err instanceof TypeError) {
          const reason = err.name === 'AbortError' ? `超過 ${REQUEST_TIMEOUT_MS / 1000}s 逾時` : err.message;
          lastError = new Error(`Gemini (${model}) 請求異常: ${reason}`);
          console.warn(`  [Gemini 備援] ${model} 異常（${reason}），切換下一個模型...`);
          await sleep(1000);
          continue;
        }
        throw err;
      } finally {
        clearTimeout(timer);
      }
    }

    if (round < MAX_ROUNDS - 1) {
      await sleep(2000 * (round + 1));
    }
  }

  throw lastError || new Error('所有 Gemini 模型嘗試皆失敗');
}

const NEWS_ITEM_SCHEMA = {
  type: 'OBJECT',
  properties: {
    index: { type: 'INTEGER' },
    titleReading: { type: 'STRING' },
    titleZh: { type: 'STRING' },
    summaryZh: { type: 'STRING' },
    vocabulary: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          word: { type: 'STRING' },
          reading: { type: 'STRING' },
          jlpt: { type: 'STRING', enum: ['N1', 'N2', 'N3'] },
          pos: { type: 'STRING' },
          meaningZh: { type: 'STRING' },
          exampleJa: { type: 'STRING' },
          exampleZh: { type: 'STRING' },
          usageNote: { type: 'STRING' },
        },
        required: ['word', 'reading', 'jlpt', 'pos', 'meaningZh', 'exampleJa', 'exampleZh', 'usageNote'],
      },
    },
  },
  required: ['index', 'titleReading', 'titleZh', 'summaryZh', 'vocabulary'],
};

const NEWS_BATCH_SCHEMA = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: NEWS_ITEM_SCHEMA,
    },
  },
  required: ['items'],
};

const CLIP_ITEM_SCHEMA = {
  type: 'OBJECT',
  properties: {
    index: { type: 'INTEGER' },
    titleZh: { type: 'STRING' },
    gameOrTopic: { type: 'STRING' },
    contextSummaryZh: { type: 'STRING' },
    slangVocab: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          term: { type: 'STRING' },
          reading: { type: 'STRING' },
          tag: { type: 'STRING' },
          meaningZh: { type: 'STRING' },
          timestamp: { type: 'STRING' },
          exampleJa: { type: 'STRING' },
          exampleZh: { type: 'STRING' },
        },
        required: ['term', 'reading', 'tag', 'meaningZh', 'timestamp', 'exampleJa', 'exampleZh'],
      },
    },
    grammarPoints: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          pattern: { type: 'STRING' },
          connection: { type: 'STRING' },
          nuance: { type: 'STRING' },
          explanationZh: { type: 'STRING' },
          exampleJa: { type: 'STRING' },
          exampleZh: { type: 'STRING' },
        },
        required: ['pattern', 'connection', 'nuance', 'explanationZh', 'exampleJa', 'exampleZh'],
      },
    },
  },
  required: ['index', 'titleZh', 'gameOrTopic', 'contextSummaryZh', 'slangVocab', 'grammarPoints'],
};

const CLIP_BATCH_SCHEMA = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: CLIP_ITEM_SCHEMA,
    },
  },
  required: ['items'],
};

export async function analyzeNewsBatch(apiKey, articles) {
  const listText = articles
    .map(
      (a, idx) =>
        `[新聞 index=${idx}]
- 領域分類：${a.category}
- 新聞來源：${a.source}
- 日文標題：${a.titleJa}
- 摘要／內文摘錄：${a.bodyExcerpt || a.description || a.titleJa}`
    )
    .join('\n\n');

  const prompt = `你是一位專業的台灣日語教學老師。請針對以下 ${articles.length} 篇日本新聞，分別產生繁體中文（台灣慣用語）的日語學習輔助資料，並依照對應 index 放入 items 陣列。

${listText}

【每篇新聞嚴格輸出要求】
1. index：對應上方輸入的 index 整數。
2. titleReading：將日文標題轉為完整平假名讀音（含空格斷詞）。
3. titleZh：自然流暢的繁體中文新聞標題翻譯。
4. summaryZh：撰寫約 110～140 個繁體中文字的新聞重點概要，條理清晰、忠於原文。
5. vocabulary：挑選 6 個出現在該篇新聞領域中的「JLPT N3～N1 核心生詞」。
   - **絕對過濾掉 JLPT N5～N4 基礎單字**（特別排除 食べる、高い、人、日本、会社、時間、今日、出席、説明、会議、確認、必要、理由、準備、利用 等 N4 以下常見詞）。
   - 優先挑選 N1、N2 程度以及新聞高頻複合詞（如 補正予算、与野党、深刻化、懸念、見極める 等）。
   - jlpt 欄位只能填 "N1"、"N2" 或 "N3"。
   - pos 請用繁體中文標註詞性（如 名詞、名詞・サ変、他動詞、自動詞、形容動詞）。
   - exampleJa 請撰寫包含該單詞的自然新聞例句，並附上 exampleZh 繁中翻譯。
   - usageNote 請用繁體中文精簡說明該詞在新聞中的搭配詞（collocation）或語境差異。`;

  return generateStructuredJson({ apiKey, prompt, responseSchema: NEWS_BATCH_SCHEMA });
}

export async function analyzeVspoClipsBatch(apiKey, clips) {
  const listText = clips
    .map(
      (c, idx) =>
        `[影片 index=${idx}]
- 影片標題：${c.titleJa}
- 剪輯頻道：${c.channelName}
- 登場成員：${c.memberNames.join('、') || 'ぶいすぽっ！成員'}
- 影片說明摘錄：${c.description?.slice(0, 450) || '無'}`
    )
    .join('\n\n');

  const prompt = `你是一位熟悉日本 VTuber 實況圈（特別是 ぶいすぽっ！ VSPO!）與日語口語教學的台灣老師。請針對以下 ${clips.length} 支 YouTube 切り抜き（精華剪輯），分別製作聽力輔助筆記，並依照對應 index 放入 items 陣列。

${listText}

【每支影片嚴格輸出要求】
1. index：對應上方輸入的 index 整數。
2. titleZh：將影片日文標題自然翻譯為台灣實況觀眾看得懂的繁體中文標題。
3. gameOrTopic：辨識影片主題（如 VALORANT、Apex Legends、Street Fighter 6、LoL、Overwatch 2、雑談・コラボ 等）。
4. contextSummaryZh：用 70～110 字繁體中文介紹該剪輯的情境看點與對話氛圍（語氣生動自然，不捏造具體未提及的勝負結果）。
5. slangVocab：列出 **剛好 5 個** 聽懂該遊戲／雜談題材必備的「口語單字 / VTuber 常用語」。
   - tag 可選：FPS術語、格鬥遊戲術語、MOBA術語、遊戲用語、VTuber常用語、日常口語、網路略語、擬態詞。
   - timestamp 給出合理的參考時間標記格式（如 "00:45"、"01:30"、"02:15"）。
   - exampleJa 與 exampleZh 須貼合該成員說話口吻與主題。
6. grammarPoints：列出 **3 個** 在該類型實況對話高頻出現的「實用日文口語文法 / 語氣助詞解析」（如 〜じゃん、〜ってば、〜ちゃう、〜んだけど、〜てか、〜かなって 等）。
   - connection 說明接續方式，nuance 簡述語氣色彩，explanationZh 以繁體中文說明聽力辨識重點與語感。`;

  return generateStructuredJson({ apiKey, prompt, responseSchema: CLIP_BATCH_SCHEMA });
}
