const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

app.post('/api/chat', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('ERROR: GEMINI_API_KEY is not set');
    return res.status(500).json({ error: 'APIキーが設定されていません' });
  }

  const { message, location, visibleStars } = req.body;
  const systemPrompt = `あなたは${location || '鳥取砂丘'}にいる天文学ガイド「ウサタ先生」（ウサギ）です。
語尾は「〜だぞ！」「〜だな！」を使い、以下のルールで回答してください。

【回答ルール】
1. 箇条書きを使わず、100〜150文字程度で分かりやすく要約して答える。
2. 文章の途中で絶対に途切れさせず、必ず「〜だぞ！」「〜だな！」と最後まで言い切る。

【現在空に見える主要な星】${visibleStars || '特になし'}`;

  try {
    const apiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\n質問: ${message}` }]
          }
        ],
        generationConfig: {
          maxOutputTokens: 2048,
          temperature: 0.7
        }
      })
    });

    const data = await apiRes.json();

    if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
      return res.json({ reply: data.candidates[0].content.parts[0].text });
    }

    console.error('Gemini API Error details:', JSON.stringify(data));
    return res.status(500).json({ error: 'AIからの回答取得に失敗しました', details: data });
  } catch (err) {
    console.error('Server Catch Error:', err);
    return res.status(500).json({ error: '通信エラーが発生しました' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
