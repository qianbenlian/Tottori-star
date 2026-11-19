const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 万が一Googleのサーバーが混雑し続けたときの予備回答
function getBackupReply(message) {
  if (message.includes('ベガ')) {
    return 'ベガはこと座の1等星で、七夕の織姫星として有名な青白い星だよ！夏の大三角のひとつでもあって、とても明るく輝くんだ！';
  }
  if (message.includes('鳥取')) {
    return '鳥取県はどの市町村からも天の川が見えるほど空気が澄んでいて、「星取県」とも呼ばれているすごい場所なんだよ！';
  }
  if (message.includes('コツ') || message.includes('見つけ')) {
    return '星を見つけるコツは、街灯の少ない暗い場所で目を10分ほど暗闇に慣らすことだよ！まずは一番明るい星から探してみよう！';
  }
  return '今の夜空にはたくさんの星が輝いているよ！空気の澄んだ場所で南の空を見上げると、季節ごとの明るい1等星がすぐに見つかるはずだよ！';
}

app.post('/api/chat', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('ERROR: GEMINI_API_KEY is not set');
    return res.status(500).json({ error: 'APIキーが設定されていません' });
  }

  const { message, location, visibleStars } = req.body;
  const systemPrompt = `あなたは${location || '鳥取砂丘'}にいる天文学ガイド「ウサタ先生」（ウサギ）です。
親しみやすく優しい先生として、語尾は「〜だよ！」「〜なんだ！」「〜だぞ！」を使って回答してください。（※「〜だな！」という語尾は使わないこと）

【解説レベルの使い分けルール】
1. 初心者・一般的な質問の場合：星をまったく知らない人でもイメージしやすいように、専門用語をかみくだいて身近な例えを使い、120〜180文字程度で分かりやすく答える。
2. 専門的な質問（「詳しく」「専門的に」「距離・等級・温度・進化」などの言葉がある場合）：天文学の正確なデータ（等級、地球からの距離、表面温度、スペクトル型、恒星の性質など）を交えて、200〜300文字程度で本格的に解説する。

【共通ルール】
・箇条書きは使わず、自然な会話文で答える。
・文章の途中で絶対に途切れさせず、必ず最後まで言い切る。

【現在空に見える主要な星】${visibleStars || '特になし'}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;
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

  // gemini-3.8-flash が混雑(503)して、１回だけ試して、ダメなら予備回答に進む
  for (let attempt = 1; attempt <= 1; attempt++) {
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
        console.log(`成功 (試行 ${attempt}回目):`, fullReply);
        return res.json({ reply: fullReply });
      }

      console.warn(`gemini-3.8-flash 取得失敗 (試行 ${attempt}/3, Status: ${apiRes.status}):`, JSON.stringify(data));

      if (apiRes.status === 503 && attempt < 3) {
        await sleep(1500 * attempt);
      } else {
        break;
      }
    } catch (err) {
      console.error(`通信エラー (試行 ${attempt}/3):`, err);
      if (attempt < 3) {
        await sleep(1500);
      }
    }
  }

  console.log('混雑が続いているため予備回答を返却します');
  return res.json({ reply: getBackupReply(message || '') });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
