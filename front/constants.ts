import { Startup, CardData, Rarity } from './types';

export const MOCK_STARTUPS: Startup[] = [
  {
    id: '1',
    name: 'Nexus AI',
    batch: 'W24',
    description: 'Generative infrastructure for enterprise scale.',
    value: 124.50,
    change: 2.4,
    logo: 'https://picsum.photos/40/40?random=1',
    coverImage: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&h=500&fit=crop',
    stage: 'Series B',
    score: 92,
    trend: [110, 115, 112, 118, 120, 124]
  },
  {
    id: '2',
    name: 'Stellar Health',
    batch: 'S23',
    description: 'Personalized longevity tracking and DNA analysis.',
    value: 95.20,
    change: -0.5,
    logo: 'https://picsum.photos/40/40?random=2',
    coverImage: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&h=500&fit=crop',
    stage: 'Seed',
    score: 88,
    trend: [98, 97, 96, 95, 96, 95]
  },
  {
    id: '3',
    name: 'Orbit Space',
    batch: 'W23',
    description: 'Low latency satellite internet for rural areas.',
    value: 210.00,
    change: 5.8,
    logo: 'https://picsum.photos/40/40?random=3',
    coverImage: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=500&fit=crop',
    stage: 'Series A',
    score: 95,
    trend: [180, 190, 185, 200, 205, 210]
  },
  {
    id: '4',
    name: 'Volt Motors',
    batch: 'S22',
    description: 'Solid state EV batteries with 1000 mile range.',
    value: 88.40,
    change: 1.2,
    logo: 'https://picsum.photos/40/40?random=4',
    coverImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=500&fit=crop',
    stage: 'IPO',
    score: 76,
    trend: [80, 82, 85, 84, 86, 88]
  },
  {
    id: '5',
    name: 'GitLab',
    batch: 'W15',
    description: 'DevOps platform delivered as a single application.',
    value: 45.30,
    change: 3.1,
    logo: 'https://picsum.photos/40/40?random=5',
    coverImage: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=500&fit=crop',
    stage: 'Public',
    score: 82,
    trend: [40, 41, 42, 43, 44, 45]
  },
  {
    id: '6',
    name: 'Reddit',
    batch: 'S05',
    description: 'The front page of the internet.',
    value: 34.10,
    change: -1.2,
    logo: 'https://picsum.photos/40/40?random=6',
    coverImage: 'https://images.unsplash.com/photo-1557862921-37829c790f19?w=400&h=500&fit=crop',
    stage: 'Public',
    score: 89,
    trend: [36, 35, 35, 34, 34, 34]
  },
  {
    id: '7',
    name: 'Brex',
    batch: 'W17',
    description: 'The financial OS for the next generation of business.',
    value: 12.10,
    change: 4.5,
    logo: 'https://picsum.photos/40/40?random=7',
    coverImage: 'https://images.unsplash.com/photo-1573496359-0933ca23594b?w=400&h=500&fit=crop',
    stage: 'Series C',
    score: 91,
    trend: [10, 11, 11, 12, 12, 12]
  },
  {
    id: '8',
    name: 'Deel',
    batch: 'W19',
    description: 'Payroll and compliance for international teams.',
    value: 156.00,
    change: 1.8,
    logo: 'https://picsum.photos/40/40?random=8',
    coverImage: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=500&fit=crop',
    stage: 'Series D',
    score: 94,
    trend: [150, 152, 153, 155, 154, 156]
  }
];

export const MOCK_PACK_CARDS: CardData[] = [
  { id: 'c1', startupName: 'Vercel', rarity: Rarity.COMMON, value: '10.5', multiplier: '1.2x', image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&h=500&fit=crop' },
  { id: 'c2', startupName: 'Supabase', rarity: Rarity.COMMON, value: '15.2', multiplier: '1.1x', image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=400&h=500&fit=crop' },
  { id: 'c3', startupName: 'OpenAI', rarity: Rarity.LEGENDARY, value: '500.0', multiplier: '5.0x', image: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=400&h=500&fit=crop' },
  { id: 'c4', startupName: 'Brex', rarity: Rarity.RARE, value: '45.0', multiplier: '2.5x', image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&h=500&fit=crop' },
  { id: 'c5', startupName: 'Rippling', rarity: Rarity.COMMON, value: '12.8', multiplier: '1.3x', image: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&h=500&fit=crop' },
];