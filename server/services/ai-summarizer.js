/**
 * AI Feed Summarizer using OpenRouter API
 * Generates Bloomberg/BBC-style financial news headlines from raw tweets.
 */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const SYSTEM_PROMPT = `You are a senior financial news editor at Bloomberg or BBC Business. Your job is to transform raw social media posts from tech startups into authoritative, professional news headlines.

STYLE RULES:
- Write in the style of Bloomberg Terminal headlines or BBC Business breaking news
- Use active voice and present tense ("Raises", "Launches", "Partners With")
- Lead with the company name when possible
- Include specific numbers, metrics, or named entities from the tweet when available
- Be factual and precise — never embellish or add information not in the source
- Convey significance: why does this matter?
- No hashtags, no emojis, no exclamation marks, no clickbait
- No quotation marks unless directly quoting someone
- Keep headlines between 40-90 characters

HEADLINE PATTERNS BY EVENT TYPE:
- FUNDING: "[Company] Raises $[X] in [Round Type] to [Purpose]"
- PARTNERSHIP: "[Company] Partners With [Partner] for [Goal]"
- PRODUCT_LAUNCH: "[Company] Launches [Product], Targeting [Market]"
- KEY_HIRE: "[Company] Taps [Person/Role] to Lead [Area]"
- ACQUISITION: "[Company] Acquires [Target] in [Detail]"
- REVENUE/GROWTH: "[Company] Hits [Metric], Signals [Trend]"
- MEDIA_MENTION: "[Company] Gains [Outlet] Coverage on [Topic]"
- ENGAGEMENT: "[Company] Post Draws [Scale] Engagement on [Topic]"

Always respond with a valid JSON array of strings. One headline per event, same order as input.`;

/**
 * Summarize a batch of feed events into Bloomberg/BBC-style headlines.
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

    // Build batch prompt with structured context
    const eventList = events.map((e, i) =>
        `${i + 1}. Company: ${e.startup_name} | Event: ${e.event_type} | Impact: ${e.points}pts\n   Tweet: "${e.description}"`
    ).join('\n\n');

    const prompt = `Write a professional news headline for each of the following ${events.length} startup events. Return ONLY a JSON array of strings, no markdown, no explanation.

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
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: prompt },
                ],
                temperature: 0.4,
                max_tokens: 2000,
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
            summary: (headlines[i] || truncateFallback(e.description)).substring(0, 120),
        }));

    } catch (err) {
        console.error('[AI] Fetch error:', err.message);
        return fallbackSummaries(events);
    }
}

function truncateFallback(text) {
    if (text.length <= 90) return text;
    const cut = text.substring(0, 87);
    const lastSpace = cut.lastIndexOf(' ');
    return (lastSpace > 40 ? cut.substring(0, lastSpace) : cut) + '...';
}

function fallbackSummaries(events) {
    return events.map(e => ({
        id: e.id,
        summary: truncateFallback(e.description),
    }));
}
