const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

app.post('/api/chat', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'APIキーが設定されていません' });
  }

  const { message, location, visibleStars } = req.body;
  const systemPrompt = `あなたは${location || '鳥取砂丘'}にいる天文学ガイド「ウサタ先生」（ウサギ）です。
語尾は「〜だぞ！」「〜だな！」を使い、以下のルールで回答してください。

【回答ルール】
1. 箇条書きを使わず、要点だけを【120〜150文字程度】でサクッと短く要約して答える。
2. スマホ画面で一目で読める分かりやすい言葉で最後までしっかり答える。

【現在空に見える主要な星】${visibleStars || '特になし'}`;

  try {
    const apiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: message }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { maxOutputTokens: 250, temperature: 0.5 }
      })
    });

    const data = await apiRes.json();
    console.log('Gemini API Response:', JSON.stringify(data)); // 👈 ここを追加するとRenderのログにエラー詳細が出ます

    const data = await apiRes.json();
    if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
      return res.json({ reply: data.candidates[0].content.parts[0].text });
    }
    return res.status(500).json({ error: 'AIからの回答取得に失敗しました' });
  } catch (err) {
    return res.status(500).json({ error: '通信エラーが発生しました' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
