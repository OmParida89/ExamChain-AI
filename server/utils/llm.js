require('dotenv').config({ path: __dirname + '/../.env' });
const axios = require('axios');

async function generateVariants(original, concept, difficulty) {
  console.log('API KEY:', process.env.OPENROUTER_API_KEY ? 'Found' : 'MISSING');

  const prompt = `You are an exam question generator.

Given this base question:
"${original}"

Concept: ${concept}
Difficulty level: ${difficulty}/5

Generate 5 unique variants of this question. Each variant must:
- Test the same concept at the same difficulty
- Have 4 answer options (A, B, C, D)
- Have exactly one correct answer
- Be worded differently so students cannot share answers

Respond ONLY with a valid JSON array, no markdown, no explanation:
[
  {
    "questionText": "...",
    "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
    "correctAnswer": "A"
  }
]`;

  // Free-tier (":free") OpenRouter models run on shared, deprioritized capacity and
  // can occasionally return an incomplete/malformed response under load — confirmed
  // this happens intermittently even with a valid key and a working model. One retry
  // papers over that transient flakiness instead of failing the teacher's first click.
  const MAX_ATTEMPTS = 2;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          // openai/gpt-oss-120b:free was discontinued by OpenRouter (now paid-only).
          // If this model is ever deprecated/rate-limited too, check currently available
          // free models at https://openrouter.ai/api/v1/models (filter for ":free" ids) —
          // nvidia/nemotron-3-nano-30b-a3b:free and nvidia/nemotron-nano-9b-v2:free were
          // also confirmed working as fallbacks.
          model: 'nvidia/nemotron-3-super-120b-a12b:free',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.8
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'http://localhost:3000',
            'X-Title': 'ExamChain'
          }
        }
      );

      const raw = response.data?.choices?.[0]?.message?.content;
      if (!raw) throw new Error('Model returned no content');

      console.log('LLM raw response:', raw);
      const cleaned = raw.replace(/```json|```/g, '').trim();
      return JSON.parse(cleaned);
    } catch (err) {
      console.error(`LLM Error (attempt ${attempt}/${MAX_ATTEMPTS}):`, err.response?.data || err.message);
    }
  }

  throw new Error('The AI model returned an unexpected response after retrying. Please try generating again.');
}

module.exports = { generateVariants };