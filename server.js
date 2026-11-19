const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 万が一Googleのサーバーが完全に混雑していたときの予備回答
function getBackupReply(message) {
  if (message.includes('ベガ')) {
    return 'ベガはこと座の1等星で、七夕の織姫星として有名な青白い星だぞ！夏の大三角のひとつでもあるんだな！';
  }
  if (message.includes('鳥取')) {
    return '鳥取県はどの市町村からも天の川が見えるほど空気が澄んでいて、「星取県」とも呼ばれているすごい場所だぞ！';
  }
  if (message.includes('コツ') || message.includes('見つけ')) {
    return '星を見つけるコツは、街灯の少ない暗い場所で目を10分ほど暗闇に慣らすことだぞ！まずは一番明るい星から探すんだな！';
  }
  return '今の夜空にはたくさんの星が輝いているぞ！空気の澄んだ場所で南の空を見上げると、季節ごとの明るい1等星がすぐに見つかるはずだな！';
}

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
1. 箇条書きを使わず、80〜120文字程度で分かりやすく要約して答える。
2. 文章の途中で絶対に途切れさせず、必ず「〜だぞ！」「〜だな！」と最後まで言い切る。

【現在空に見える主要な星】${visibleStars || '特になし'}`;

  const requestBody = JSON.stringify({
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
  });

  // 混雑時に自動で切り替えるモデルの順番
  const models = ['gemini-3.8-flash', 'gemini-2.5-flash'];

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
      const apiRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody
      });
      const data = await apiRes.json();

      const parts = data.candidates?.[0]?.content?.parts || [];
      const fullReply = parts
        .filter((part) => part.text && !part.thought)
        .map((part) => part.text)
        .join('');

      if (apiRes.ok && fullReply) {
        console.log(`成功 (${model}):`, fullReply);
        return res.json({ reply: fullReply });
      }

      console.warn(`${model} で取得失敗 (Status: ${apiRes.status}):`, JSON.stringify(data));
      await sleep(1000);
    } catch (err) {
      console.error(`${model} 通信エラー:`, err);
    }
  }

  // すべてのモデルが混雑していた場合でも、エラーにせず予備回答を返す
  console.log('全モデル混雑のため予備回答を返却します');
  return res.json({ reply: getBackupReply(message || '') });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
