/**
 * Twitter League Scorer
 * Fetches latest tweets from startups and calculates league points based on events
 * API: https://docs.twitterapi.io/
 */

const API_KEY = 'new1_d1be13bf77c84f1886c5a79cdb692816';
const API_BASE_URL = 'https://api.twitterapi.io/twitter';

// List of all 19 startups (Twitter handles) - ALL VERIFIED
const STARTUPS = [
    'OpenAI',        // @OpenAI
    'AnthropicAI',   // @AnthropicAI
    'stripe',        // @stripe
    'Rippling',      // @Rippling
    'deel',          // @deel
    'brexHQ',        // @brexHQ
    'mercury',       // @mercury
    'tryramp',       // @tryramp
    'retool',        // @retool
    'vercel',        // @vercel
    'linear',        // @linear
    'NotionHQ',      // @NotionHQ
    'figma',         // @figma
    'airtable',      // @airtable
    'Superhuman',    // @Superhuman
    'scale_AI',      // @scale_AI
    'Instacart',     // @Instacart
    'DoorDash',      // @DoorDash
    'coinbase'       // @coinbase
];

// Event scoring rules
const EVENT_SCORES = {
    FUNDING: {
        base: 500,
        perMillion: 100,
        seedMax: 800,
        seriesAPlus: 1500,
        keywords: ['raised', 'funding', 'seed', 'series a', 'series b', 'series c', 'round', 'investment']
    },
    PARTNERSHIP: {
        base: 300,
        perMajorPartner: 50,
        majorPartners: ['aws', 'amazon', 'google', 'microsoft', 'meta', 'apple'],
        keywords: ['partner', 'partnership', 'collaboration', 'collab', 'integrated with', 'integration']
    },
    KEY_HIRE: {
        base: 150,
        cLevel: 50,
        titles: ['cto', 'ceo', 'cpo', 'cfo', 'vp', 'chief'],
        keywords: ['hired', 'joined', 'welcome', 'joining', 'new hire']
    },
    REVENUE: {
        base: 400,
        perMillion: 100,
        keywords: ['arr', 'mrr', 'revenue', 'sales']
    },
    PRODUCT_LAUNCH: {
        base: 250,
        viral: 100,
        viralThreshold: 1000,
        keywords: ['launched', 'launch', 'live', 'beta', 'announcing', 'released']
    },
    ACQUISITION: {
        base: 2000,
        keywords: ['acquired', 'acquisition', 'merger', 'acquired by']
    },
    MEDIA_MENTION: {
        base: 200,
        major: 100,
        majorOutlets: ['techcrunch', 'forbes', 'wsj', 'nytimes', 'bloomberg'],
        keywords: ['featured', 'covered', 'article']
    },
    GROWTH: {
        base: 200,
        per10x: 50,
        keywords: ['users', 'signups', 'growth', 'milestone', 'customers']
    },
    ENGAGEMENT: {
        base: 50,
        perThousandLikes: 1,
        perRetweet: 2,
        perThousandViews: 0.1,
        maxDaily: 500
    }
};

/**
 * Fetch latest tweets for a user
 */
async function fetchUserTweets(userName, limit = 3) {
    try {
        const url = `${API_BASE_URL}/user/last_tweets?userName=${userName}&includeReplies=false`;
        console.log(`   → Fetching: ${url}`);

        const response = await fetch(url, {
            headers: {
                'X-API-Key': API_KEY
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        console.log(`   → API Response status:`, data.status);

        if (data.status !== 'success') {
            throw new Error(`API returned error: ${data.msg || data.message || 'Unknown error'}`);
        }

        // API returns tweets in data.data.tweets structure
        const tweets = data.data?.tweets || [];

        if (!Array.isArray(tweets) || tweets.length === 0) {
            console.warn(`   ⚠️  No tweets found for @${userName}`);
            return [];
        }

        // Return only the requested number of tweets
        return tweets.slice(0, limit);
    } catch (error) {
        console.error(`Error fetching tweets for @${userName}:`, error.message);
        return [];
    }
}

/**
 * Check if text contains any of the keywords
 */
function containsKeywords(text, keywords) {
    const lowerText = text.toLowerCase();
    return keywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
}

/**
 * Extract dollar amount from text (e.g., "$4.1M", "$10M", "$1.5B")
 */
function extractAmount(text) {
    const patterns = [
        /\$(\d+\.?\d*)\s*([MB])/i,  // $4.1M, $10M, $1.5B
        /(\d+\.?\d*)\s*million/i,   // 4.1 million
        /(\d+\.?\d*)\s*billion/i    // 1.5 billion
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            const value = parseFloat(match[1]);
            const unit = match[2] || (text.toLowerCase().includes('billion') ? 'B' : 'M');
            return unit.toUpperCase() === 'B' ? value * 1000 : value; // Convert to millions
        }
    }
    return 0;
}

/**
 * Extract growth percentage from text (e.g., "10x growth", "100% increase")
 */
function extractGrowth(text) {
    const patterns = [
        /(\d+)x\s*growth/i,
        /(\d+)%\s*(increase|growth)/i
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            return parseInt(match[1]);
        }
    }
    return 0;
}

/**
 * Analyze a single tweet and calculate points
 */
function analyzeTweet(tweet) {
    const text = tweet.text;
    const points = {
        total: 0,
        events: []
    };

    // Funding
    if (containsKeywords(text, EVENT_SCORES.FUNDING.keywords)) {
        const amount = extractAmount(text);
        let score = EVENT_SCORES.FUNDING.base;

        if (amount > 0) {
            score += Math.floor(amount) * EVENT_SCORES.FUNDING.perMillion;

            // Apply caps
            if (text.toLowerCase().includes('seed')) {
                score = Math.min(score, EVENT_SCORES.FUNDING.seedMax);
            } else if (text.toLowerCase().match(/series [a-z]/)) {
                score = Math.min(score, EVENT_SCORES.FUNDING.seriesAPlus);
            }
        }

        points.events.push({ type: 'FUNDING', score, details: `Amount: $${amount}M` });
        points.total += score;
    }

    // Partnership
    if (containsKeywords(text, EVENT_SCORES.PARTNERSHIP.keywords)) {
        let score = EVENT_SCORES.PARTNERSHIP.base;
        const foundPartners = EVENT_SCORES.PARTNERSHIP.majorPartners.filter(partner =>
            text.toLowerCase().includes(partner)
        );
        score += foundPartners.length * EVENT_SCORES.PARTNERSHIP.perMajorPartner;

        points.events.push({ type: 'PARTNERSHIP', score, details: `Partners: ${foundPartners.join(', ') || 'generic'}` });
        points.total += score;
    }

    // Key Hire
    if (containsKeywords(text, EVENT_SCORES.KEY_HIRE.keywords)) {
        let score = EVENT_SCORES.KEY_HIRE.base;
        const isCLevel = EVENT_SCORES.KEY_HIRE.titles.some(title =>
            text.toLowerCase().includes(title)
        );
        if (isCLevel) score += EVENT_SCORES.KEY_HIRE.cLevel;

        points.events.push({ type: 'KEY_HIRE', score, details: isCLevel ? 'C-level' : 'Regular' });
        points.total += score;
    }

    // Revenue
    if (containsKeywords(text, EVENT_SCORES.REVENUE.keywords)) {
        const amount = extractAmount(text);
        let score = EVENT_SCORES.REVENUE.base;
        if (amount > 0) {
            score += Math.floor(amount) * EVENT_SCORES.REVENUE.perMillion;
        }

        points.events.push({ type: 'REVENUE', score, details: `Amount: $${amount}M` });
        points.total += score;
    }

    // Product Launch
    if (containsKeywords(text, EVENT_SCORES.PRODUCT_LAUNCH.keywords)) {
        let score = EVENT_SCORES.PRODUCT_LAUNCH.base;
        if (tweet.likeCount >= EVENT_SCORES.PRODUCT_LAUNCH.viralThreshold) {
            score += EVENT_SCORES.PRODUCT_LAUNCH.viral;
        }

        points.events.push({ type: 'PRODUCT_LAUNCH', score, details: `Likes: ${tweet.likeCount}` });
        points.total += score;
    }

    // Acquisition
    if (containsKeywords(text, EVENT_SCORES.ACQUISITION.keywords)) {
        const score = EVENT_SCORES.ACQUISITION.base;
        points.events.push({ type: 'ACQUISITION', score, details: 'Acquisition event' });
        points.total += score;
    }

    // Media Mention
    if (containsKeywords(text, EVENT_SCORES.MEDIA_MENTION.keywords)) {
        let score = EVENT_SCORES.MEDIA_MENTION.base;
        const majorOutlet = EVENT_SCORES.MEDIA_MENTION.majorOutlets.some(outlet =>
            text.toLowerCase().includes(outlet)
        );
        if (majorOutlet) score += EVENT_SCORES.MEDIA_MENTION.major;

        points.events.push({ type: 'MEDIA_MENTION', score, details: majorOutlet ? 'Major outlet' : 'General' });
        points.total += score;
    }

    // Growth
    if (containsKeywords(text, EVENT_SCORES.GROWTH.keywords)) {
        const growthRate = extractGrowth(text);
        let score = EVENT_SCORES.GROWTH.base;
        if (growthRate >= 10) {
            score += Math.floor(growthRate / 10) * EVENT_SCORES.GROWTH.per10x;
        }

        points.events.push({ type: 'GROWTH', score, details: `Growth: ${growthRate}x` });
        points.total += score;
    }

    // Engagement (calculated from tweet metrics)
    let engagementScore = EVENT_SCORES.ENGAGEMENT.base;
    engagementScore += Math.floor(tweet.likeCount / 1000) * EVENT_SCORES.ENGAGEMENT.perThousandLikes;
    engagementScore += tweet.retweetCount * EVENT_SCORES.ENGAGEMENT.perRetweet;
    engagementScore += Math.floor((tweet.viewCount || 0) / 1000) * EVENT_SCORES.ENGAGEMENT.perThousandViews;
    engagementScore = Math.min(engagementScore, EVENT_SCORES.ENGAGEMENT.maxDaily);

    if (engagementScore > EVENT_SCORES.ENGAGEMENT.base) {
        points.events.push({ type: 'ENGAGEMENT', score: engagementScore, details: `L:${tweet.likeCount} RT:${tweet.retweetCount}` });
        points.total += engagementScore;
    }

    return points;
}

/**
 * Process a startup and return scoring results
 */
async function processStartup(userName, isRealData = true) {
    console.log(`\n📊 Processing @${userName}...`);

    if (!isRealData) {
        // Return stub data (only if explicitly disabled)
        return {
            userName,
            tweets: [],
            totalPoints: 0,
            isStub: true,
            message: 'Disabled - skipped'
        };
    }

    const tweets = await fetchUserTweets(userName, 3);

    if (tweets.length === 0) {
        return {
            userName,
            tweets: [],
            totalPoints: 0,
            error: 'No tweets found or API error'
        };
    }

    console.log(`   ✓ Fetched ${tweets.length} tweets`);

    const results = tweets.map(tweet => {
        const analysis = analyzeTweet(tweet);
        return {
            id: tweet.id,
            text: tweet.text.substring(0, 100) + '...',
            createdAt: tweet.createdAt,
            metrics: {
                likes: tweet.likeCount,
                retweets: tweet.retweetCount,
                replies: tweet.replyCount
            },
            points: analysis.total,
            events: analysis.events
        };
    });

    const totalPoints = results.reduce((sum, r) => sum + r.points, 0);

    return {
        userName,
        tweets: results,
        totalPoints,
        isStub: false
    };
}

/**
 * Main function - process all startups
 */
async function main() {
    console.log('🚀 Twitter League Scorer Started');
    console.log('━'.repeat(60));

    const results = [];

    for (const startup of STARTUPS) {
        // Fetch real data for ALL startups (set to false to disable specific ones)
        const isRealData = true;
        const result = await processStartup(startup, isRealData);
        results.push(result);

        // Add delay to respect rate limits (5 seconds for free tier)
        console.log(`   ⏳ Waiting 5 seconds (API rate limit)...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
    }

    console.log('\n\n📈 FINAL RESULTS');
    console.log('━'.repeat(60));

    // Sort by points
    results.sort((a, b) => b.totalPoints - a.totalPoints);

    results.forEach((result, index) => {
        console.log(`\n${index + 1}. @${result.userName}`);
        console.log(`   Total Points: ${result.totalPoints}`);

        if (result.isStub) {
            console.log(`   Status: ${result.message}`);
        } else if (result.error) {
            console.log(`   Error: ${result.error}`);
        } else {
            console.log(`   Tweets analyzed: ${result.tweets.length}`);
            result.tweets.forEach((tweet, i) => {
                console.log(`\n   Tweet ${i + 1}: ${tweet.points} points`);
                console.log(`   "${tweet.text}"`);
                if (tweet.events.length > 0) {
                    tweet.events.forEach(event => {
                        console.log(`      → ${event.type}: +${event.score} (${event.details})`);
                    });
                }
            });
        }
    });

    console.log('\n\n✅ Processing complete!');
    console.log('━'.repeat(60));

    // Return results for potential database storage
    return results;
}

// Run the script
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { main, processStartup, analyzeTweet };
