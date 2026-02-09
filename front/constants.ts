import { Startup, Rarity } from './types';

// Real YC Startups from the Fantasy YC game
// Data matches backend server.js STARTUPS
export const MOCK_STARTUPS: Startup[] = [
  {
    id: '1',
    name: 'Manus',
    batch: 'W24',
    description: 'AI-powered humanoid robots for manufacturing.',
    value: 2500.00,
    change: 12.4,
    logo: 'https://picsum.photos/40/40?random=1',
    coverImage: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=400&h=500&fit=crop',
    stage: 'Series B',
    score: 98,
    trend: [2000, 2200, 2100, 2300, 2400, 2500]
  },
  {
    id: '2',
    name: 'Lovable',
    batch: 'W24',
    description: 'AI software engineer that builds production apps.',
    value: 1200.00,
    change: 8.5,
    logo: 'https://picsum.photos/40/40?random=2',
    coverImage: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&h=500&fit=crop',
    stage: 'Series A',
    score: 96,
    trend: [900, 950, 1000, 1050, 1100, 1200]
  },
  {
    id: '3',
    name: 'Cursor',
    batch: 'S23',
    description: 'AI-first code editor built for pair programming.',
    value: 2600.00,
    change: 15.2,
    logo: 'https://picsum.photos/40/40?random=3',
    coverImage: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=400&h=500&fit=crop',
    stage: 'Series B',
    score: 97,
    trend: [2000, 2100, 2200, 2400, 2500, 2600]
  },
  {
    id: '4',
    name: 'Anthropic',
    batch: 'S21',
    description: 'AI safety company - creators of Claude.',
    value: 18000.00,
    change: 25.0,
    logo: 'https://picsum.photos/40/40?random=4',
    coverImage: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&h=500&fit=crop',
    stage: 'Series D',
    score: 99,
    trend: [14000, 15000, 16000, 17000, 17500, 18000]
  },
  {
    id: '5',
    name: 'OpenAI',
    batch: 'S15',
    description: 'Leading AI research lab - creators of GPT.',
    value: 157000.00,
    change: 45.0,
    logo: 'https://picsum.photos/40/40?random=5',
    coverImage: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=400&h=500&fit=crop',
    stage: 'Series E+',
    score: 100,
    trend: [100000, 120000, 130000, 140000, 150000, 157000]
  },
  {
    id: '6',
    name: 'Browser Use',
    batch: 'W24',
    description: 'AI browser automation for web agents.',
    value: 50.00,
    change: 5.2,
    logo: 'https://picsum.photos/40/40?random=6',
    coverImage: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400&h=500&fit=crop',
    stage: 'Seed',
    score: 85,
    trend: [40, 42, 45, 47, 48, 50]
  },
  {
    id: '7',
    name: 'Dedalus Labs',
    batch: 'W23',
    description: 'Decentralized infrastructure for Web3.',
    value: 80.00,
    change: 3.8,
    logo: 'https://picsum.photos/40/40?random=7',
    coverImage: 'https://images.unsplash.com/photo-1639322537228-f710d846310a?w=400&h=500&fit=crop',
    stage: 'Series A',
    score: 82,
    trend: [60, 65, 70, 72, 75, 80]
  },
  {
    id: '8',
    name: 'Autumn',
    batch: 'S23',
    description: 'Insurance automation platform.',
    value: 120.00,
    change: 4.5,
    logo: 'https://picsum.photos/40/40?random=8',
    coverImage: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400&h=500&fit=crop',
    stage: 'Series A',
    score: 80,
    trend: [100, 105, 108, 110, 115, 120]
  },
  {
    id: '9',
    name: 'Axiom',
    batch: 'W22',
    description: 'ZK coprocessor for Ethereum smart contracts.',
    value: 200.00,
    change: 8.0,
    logo: 'https://picsum.photos/40/40?random=9',
    coverImage: 'https://images.unsplash.com/photo-1516245834210-c4c142787335?w=400&h=500&fit=crop',
    stage: 'Series B',
    score: 88,
    trend: [150, 160, 170, 180, 190, 200]
  },
  {
    id: '10',
    name: 'Multifactor',
    batch: 'W24',
    description: 'Authentication platform for enterprises.',
    value: 30.00,
    change: 2.1,
    logo: 'https://picsum.photos/40/40?random=10',
    coverImage: 'https://images.unsplash.com/photo-1563986768494-4dee2763ff3f?w=400&h=500&fit=crop',
    stage: 'Seed',
    score: 72,
    trend: [25, 26, 27, 28, 29, 30]
  },
  {
    id: '11',
    name: 'Dome',
    batch: 'S23',
    description: 'Smart home security and automation.',
    value: 25.00,
    change: 1.5,
    logo: 'https://picsum.photos/40/40?random=11',
    coverImage: 'https://images.unsplash.com/photo-1558002038-1055907df827?w=400&h=500&fit=crop',
    stage: 'Seed',
    score: 68,
    trend: [20, 21, 22, 23, 24, 25]
  },
  {
    id: '12',
    name: 'GrazeMate',
    batch: 'W23',
    description: 'AgTech for livestock management.',
    value: 15.00,
    change: 0.8,
    logo: 'https://picsum.photos/40/40?random=12',
    coverImage: 'https://images.unsplash.com/photo-1500595046743-cd271d694d30?w=400&h=500&fit=crop',
    stage: 'Seed',
    score: 65,
    trend: [12, 13, 13, 14, 14, 15]
  }
];

// Rarity colors for display
export const RARITY_COLORS: Record<Rarity, { bg: string; text: string; border: string }> = {
  [Rarity.COMMON]: { bg: 'bg-gray-800', text: 'text-gray-300', border: 'border-gray-600' },
  [Rarity.RARE]: { bg: 'bg-green-600', text: 'text-white', border: 'border-green-500' },
  [Rarity.EPIC]: { bg: 'bg-violet-600', text: 'text-white', border: 'border-violet-500' },
  [Rarity.EPIC_RARE]: { bg: 'bg-purple-600', text: 'text-white', border: 'border-purple-500' },
  [Rarity.LEGENDARY]: { bg: 'bg-orange-500', text: 'text-white', border: 'border-orange-400' },
};

// Rarity multipliers
export const RARITY_MULTIPLIERS: Record<Rarity, number> = {
  [Rarity.COMMON]: 1,
  [Rarity.RARE]: 3,
  [Rarity.EPIC]: 5,
  [Rarity.EPIC_RARE]: 8,
  [Rarity.LEGENDARY]: 10,
};