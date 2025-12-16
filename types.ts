export interface UserInput {
  birthDate: string;
  birthTime: string;
  gender: 'male' | 'female';
  name: string;
  apiKey?: string; // Optional user provided API key
}

export interface Pillar {
  stem: string; // Hanja
  stemKorean: string;
  stemTenGod: string; // E.g., "상관", "비견"
  branch: string; // Hanja
  branchKorean: string;
  branchTenGod: string; // E.g., "정재", "편관"
  element: 'Wood' | 'Fire' | 'Earth' | 'Metal' | 'Water';
  color: string;
  jiJangGan: string[]; // Hidden Stems
}

export interface CycleItem {
  age: number | string;
  ganji: string; // Hanja e.g. 甲子
  ganjiKorean: string; // Korean e.g. 갑자
  tenGod: string; // Simplified Ten God for the stem
}

export interface SajuAnalysisResult {
  // Header Info
  koreanAge: number;
  solarDateStr: string;
  lunarDateStr: string;
  solarTermStr: string; // Jeol-gi e.g. Mangjong

  yearPillar: Pillar;
  monthPillar: Pillar;
  dayPillar: Pillar;
  hourPillar: Pillar;
  elementCounts: {
    Wood: number;
    Fire: number;
    Earth: number;
    Metal: number;
    Water: number;
  };
  missingElements: {
    element: string;
    priority: number; // 1 or 2
  }[];
  // Manse-ryok Data
  daewun: CycleItem[]; // 10-year cycles
  saewun: CycleItem[]; // Yearly cycles
  wolwun: CycleItem[]; // Monthly cycles (focused on near future)
  
  // Readings
  dayMasterReading: string; 
  chaeumAdvice: {
    summary: string;
    color: string;
    direction: string;
    items: string;
  };
  healthAnalysis: {
    weakOrgans: string;
    symptoms: string;
    medicalAdvice: string;
    foodRecommendation: string;
  };
  fortune2026: {
    overall: string;
    wealth: string;
    career: string;
    health: string;
    love: string;
  };
  luckyTable: {
    date: string;
    time: string;
    direction: string;
  }[];
  fengShuiThesis: string; // New: Detailed Feng Shui Advice
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  isError?: boolean;
}