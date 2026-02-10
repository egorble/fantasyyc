/**
 * Twitter League Scorer
 * Fetches tweets from startups and calculates league points based on events.
 * Uses twitterapi.io advanced_search with date filtering.
 */

import { appendFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const LOG_DIR = join(__dirname, '../server/logs');

if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
}

function logTweet(userName, tweet, analysis) {
    const logFile = join(LOG_DIR, `tweets-${new Date().toISOString().split('T')[0]}.log`);
    const logEntry = {
        timestamp: new Date().toISOString(),
        userName,
        tweetId: tweet.id,
        tweetText: tweet.text,
        likes: tweet.likeCount || 0,
        retweets: tweet.retweetCount || 0,
        analysis
    };
    appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
}

const API_KEY = 'new1_d1be13bf77c84f1886c5a79cdb692816';
const API_BASE_URL = 'https://api.twitterapi.io/twitter';

// Twitter handle -> game startup name
const STARTUP_MAPPING = {
    'openclaw': 'Openclaw',
    'lovable_dev': 'Lovable',
    'cursor_ai': 'Cursor',
    'OpenAI': 'OpenAI',
    'AnthropicAI': 'Anthropic',
    'browser_use': 'Browser Use',
    'dedaluslabs': 'Dedalus Labs',
    'autumnpricing': 'Autumn',
    'axiom_xyz': 'Axiom',
    'MultifactorCOM': 'Multifactor',
    'getdomeapi': 'Dome',
    'GrazeMate': 'GrazeMate',
    'tornyolsystems': 'Tornyol Systems',
    'heypocket': 'Pocket',
    'Caretta': 'Caretta',
    'axionorbital': 'AxionOrbital Space',
    'freeportmrkts': 'Freeport Markets',
    'ruvopay': 'Ruvo',
    'lightberryai': 'Lightberry'
};

// Event scoring rules
const EVENT_SCORES = {
    FUNDING: {
        base: 500,
        perMillion: 100,
        seedMax: 800,
        seriesAPlus: 1500,
        keywords: [
            'raised', 'funding', 'seed', 'series a', 'series b', 'series c', 'series d',
            'round', 'investment', 'investors', 'backed by', 'led by', 'capital',
            'venture', 'financing', 'fundraise', 'fundraising', 'raise', 'closed',
            'pre-seed', 'angel', 'vc', 'valuation', 'invested', 'funding round'
        ]
    },
    PARTNERSHIP: {
        base: 300,
        perMajorPartner: 50,
        majorPartners: ['aws', 'amazon', 'google', 'microsoft', 'meta', 'apple', 'nvidia', 'ibm', 'oracle', 'salesforce'],
        keywords: [
            'partner', 'partnership', 'collaboration', 'collab', 'integrated with',
            'integration', 'teaming up', 'team up', 'working with', 'partnering',
            'joined forces', 'alliance', 'strategic', 'cooperate', 'cooperation',
            'working together', 'announce partnership', 'proud to partner'
        ]
    },
    KEY_HIRE: {
        base: 150,
        cLevel: 50,
        titles: ['cto', 'ceo', 'cpo', 'cfo', 'vp', 'chief', 'head of', 'director', 'lead'],
        keywords: [
            'hired', 'joined', 'welcome', 'joining', 'new hire', 'joins',
            'welcoming', 'onboarding', 'brought on', 'appointed', 'promoting',
            'excited to announce', 'thrilled to have', 'joins the team',
            'new team member', 'joining our team', 'pleased to announce'
        ]
    },
    REVENUE: {
        base: 400,
        perMillion: 100,
        keywords: [
            'arr', 'mrr', 'revenue', 'sales', 'annual recurring revenue',
            'monthly recurring revenue', 'run rate', 'bookings', 'billing',
            'profitable', 'profitability', 'earnings', 'income'
        ]
    },
    PRODUCT_LAUNCH: {
        base: 250,
        viral: 100,
        viralThreshold: 1000,
        keywords: [
            'launched', 'launch', 'live', 'beta', 'announcing', 'released',
            'introducing', 'new feature', 'now available', 'shipping',
            'rollout', 'rolling out', 'unveiling', 'debut', 'going live',
            'available now', 'just shipped', 'excited to share'
        ]
    },
    ACQUISITION: {
        base: 2000,
        keywords: [
            'acquired', 'acquisition', 'merger', 'acquired by', 'merge',
            'acquiring', 'bought', 'purchase', 'purchasing', 'takeover',
            'join forces', 'combining with', 'merging with'
        ]
    },
    MEDIA_MENTION: {
        base: 200,
        major: 100,
        majorOutlets: ['techcrunch', 'forbes', 'wsj', 'wall street journal', 'nytimes', 'new york times', 'bloomberg', 'cnbc', 'reuters', 'wired', 'verge'],
        keywords: [
            'featured', 'covered', 'article', 'mentioned', 'press',
            'interview', 'story', 'spotlight', 'highlighted', 'profiled',
            'wrote about', 'coverage', 'appeared on', 'featured in'
        ]
    },
    GROWTH: {
        base: 200,
        per10x: 50,
        keywords: [
            'users', 'signups', 'growth', 'milestone', 'customers', 'reached',
            'surpassed', 'hit', 'crossed', 'achieved', 'grown to',
            'doubled', 'tripled', '10x', '100x', 'scale', 'scaling'
        ]
    },
    ENGAGEMENT: {
        base: 50,
        perThousandLikes: 1,
        perRetweet: 2,
        perThousandViews: 0.1,
        maxDaily: 500
    }
};

// ============ Helper functions ============

function containsKeywords(text, keywords) {
    const lowerText = text.toLowerCase();
    return keywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
}

function extractAmount(text) {
    const patterns = [
        /\$(\d+\.?\d*)\s*([MB])/i,
        /(\d+\.?\d*)\s*million/i,
        /(\d+\.?\d*)\s*billion/i
    ];
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            const value = parseFloat(match[1]);
            const unit = match[2] || (text.toLowerCase().includes('billion') ? 'B' : 'M');
            return unit.toUpperCase() === 'B' ? value * 1000 : value;
        }
    }
    return 0;
}

function extractGrowth(text) {
    const patterns = [
        /(\d+)x\s*growth/i,
        /(\d+)%\s*(increase|growth)/i
    ];
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) return parseInt(match[1]);
    }
    return 0;
}

// ============ Tweet analysis ============

function analyzeTweet(tweet) {
    const text = tweet.text;
    const points = { total: 0, events: [] };

    if (containsKeywords(text, EVENT_SCORES.FUNDING.keywords)) {
        const amount = extractAmount(text);
        let score = EVENT_SCORES.FUNDING.base;
        if (amount > 0) {
            score += Math.floor(amount) * EVENT_SCORES.FUNDING.perMillion;
            if (text.toLowerCase().includes('seed')) {
                score = Math.min(score, EVENT_SCORES.FUNDING.seedMax);
            } else if (text.toLowerCase().match(/series [a-z]/)) {
                score = Math.min(score, EVENT_SCORES.FUNDING.seriesAPlus);
            }
        }
        points.events.push({ type: 'FUNDING', score, details: `Amount: $${amount}M` });
        points.total += score;
    }

    if (containsKeywords(text, EVENT_SCORES.PARTNERSHIP.keywords)) {
        let score = EVENT_SCORES.PARTNERSHIP.base;
        const foundPartners = EVENT_SCORES.PARTNERSHIP.majorPartners.filter(p =>
            text.toLowerCase().includes(p)
        );
        score += foundPartners.length * EVENT_SCORES.PARTNERSHIP.perMajorPartner;
        points.events.push({ type: 'PARTNERSHIP', score, details: `Partners: ${foundPartners.join(', ') || 'generic'}` });
        points.total += score;
    }

    if (containsKeywords(text, EVENT_SCORES.KEY_HIRE.keywords)) {
        let score = EVENT_SCORES.KEY_HIRE.base;
        const isCLevel = EVENT_SCORES.KEY_HIRE.titles.some(t => text.toLowerCase().includes(t));
        if (isCLevel) score += EVENT_SCORES.KEY_HIRE.cLevel;
        points.events.push({ type: 'KEY_HIRE', score, details: isCLevel ? 'C-level' : 'Regular' });
        points.total += score;
    }

    if (containsKeywords(text, EVENT_SCORES.REVENUE.keywords)) {
        const amount = extractAmount(text);
        let score = EVENT_SCORES.REVENUE.base;
        if (amount > 0) score += Math.floor(amount) * EVENT_SCORES.REVENUE.perMillion;
        points.events.push({ type: 'REVENUE', score, details: `Amount: $${amount}M` });
        points.total += score;
    }

    if (containsKeywords(text, EVENT_SCORES.PRODUCT_LAUNCH.keywords)) {
        let score = EVENT_SCORES.PRODUCT_LAUNCH.base;
        if (tweet.likeCount >= EVENT_SCORES.PRODUCT_LAUNCH.viralThreshold) {
            score += EVENT_SCORES.PRODUCT_LAUNCH.viral;
        }
        points.events.push({ type: 'PRODUCT_LAUNCH', score, details: `Likes: ${tweet.likeCount}` });
        points.total += score;
    }

    if (containsKeywords(text, EVENT_SCORES.ACQUISITION.keywords)) {
        const score = EVENT_SCORES.ACQUISITION.base;
        points.events.push({ type: 'ACQUISITION', score, details: 'Acquisition event' });
        points.total += score;
    }

    if (containsKeywords(text, EVENT_SCORES.MEDIA_MENTION.keywords)) {
        let score = EVENT_SCORES.MEDIA_MENTION.base;
        const majorOutlet = EVENT_SCORES.MEDIA_MENTION.majorOutlets.some(o => text.toLowerCase().includes(o));
        if (majorOutlet) score += EVENT_SCORES.MEDIA_MENTION.major;
        points.events.push({ type: 'MEDIA_MENTION', score, details: majorOutlet ? 'Major outlet' : 'General' });
        points.total += score;
    }

    if (containsKeywords(text, EVENT_SCORES.GROWTH.keywords)) {
        const growthRate = extractGrowth(text);
        let score = EVENT_SCORES.GROWTH.base;
        if (growthRate >= 10) score += Math.floor(growthRate / 10) * EVENT_SCORES.GROWTH.per10x;
        points.events.push({ type: 'GROWTH', score, details: `Growth: ${growthRate}x` });
        points.total += score;
    }

    let engagementScore = EVENT_SCORES.ENGAGEMENT.base;
    engagementScore += Math.floor((tweet.likeCount || 0) / 1000) * EVENT_SCORES.ENGAGEMENT.perThousandLikes;
    engagementScore += (tweet.retweetCount || 0) * EVENT_SCORES.ENGAGEMENT.perRetweet;
    engagementScore += Math.floor((tweet.viewCount || 0) / 1000) * EVENT_SCORES.ENGAGEMENT.perThousandViews;
    engagementScore = Math.min(engagementScore, EVENT_SCORES.ENGAGEMENT.maxDaily);

    if (engagementScore > EVENT_SCORES.ENGAGEMENT.base) {
        points.events.push({ type: 'ENGAGEMENT', score: engagementScore, details: `L:${tweet.likeCount} RT:${tweet.retweetCount}` });
        points.total += engagementScore;
    }

    return points;
}

// ============ API functions ============

/**
 * Fetch all tweets from a user for a specific date (YYYY-MM-DD).
 * Uses advanced_search with from: since: until: operators.
 * Paginates through all pages (20 tweets per page).
 */
async function fetchTweetsByDate(userName, date) {
    const nextDate = getNextDate(date);
    const query = `from:${userName} since:${date}_00:00:00_UTC until:${nextDate}_00:00:00_UTC`;
    const allTweets = [];
    let cursor = '';
    let page = 0;
    const MAX_PAGES = 5; // safety limit

    while (page < MAX_PAGES) {
        const params = new URLSearchParams({
            query,
            queryType: 'Latest',
        });
        if (cursor) params.set('cursor', cursor);

        const url = `${API_BASE_URL}/tweet/advanced_search?${params}`;
        console.log(`   Fetching page ${page + 1}: ${userName} (${date})`);

        try {
            const response = await fetch(url, {
                headers: { 'X-API-Key': API_KEY }
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`   API error: ${response.status} - ${errorText}`);
                break;
            }

            const data = await response.json();

            // advanced_search returns { tweets: [...], has_next_page, next_cursor }
            // No "status" field - presence of tweets array means success
            if (!data.tweets && data.status !== 'success') {
                console.error(`   API returned: ${data.msg || data.message || 'Unknown error'}`);
                break;
            }

            const tweets = data.tweets || data.data?.tweets || [];
            allTweets.push(...tweets);

            if (!data.has_next_page || !data.next_cursor) break;
            cursor = data.next_cursor;
            page++;

            // rate limit between pages
            await new Promise(r => setTimeout(r, 1000));
        } catch (error) {
            console.error(`   Fetch error: ${error.message}`);
            break;
        }
    }

    return allTweets;
}

/**
 * Get the next date string (YYYY-MM-DD) after the given date.
 */
function getNextDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().split('T')[0];
}

/**
 * Process a startup's tweets for a specific date.
 * Returns scoring result with all analyzed tweets.
 */
async function processStartupForDate(userName, date) {
    const tweets = await fetchTweetsByDate(userName, date);

    if (tweets.length === 0) {
        return {
            userName,
            date,
            tweets: [],
            totalPoints: 0,
            tweetCount: 0
        };
    }

    console.log(`   Found ${tweets.length} tweets for @${userName} on ${date}`);

    const results = tweets.map(tweet => {
        const analysis = analyzeTweet(tweet);
        logTweet(userName, tweet, { points: analysis.total, events: analysis.events });

        return {
            id: tweet.id,
            text: (tweet.text || '').substring(0, 200),
            createdAt: tweet.createdAt,
            metrics: {
                likes: tweet.likeCount || 0,
                retweets: tweet.retweetCount || 0,
                replies: tweet.replyCount || 0
            },
            points: analysis.total,
            events: analysis.events
        };
    });

    const totalPoints = results.reduce((sum, r) => sum + r.points, 0);

    return {
        userName,
        date,
        tweets: results,
        totalPoints,
        tweetCount: tweets.length
    };
}

export { processStartupForDate, analyzeTweet, STARTUP_MAPPING };
