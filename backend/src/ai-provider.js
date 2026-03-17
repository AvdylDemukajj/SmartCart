const SYSTEM_PROMPT = 'You are SmartCart recipe planner. Return strict JSON array of objects: {key,name,etaMin,promptTemplate}.';

async function openAiSuggest({ apiKey, model, pantryNames }) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Pantry ingredients: ${pantryNames.join(', ')}. Return object with field suggestions as array of max 3 recipes.`,
        },
      ],
    }),
  });

  if (!response.ok) throw new Error('AI_PROVIDER_ERROR');
  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) throw new Error('AI_PROVIDER_ERROR');
  const parsed = JSON.parse(content);
  if (!Array.isArray(parsed.suggestions)) throw new Error('AI_PROVIDER_ERROR');
  return parsed.suggestions;
}

export async function generateRecipeSuggestions({ pantryNames, fallbackSuggestions }) {
  const provider = process.env.AI_PROVIDER ?? 'stub';
  if (provider !== 'openai') return fallbackSuggestions;

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
  if (!apiKey) return fallbackSuggestions;

  try {
    const suggestions = await openAiSuggest({ apiKey, model, pantryNames });
    return suggestions
      .filter((item) => item && typeof item.name === 'string' && typeof item.etaMin === 'number')
      .slice(0, 3)
      .map((item, idx) => ({
        key: item.key ?? `ai_${idx + 1}`,
        name: item.name,
        etaMin: item.etaMin,
        promptTemplate: item.promptTemplate ?? 'AI generated recipe template',
      }));
  } catch {
    return fallbackSuggestions;
  }
}
