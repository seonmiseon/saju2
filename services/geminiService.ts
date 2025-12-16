import { GoogleGenAI, Type, Schema } from "@google/genai";
import { SajuAnalysisResult, UserInput, Pillar, CycleItem } from "../types";
// @ts-ignore
import { Solar, Lunar } from "lunar-javascript";

// ---------------------------------------------------------------------------
// 1. Static Data & Lookup Tables
// ---------------------------------------------------------------------------

const GAN = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const ZHI = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const GAN_KOR = ["갑", "을", "병", "정", "무", "기", "경", "신", "임", "계"];
const ZHI_KOR = ["자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해"];

type ElementType = 'Wood' | 'Fire' | 'Earth' | 'Metal' | 'Water';

const ELEMENT_MAP: Record<string, ElementType> = {
  "甲": "Wood", "乙": "Wood", "寅": "Wood", "卯": "Wood",
  "丙": "Fire", "丁": "Fire", "巳": "Fire", "午": "Fire",
  "戊": "Earth", "己": "Earth", "辰": "Earth", "戌": "Earth", "丑": "Earth", "未": "Earth",
  "庚": "Metal", "辛": "Metal", "申": "Metal", "酉": "Metal",
  "壬": "Water", "癸": "Water", "亥": "Water", "子": "Water",
};

const COLOR_MAP: Record<ElementType, string> = {
  "Wood": "#4A7c59", "Fire": "#D9534F", "Earth": "#Eebb4d", "Metal": "#Aaaaaa", "Water": "#292b2c"
};

const TEN_GODS_MAP = [
  ["비견", "겁재", "식신", "상관", "편재", "정재", "편관", "정관", "편인", "정인"], // 甲
  ["겁재", "비견", "상관", "식신", "정재", "편재", "정관", "편관", "정인", "편인"], // 乙
  ["편인", "정인", "비견", "겁재", "식신", "상관", "편재", "정재", "편관", "정관"], // 丙
  ["정인", "편인", "겁재", "비견", "상관", "식신", "정재", "편재", "정관", "편관"], // 丁
  ["편관", "정관", "편인", "정인", "비견", "겁재", "식신", "상관", "편재", "정재"], // 戊
  ["정관", "편관", "정인", "편인", "겁재", "비견", "상관", "식신", "정재", "편재"], // 己
  ["편재", "정재", "편관", "정관", "편인", "정인", "비견", "겁재", "식신", "상관"], // 庚
  ["정재", "편재", "정관", "편관", "정인", "편인", "겁재", "비견", "상관", "식신"], // 辛
  ["식신", "상관", "편재", "정재", "편관", "정관", "편인", "정인", "비견", "겁재"], // 壬
  ["상관", "식신", "정재", "편재", "정관", "편관", "정인", "편인", "겁재", "비견"], // 癸
];

const BRANCH_MAIN_QI: Record<string, string> = {
  "子": "癸", "丑": "己", "寅": "甲", "卯": "乙", "辰": "戊", "巳": "丙",
  "午": "丁", "未": "己", "申": "庚", "酉": "辛", "戌": "戊", "亥": "壬"
};

// Ji-jang-gan (Hidden Stems) Simplified
const JIJANGGAN: Record<string, string[]> = {
  "子": ["壬", "癸"], "丑": ["癸", "辛", "己"], "寅": ["戊", "丙", "甲"], "卯": ["甲", "乙"],
  "辰": ["乙", "癸", "戊"], "巳": ["戊", "庚", "丙"], "午": ["丙", "己", "丁"], "未": ["丁", "乙", "己"],
  "申": ["戊", "壬", "庚"], "酉": ["庚", "辛"], "戌": ["辛", "丁", "戊"], "亥": ["戊", "甲", "壬"]
};

// ---------------------------------------------------------------------------
// 2. Helper Functions
// ---------------------------------------------------------------------------

function getKoreanChar(hanja: string): string {
  const ganIdx = GAN.indexOf(hanja);
  if (ganIdx !== -1) return GAN_KOR[ganIdx];
  const zhiIdx = ZHI.indexOf(hanja);
  if (zhiIdx !== -1) return ZHI_KOR[zhiIdx];
  return "";
}

function getTenGod(dayStem: string, target: string): string {
  if (dayStem === target) return "비견";
  const dayIdx = GAN.indexOf(dayStem);
  let targetStem = target;
  if (ZHI.includes(target)) {
    targetStem = BRANCH_MAIN_QI[target];
  }
  const targetIdx = GAN.indexOf(targetStem);
  if (dayIdx === -1 || targetIdx === -1) return "";
  return TEN_GODS_MAP[dayIdx][targetIdx];
}

function getGanjiKorean(ganji: string): string {
  const stem = ganji.charAt(0);
  const branch = ganji.charAt(1);
  return getKoreanChar(stem) + getKoreanChar(branch);
}

// Safely access env vars in browser
function getApiKey(userKey?: string): string | undefined {
  if (userKey && userKey.trim().length > 0) return userKey;
  try {
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
      // @ts-ignore
      return process.env.API_KEY;
    }
  } catch (e) {
    // Ignore error if process is undefined
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// 3. Main Analysis Logic
// ---------------------------------------------------------------------------

export const analyzeSaju = async (input: UserInput): Promise<SajuAnalysisResult> => {
  const apiKey = getApiKey(input.apiKey);
  if (!apiKey) {
    throw new Error("API Key가 없습니다. 입력창에 키를 입력하고 저장해주세요.");
  }
  const ai = new GoogleGenAI({ apiKey: apiKey });

  // 1. Calculate Pillars LOCALLY
  const [year, month, day] = input.birthDate.split('-').map(Number);
  const [hour, minute] = input.birthTime.split(':').map(Number);

  const solar = Solar.fromYmdHms(year, month, day, hour, minute, 0);
  const lunar = solar.getLunar();
  const baZi = lunar.getEightChar();

  // Header Info
  const koreanAge = new Date().getFullYear() - year + 1;
  const solarDateStr = `${year}년 ${month < 10 ? '0'+month : month}월 ${day < 10 ? '0'+day : day}일`;
  const lunarDateStr = `${lunar.getYear()}년 ${lunar.getMonth() < 10 ? '0'+lunar.getMonth() : lunar.getMonth()}월 ${lunar.getDay() < 10 ? '0'+lunar.getDay() : lunar.getDay()}일`;
  
  // Find closest JieQi (Solar Term)
  const jieQi = lunar.getPrevJieQi(true); // Current or Prev
  const jieQiName = jieQi.getName();
  const jieQiDate = jieQi.getSolar();
  const solarTermStr = `${jieQiName} ${jieQiDate.getYear()}년 ${jieQiDate.getMonth()}월 ${jieQiDate.getDay()}일`;

  const yearStem = baZi.getYearGan();
  const yearBranch = baZi.getYearZhi();
  const monthStem = baZi.getMonthGan();
  const monthBranch = baZi.getMonthZhi();
  const dayStem = baZi.getDayGan();
  const dayBranch = baZi.getDayZhi();
  const hourStem = baZi.getTimeGan();
  const hourBranch = baZi.getTimeZhi();

  const allChars = [yearStem, yearBranch, monthStem, monthBranch, dayStem, dayBranch, hourStem, hourBranch];
  const counts = { Wood: 0, Fire: 0, Earth: 0, Metal: 0, Water: 0 };
  allChars.forEach(char => {
    const el = ELEMENT_MAP[char];
    if (el) counts[el]++;
  });

  const createPillar = (stem: string, branch: string): Pillar => ({
    stem,
    stemKorean: getKoreanChar(stem),
    stemTenGod: stem === dayStem ? "일원" : getTenGod(dayStem, stem),
    branch,
    branchKorean: getKoreanChar(branch),
    branchTenGod: getTenGod(dayStem, branch),
    element: ELEMENT_MAP[stem] || "Earth",
    color: COLOR_MAP[ELEMENT_MAP[stem]],
    jiJangGan: JIJANGGAN[branch] || []
  });

  const yearPillar = createPillar(yearStem, yearBranch);
  const monthPillar = createPillar(monthStem, monthBranch);
  const dayPillar = createPillar(dayStem, dayBranch);
  const hourPillar = createPillar(hourStem, hourBranch);

  // 4. Calculate Daewun (10-year cycles) - EXTENDED to 121 years logic
  const yun = baZi.getYun(input.gender === 'male' ? 1 : 0);
  const daewunList: CycleItem[] = [];
  const daewunObjs = yun.getDaYun();
  
  // Calculate Daewun
  // Safety: Daewun usually doesn't fail, but we'll safeguard loop.
  for (let i = 0; i < daewunObjs.length && i < 15; i++) {
    try {
      const dy = daewunObjs[i];
      const dyStartAge = dy.getStartAge();
      // If Daewun goes beyond reasonable age, stop? 
      // 121 is the requested limit.
      
      const label = i === 0 && dyStartAge === 0 ? `0.6 ~ ${dyStartAge + 9}` : `${dyStartAge} ~ ${dyStartAge + 9}`;
      const ganZhi = dy.getGanZhi();
      
      daewunList.push({
        age: label,
        ganji: ganZhi,
        ganjiKorean: getGanjiKorean(ganZhi),
        tenGod: getTenGod(dayStem, ganZhi.charAt(0))
      });
      
      if (dyStartAge > 121) break; 
    } catch (e) {
      console.warn("Daewun error", e);
      break;
    }
  }

  // 5. Calculate Saewun (Yearly Luck) - Extended to 121 years
  const saewunList: CycleItem[] = [];
  for (let i = 0; i <= 121; i++) {
    const currentYear = year + i;
    // library safety limit: usually 2100 is safe. 
    // If the year exceeds 2100, lunar-javascript might fail or return incorrect data depending on version.
    // We will try; if fail, break.
    if (currentYear > 2100) break;

    try {
      // Use middle of the year to ensure we get that year's GanZhi safely
      const l = Lunar.fromYmd(currentYear, 6, 1);
      const ganZhi = l.getYearInGanZhi();
      saewunList.push({
        age: `${i + 1}`, // Age
        ganji: ganZhi,
        ganjiKorean: getGanjiKorean(ganZhi),
        tenGod: getTenGod(dayStem, ganZhi.charAt(0))
      });
    } catch (e) {
      console.warn(`Saewun calculation stopped at year ${currentYear}:`, e);
      break;
    }
  }

  // 6. Calculate Wolwun (Monthly Luck) - 2025~2027 (Strict Solar Term Standard)
  const wolwunList: CycleItem[] = [];
  
  // Loop through Gregorian months from 2025-01 to 2027-12
  for (let y = 2025; y <= 2027; y++) {
    for (let m = 1; m <= 12; m++) {
      try {
        // Use 15th of month to determine the Solar Term Month Pillar dominance
        const s = Solar.fromYmd(y, m, 15);
        const l = s.getLunar();
        const bz = l.getEightChar();
        const monthGan = bz.getMonthGan();
        const monthZhi = bz.getMonthZhi();
        const mGanZhi = monthGan + monthZhi;

        wolwunList.push({
          age: `${y}.${m}`,
          ganji: mGanZhi,
          ganjiKorean: getGanjiKorean(mGanZhi),
          tenGod: getTenGod(dayStem, monthGan)
        });
      } catch (e) {
        console.warn(`Wolwun error at ${y}.${m}`, e);
        // Continue if one month fails? Better to show gap than crash.
      }
    }
  }

  // 7. Generate Content via AI
  const promptContext = `
    [사주 원국]
    년주: ${yearStem}${yearBranch}
    월주: ${monthStem}${monthBranch}
    일주: ${dayStem}${dayBranch}
    시주: ${hourStem}${hourBranch}
    오행: 목(${counts.Wood}), 화(${counts.Fire}), 토(${counts.Earth}), 금(${counts.Metal}), 수(${counts.Water})
  `;

  const model = "gemini-2.5-flash";
  const prompt = `
    당신은 40년 경력의 '천기 도사'이자 '현대 의학 박사'이며 '풍수지리 학자'입니다.
    
    ${promptContext}
    사용자: ${input.name}, ${input.gender === 'male' ? '남성' : '여성'}

    [지시사항]
    1. **타고난 기질**: 일간(${dayStem})을 중심으로 성격과 운명을 분석하세요.
    2. **개운 비책**: 부족한 오행을 채우는 비법을 제시하세요.
    3. **건강 처방**: 전문의학박사로서 취약 장기, 예상 질병, 식이요법, 운동 처방을 상세히 작성하세요.
    4. **2026년(병오년) 총운**: 2026년의 재물, 직업, 건강, 애정운을 상세히 예측하세요.
    5. **풍수 및 귀인**: 논문 수준으로 깊이 있게 길일과 방위를 분석하세요.
    
    [JSON 포맷 준수]
    - luckyTable date format: "3월 15일 (갑자일)"
  `;

  const SAJU_SCHEMA: Schema = {
    type: Type.OBJECT,
    properties: {
      dayMasterReading: { type: Type.STRING },
      missingElements: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            element: { type: Type.STRING },
            priority: { type: Type.NUMBER },
          }
        }
      },
      chaeumAdvice: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          color: { type: Type.STRING },
          direction: { type: Type.STRING },
          items: { type: Type.STRING },
        },
        required: ["summary", "color", "direction", "items"]
      },
      healthAnalysis: {
        type: Type.OBJECT,
        properties: {
          weakOrgans: { type: Type.STRING },
          symptoms: { type: Type.STRING },
          medicalAdvice: { type: Type.STRING },
          foodRecommendation: { type: Type.STRING },
        },
        required: ["weakOrgans", "symptoms", "medicalAdvice", "foodRecommendation"]
      },
      fortune2026: {
        type: Type.OBJECT,
        properties: {
          overall: { type: Type.STRING },
          wealth: { type: Type.STRING },
          career: { type: Type.STRING },
          health: { type: Type.STRING },
          love: { type: Type.STRING },
        },
        required: ["overall", "wealth", "career", "health", "love"],
      },
      luckyTable: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            date: { type: Type.STRING },
            time: { type: Type.STRING },
            direction: { type: Type.STRING },
          }
        }
      },
      fengShuiThesis: { type: Type.STRING }
    },
    required: ["dayMasterReading", "missingElements", "chaeumAdvice", "healthAnalysis", "fortune2026", "luckyTable", "fengShuiThesis"]
  };

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: SAJU_SCHEMA,
        temperature: 0.3,
      },
    });

    if (!response.text) throw new Error("No response from AI");
    const aiResult = JSON.parse(response.text);

    return {
      koreanAge,
      solarDateStr,
      lunarDateStr,
      solarTermStr,
      yearPillar,
      monthPillar,
      dayPillar,
      hourPillar,
      elementCounts: counts,
      daewun: daewunList,
      saewun: saewunList,
      wolwun: wolwunList,
      missingElements: aiResult.missingElements,
      dayMasterReading: aiResult.dayMasterReading,
      chaeumAdvice: aiResult.chaeumAdvice,
      healthAnalysis: aiResult.healthAnalysis,
      fortune2026: aiResult.fortune2026,
      luckyTable: aiResult.luckyTable,
      fengShuiThesis: aiResult.fengShuiThesis
    };
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export const consultSaju = async (
  question: string,
  sajuContext: SajuAnalysisResult,
  chatHistory: { role: string; parts: { text: string }[] }[],
  apiKey?: string
): Promise<string> => {
  const key = getApiKey(apiKey);
  if (!key) return "API Key가 설정되지 않아 답변할 수 없습니다.";

  const model = "gemini-2.5-flash";
  const ai = new GoogleGenAI({ apiKey: key });
  
  const systemContext = `
    역할: 천기 도사. 논문 수준의 깊이와 논리로 답변.
    사주: 일간 ${sajuContext.dayPillar.stem}, 용신 ${sajuContext.missingElements.map(m => m.element).join(', ')}.
    답변: 최소 1000자 이상.
  `;
  
  const adjustedHistory = [...chatHistory];
  if (adjustedHistory.length > 0 && adjustedHistory[0].role === 'model') {
    adjustedHistory.unshift({ role: 'user', parts: [{ text: '도사님, 제 사주 결과를 알려주십시오.' }] });
  }

  try {
    const chat = ai.chats.create({
      model,
      config: { systemInstruction: systemContext },
      history: adjustedHistory,
    });
    const result = await chat.sendMessage({ message: question });
    return result.text || "점괘가 흐릿하구려.";
  } catch (error) {
    console.error(error);
    return "천기를 읽는 데 방해가 생겼네. 잠시 후 다시 시도하게나.";
  }
};