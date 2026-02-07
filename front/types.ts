export enum Rarity {
  COMMON = 'Common',
  RARE = 'Rare',
  LEGENDARY = 'Legendary'
}

export interface Startup {
  id: string;
  name: string;
  batch: string;
  description: string;
  value: number;
  change: number;
  logo: string;
  coverImage: string;
  stage: string;
  score: number;
  trend: number[]; // For sparkline
}

export interface CardData {
  id: string;
  startupName: string;
  rarity: Rarity;
  value: string;
  multiplier: string;
  image: string;
}

export enum NavSection {
  HOME = 'Home',
  MARKETPLACE = 'Marketplace',
  PORTFOLIO = 'My Portfolio',
  LEAGUES = 'Leagues',
  ANALYTICS = 'Analytics'
}

export interface UserProfile {
  name: string;
  handle: string;
  balanceXTZ: number;
  avatar: string;
}