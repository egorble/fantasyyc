/**
 * AI Feed Summarizer using OpenRouter API
 * Generates short, engaging headlines from raw tweet descriptions.
 */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Summarize a batch of feed events into short headlines.
 * @param {Array<{id: number, startup_name: string, event_type: string, description: string, points: number}>} events
 * @returns {Array<{id: number, summary: string}>}
 */
export async function summarizeFeedEvents(events) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        console.warn('[AI] No OPENROUTER_API_KEY set, using fallback truncation');
        return events.map(e => ({
            id: e.id,
            summary: truncateFallback(e.description),
        }));
    }

    if (events.length === 0) return [];

    // Build batch prompt
    const eventList = events.map((e, i) =>
        `${i + 1}. [${e.startup_name}] (${e.event_type}, ${e.points}pts): ${e.description}`
    ).join('\n');

    const prompt = `You are a crypto/startup news headline writer. Given the following raw tweet descriptions from startups, write a short, catchy headline for each (max 60 characters). Return ONLY a JSON array of strings, one headline per event, in the same order. No markdown, no explanation.

Events:
${eventList}`;

    try {
        const response = await fetch(OPENROUTER_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'openai/gpt-4o-mini',
                messages: [
                    { role: 'system', content: 'You generate short news headlines. Always respond with a valid JSON array of strings.' },
                    { role: 'user', content: prompt },
                ],
                temperature: 0.7,
                max_tokens: 1500,
            }),
        });

        if (!response.ok) {
            const err = await response.text();
            console.error('[AI] OpenRouter API error:', response.status, err);
            return fallbackSummaries(events);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content?.trim();

        if (!content) {
            console.error('[AI] Empty response from OpenRouter');
            return fallbackSummaries(events);
        }

        // Parse JSON array from response
        let headlines;
        try {
            // Handle potential markdown code blocks
            const cleaned = content.replace(/^```json?\s*/, '').replace(/\s*```$/, '');
            headlines = JSON.parse(cleaned);
        } catch (parseErr) {
            console.error('[AI] Failed to parse response:', content);
            return fallbackSummaries(events);
        }

        if (!Array.isArray(headlines) || headlines.length !== events.length) {
            console.warn('[AI] Headline count mismatch, using partial results');
        }

        return events.map((e, i) => ({
            id: e.id,
            summary: (headlines[i] || truncateFallback(e.description)).substring(0, 80),
        }));

    } catch (err) {
        console.error('[AI] Fetch error:', err.message);
        return fallbackSummaries(events);
    }
}

function truncateFallback(text) {
    if (text.length <= 60) return text;
    const cut = text.substring(0, 57);
    const lastSpace = cut.lastIndexOf(' ');
    return (lastSpace > 30 ? cut.substring(0, lastSpace) : cut) + '...';
}

function fallbackSummaries(events) {
    return events.map(e => ({
        id: e.id,
        summary: truncateFallback(e.description),
    }));
}
