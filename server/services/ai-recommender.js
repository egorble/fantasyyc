/**
 * AI Card Recommender using OpenRouter API
 * Analyzes recent startup activity (last 10 days) and recommends
 * the best 5 cards from a player's collection for tournament entry.
 */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Model priority: arcee first, then gemma, then stepfun
const AI_MODELS = [
    'arcee-ai/trinity-large-preview:free',
    'google/gemma-3-4b-it:free',
    'stepfun/step-3.5-flash:free',
];

const SYSTEM_PROMPT = `You are UnicornX AI, the expert advisor for a fantasy startup league game. Players choose 5 NFT cards representing tech startups, and their score depends on real-world startup activity (tweets, partnerships, product launches, funding, etc.).

Your job: analyze recent startup activity data and recommend the BEST 5 cards from the player's collection to maximize their tournament score.

SCORING RULES:
- Each card earns: (startup's daily base points) × (card rarity multiplier)
- Multipliers: Common=1x, Rare=3x, Epic=5x, Legendary=10x
- Total score = sum of all 5 cards' points over the tournament duration
- Higher activity startups earn more base points
- A Legendary card on an active startup is worth 10x a Common card on the same startup

ANALYSIS APPROACH:
1. Look at which startups had the most activity & highest scores recently
2. Consider activity TRENDS (increasing activity = likely to continue)
3. Factor in card multipliers — a Rare card (3x) on a top startup may beat a Common (1x) on a mediocre one
4. Diversification vs concentration: recommend based on expected value

RESPONSE FORMAT:
Return ONLY a valid JSON object with this structure:
{
  "recommended": [tokenId1, tokenId2, tokenId3, tokenId4, tokenId5],
  "reasoning": "Brief 2-3 sentence explanation of why these 5 cards were chosen",
  "insights": [
    {"name": "StartupName", "outlook": "bullish|neutral|bearish", "reason": "One sentence why"}
  ]
}

- "recommended" must contain exactly 5 token IDs from the player's collection
- "insights" should cover the top 3-5 most relevant startups
- Keep reasoning concise and actionable`;

/**
 * Generate AI card recommendation.
 * @param {Array<{tokenId: number, name: string, rarity: string, multiplier: number}>} playerCards
 * @param {Array<{startup_name: string, event_type: string, description: string, points: number, date: string, ai_summary: string}>} recentNews
 * @returns {Promise<{recommended: number[], reasoning: string, insights: Array}>}
 */
export async function generateRecommendation(playerCards, recentNews) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        console.warn('[AI Recommender] No OPENROUTER_API_KEY set');
        return fallbackRecommendation(playerCards);
    }

    if (playerCards.length < 5) {
        return {
            recommended: playerCards.map(c => c.tokenId),
            reasoning: `You only have ${playerCards.length} card(s). You need at least 5 to enter. Buy more packs!`,
            insights: [],
            source: 'insufficient_cards'
        };
    }

    // Build news summary per startup
    const newsByStartup = {};
    for (const event of recentNews) {
        if (!newsByStartup[event.startup_name]) {
            newsByStartup[event.startup_name] = { totalPoints: 0, eventCount: 0, events: [] };
        }
        const entry = newsByStartup[event.startup_name];
        entry.totalPoints += event.points || 0;
        entry.eventCount++;
        if (entry.events.length < 5) {
            entry.events.push(event.ai_summary || event.description?.substring(0, 100));
        }
    }

    // Build the prompt
    const cardsList = playerCards.map(c =>
        `- Token #${c.tokenId}: ${c.name} (${c.rarity}, ${c.multiplier}x)`
    ).join('\n');

    const newsSummary = Object.entries(newsByStartup)
        .sort((a, b) => b[1].totalPoints - a[1].totalPoints)
        .map(([name, data]) => {
            const headlines = data.events.filter(Boolean).join('; ');
            return `${name}: ${data.totalPoints} pts across ${data.eventCount} events. Headlines: ${headlines}`;
        }).join('\n');

    const prompt = `Here are the player's available cards:\n${cardsList}\n\nRecent startup activity (last 10 days):\n${newsSummary || 'No recent activity data available.'}\n\nRecommend the best 5 cards. Return ONLY valid JSON, no markdown.`;

    // Try each model in fallback chain
    for (const model of AI_MODELS) {
        const startTime = Date.now();
        try {
            console.log(`[AI Recommender] Trying model: ${model}`);
            const response = await fetch(OPENROUTER_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model,
                    messages: [
                        { role: 'user', content: SYSTEM_PROMPT + '\n\n---\n\n' + prompt },
                    ],
                    temperature: 0.3,
                    max_tokens: 1500,
                }),
            });

            const latencyMs = Date.now() - startTime;

            if (!response.ok) {
                const err = await response.text();
                console.error(`[AI Recommender] ${model} error ${response.status}: ${err.substring(0, 100)}`);
                continue;
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content?.trim();

            if (!content) {
                console.error(`[AI Recommender] ${model} empty response`);
                continue;
            }

            // Parse JSON from response
            let result;
            try {
                const cleaned = content.replace(/^```json?\s*/, '').replace(/\s*```$/, '');
                result = JSON.parse(cleaned);
            } catch (parseErr) {
                console.error(`[AI Recommender] ${model} JSON parse failed:`, content.substring(0, 200));
                continue;
            }

            // Validate recommended array
            if (!Array.isArray(result.recommended) || result.recommended.length !== 5) {
                console.warn(`[AI Recommender] ${model} returned ${result.recommended?.length} cards, expected 5`);
                // Try to fix: filter to only valid tokenIds
                const validIds = new Set(playerCards.map(c => c.tokenId));
                const filtered = (result.recommended || []).filter(id => validIds.has(id));
                if (filtered.length < 5) {
                    console.error(`[AI Recommender] ${model} only ${filtered.length} valid IDs, falling back`);
                    continue;
                }
                result.recommended = filtered.slice(0, 5);
            }

            // Ensure all recommended IDs exist in player's collection
            const validIds = new Set(playerCards.map(c => c.tokenId));
            const allValid = result.recommended.every(id => validIds.has(id));
            if (!allValid) {
                console.warn(`[AI Recommender] ${model} recommended invalid token IDs, filtering`);
                result.recommended = result.recommended.filter(id => validIds.has(id));
                if (result.recommended.length < 5) {
                    // Fill remaining from best available
                    const used = new Set(result.recommended);
                    const remaining = playerCards
                        .filter(c => !used.has(c.tokenId))
                        .sort((a, b) => b.multiplier - a.multiplier);
                    for (const card of remaining) {
                        if (result.recommended.length >= 5) break;
                        result.recommended.push(card.tokenId);
                    }
                }
            }

            console.log(`[AI Recommender] ${model} succeeded (${latencyMs}ms)`);
            return {
                recommended: result.recommended,
                reasoning: result.reasoning || 'AI recommendation based on recent startup activity.',
                insights: result.insights || [],
                source: 'ai',
                model
            };

        } catch (err) {
            console.error(`[AI Recommender] ${model} error: ${err.message}`);
            continue;
        }
    }

    console.warn('[AI Recommender] All models failed, using heuristic fallback');
    return fallbackRecommendation(playerCards, recentNews);
}

/**
 * Heuristic fallback when AI is unavailable.
 * Picks the 5 cards with highest (multiplier × startup activity) expected value.
 */
function fallbackRecommendation(playerCards, recentNews = []) {
    // Sum up recent points per startup
    const startupPoints = {};
    for (const event of recentNews) {
        startupPoints[event.startup_name] = (startupPoints[event.startup_name] || 0) + (event.points || 0);
    }

    // Score each card: multiplier × activity (or just multiplier if no data)
    const scored = playerCards.map(card => ({
        ...card,
        expectedValue: card.multiplier * (startupPoints[card.name] || 1)
    }));

    scored.sort((a, b) => b.expectedValue - a.expectedValue);
    const top5 = scored.slice(0, 5);

    return {
        recommended: top5.map(c => c.tokenId),
        reasoning: 'Recommendation based on card rarity multipliers and recent startup activity scores.',
        insights: [],
        source: 'heuristic'
    };
}
