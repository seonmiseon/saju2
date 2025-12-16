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

// Generate detailed default interpretations based on day stem and missing elements
function getDefaultInterpretation(dayStem: string, counts: Record<string, number>, name: string, gender: string) {
  const dayMasterDescriptions: Record<string, string> = {
    "甲": `${name}님의 일간은 갑목(甲木)으로, 큰 나무와 같은 기상을 타고났습니다.\n\n갑목일간은 곧고 정직하며 강한 리더십을 지닌 사람입니다. 마치 하늘을 향해 곧게 뻗어 올라가는 소나무처럼, 원칙을 중시하고 정의로운 성품을 가지고 있습니다. 성장과 발전을 끊임없이 추구하며, 새로운 시작과 도전을 두려워하지 않습니다.\n\n다만, 때로는 융통성이 부족하고 고집이 센 면이 있어 주변과 마찰이 생길 수 있습니다. 자신의 원칙을 지키되, 상황에 따라 유연하게 대처하는 지혜가 필요합니다. 의리가 있고 한번 맺은 인연을 소중히 여기는 성품으로, 깊은 신뢰 관계를 형성할 수 있습니다.`,
    "乙": `${name}님의 일간은 을목(乙木)으로, 풀과 넝쿨처럼 유연하고 적응력이 뛰어난 기질을 타고났습니다.\n\n을목일간은 부드럽고 온화한 성품으로, 주변 환경에 잘 적응하며 조화를 이루는 능력이 탁월합니다. 예술적 감각이 뛰어나고, 섬세한 감수성을 지니고 있어 창의적인 분야에서 두각을 나타낼 수 있습니다.\n\n협조적이고 외교적인 능력이 있어 대인관계에서 원만함을 유지합니다. 다만, 지나친 유연함이 우유부단함으로 비춰질 수 있으니, 중요한 결정에는 단호함을 보이는 것이 좋습니다.`,
    "丙": `${name}님의 일간은 병화(丙火)로, 태양처럼 밝고 열정적인 기질을 타고났습니다.\n\n병화일간은 활발하고 적극적이며 사교성이 뛰어난 사람입니다. 태양이 만물을 비추듯, 주변 사람들에게 에너지와 활력을 전파하는 능력이 있습니다. 낙천적이고 명랑한 성격으로, 어디서든 분위기 메이커 역할을 합니다.\n\n다만, 때로는 성급하고 급한 성격이 단점이 될 수 있습니다. 열정이 과하면 주변을 지치게 할 수 있으니, 적절한 조절이 필요합니다. 정의감이 강하고 불의를 참지 못하는 성품입니다.`,
    "丁": `${name}님의 일간은 정화(丁火)로, 촛불처럼 은은하고 따뜻한 기질을 타고났습니다.\n\n정화일간은 섬세하고 예민하며 깊은 통찰력을 지닌 사람입니다. 촛불이 어둠을 밝히듯, 내면의 지혜로 주변을 이끄는 능력이 있습니다. 겉으로는 차분해 보이지만, 내면에는 강한 열정을 품고 있습니다.\n\n정신적 깊이가 있어 철학, 예술, 학문 분야에서 재능을 발휘할 수 있습니다. 다만, 예민함이 지나치면 상처받기 쉬우니, 마음을 단단히 하는 연습이 필요합니다.`,
    "戊": `${name}님의 일간은 무토(戊土)로, 산과 같이 듬직하고 안정적인 기질을 타고났습니다.\n\n무토일간은 신뢰감을 주며 포용력이 큰 사람입니다. 높은 산이 만물을 품듯이, 주변 사람들에게 든든한 버팀목이 되어줍니다. 중재 능력이 뛰어나고 책임감이 강합니다.\n\n성실하고 묵묵히 자신의 길을 가는 성품으로, 장기적인 성과를 이룰 수 있습니다. 다만, 변화에 둔감하고 고정관념에 빠지기 쉬우니, 새로운 것을 받아들이는 유연함이 필요합니다.`,
    "己": `${name}님의 일간은 기토(己土)로, 논밭처럼 비옥하고 생산적인 기질을 타고났습니다.\n\n기토일간은 꼼꼼하고 실용적이며 현실적인 사람입니다. 대지가 만물을 기르듯, 주변 사람들을 돌보고 지원하는 능력이 있습니다. 인내심이 강하고 성실하여 맡은 일을 끝까지 완수합니다.\n\n실질적인 결과를 중시하고 안정을 추구합니다. 다만, 지나친 현실주의가 꿈과 이상을 제한할 수 있으니, 때로는 큰 그림을 그리는 것도 필요합니다.`,
    "庚": `${name}님의 일간은 경금(庚金)으로, 강철처럼 강인하고 결단력 있는 기질을 타고났습니다.\n\n경금일간은 정의감이 강하고 원칙을 중시하는 사람입니다. 쇠가 담금질을 통해 단단해지듯, 시련을 통해 더욱 강해지는 성품입니다. 추진력과 실행력이 뛰어나 맡은 일을 확실하게 처리합니다.\n\n단호하고 명확한 판단력이 장점이지만, 때로는 융통성이 부족해 보일 수 있습니다. 날카로운 기운을 부드럽게 다스리는 지혜가 필요합니다.`,
    "辛": `${name}님의 일간은 신금(辛金)으로, 보석처럼 섬세하고 정교한 기질을 타고났습니다.\n\n신금일간은 미적 감각이 뛰어나고 완벽을 추구하는 사람입니다. 보석이 갈고 닦아야 빛을 발하듯, 끊임없는 자기 계발을 통해 빛나는 성품입니다. 예민하고 감수성이 풍부하여 예술적 재능이 있습니다.\n\n세련되고 품위 있는 이미지를 가지고 있으나, 예민함이 지나치면 상처받기 쉽습니다. 내면의 강인함을 기르는 것이 중요합니다.`,
    "壬": `${name}님의 일간은 임수(壬水)로, 바다처럼 넓고 깊은 기질을 타고났습니다.\n\n임수일간은 지혜롭고 창의적이며 포용력이 큰 사람입니다. 바다가 모든 물을 받아들이듯, 다양한 사람과 상황을 수용하는 능력이 있습니다. 자유로운 영혼으로 모험과 새로운 경험을 즐깁니다.\n\n통찰력이 뛰어나고 직관이 강합니다. 다만, 때로는 방향성 없이 흘러가는 경향이 있으니, 목표를 정하고 집중하는 것이 필요합니다.`,
    "癸": `${name}님의 일간은 계수(癸水)로, 비와 이슬처럼 부드럽고 침투력 있는 기질을 타고났습니다.\n\n계수일간은 직관력이 뛰어나고 영적 감각이 있는 사람입니다. 이슬이 만물을 적시듯, 섬세하게 주변을 살피고 배려합니다. 적응력이 좋고 인내심이 강하여 어려운 상황도 묵묵히 견뎌냅니다.\n\n깊은 사색과 명상을 통해 내면의 지혜를 발견할 수 있습니다. 다만, 감정에 휩쓸리기 쉬우니, 감정 조절 능력을 기르는 것이 중요합니다.`
  };

  // Find missing elements
  const elements = ['Wood', 'Fire', 'Earth', 'Metal', 'Water'];
  const koreanElements: Record<string, string> = { 'Wood': '목(木)', 'Fire': '화(火)', 'Earth': '토(土)', 'Metal': '금(金)', 'Water': '수(水)' };
  const elementNames: Record<string, string> = { 'Wood': '목', 'Fire': '화', 'Earth': '토', 'Metal': '금', 'Water': '수' };
  
  const missingElements = elements
    .filter(el => counts[el] === 0 || counts[el] === 1)
    .sort((a, b) => counts[a] - counts[b])
    .slice(0, 2)
    .map((el, idx) => ({ element: koreanElements[el], priority: idx + 1, key: el }));

  if (missingElements.length === 0) {
    missingElements.push({ element: '균형 잡힘', priority: 1, key: 'Earth' });
  }

  const missing1 = missingElements[0]?.key || 'Water';
  const missing2 = missingElements[1]?.key || 'Fire';

  // 상세한 채움 조언
  const chaeumDetails: Record<string, { color: string, direction: string, items: string, colorAdvice: string, directionAdvice: string, itemAdvice: string }> = {
    'Water': {
      color: "검은색, 파란색, 남색",
      direction: "북쪽",
      items: "수정, 유리 제품, 물 관련 소품",
      colorAdvice: "부족한 '수' 기운을 보충하기 위해서 검은색, 진은 파란색 계열의 옷이나 액세서리를 자주 착용하십시오. 이 색상들은 물의 기운을 상징하며, 안정감과 깊이를 더해줄 것입니다. 또한 약한 '화' 기운을 보충하기 위해 붉은색, 주황색, 보라색 등 따뜻하고 활기찬 색상을 활용하는 것도 좋습니다. 두 가지 색상을 적절히 조화시켜 사용하는 것이 가장 이상적입니다.",
      directionAdvice: "생활 공간이나 중요한 활동을 할 때 방향을 고려하는 것이 좋습니다. '수' 기운을 보충하기 위해서는 북쪽 방향으로 머리를 두고 잠을 자거나, 북쪽을 향해 중요한 업무를 처리하는 시간을 늘려보시고, 남쪽에 활동 범위를 늘려볼 것을 권장합니다.",
      itemAdvice: "'물'과 '불'의 기운을 보충하기 위한 구체적인 방법들을 실천하십시오. '수' 기운을 위해서는 깨끗한 물을 자주 마시는 습관을 들이고, 수영이나 반신욕, 족욕 등 물과 관련된 활동을 즐기십시오. 집안에 작은 분수대나 어항을 배치하거나, 가습기를 사용해 습도를 유지하는 것도 좋습니다. '불' 기운을 위해서는 햇볕을 자주 쬐고, 따뜻한 차나 음식을 섭취하며 열을 심하게 참지 마세요. 초불을 켜거나 난로를 쐬는 것도 좋습니다."
    },
    'Fire': {
      color: "빨간색, 주황색, 보라색",
      direction: "남쪽",
      items: "초, 조명, 붉은 보석",
      colorAdvice: "부족한 '화' 기운을 보충하기 위해서 빨간색, 주황색, 보라색 계열의 옷이나 액세서리를 자주 착용하십시오. 이 색상들은 열정과 활력을 상징하며, 에너지를 높여줄 것입니다.",
      directionAdvice: "생활 공간에서 남쪽 방향으로 활동하는 시간을 늘려보시오. 남쪽은 열정과 명예를 상징하며, 활력을 불어넣어 줄 것입니다. 여행이나 중요한 약속을 잡을 때도 남쪽을 고려해 보시오.",
      itemAdvice: "'화' 기운을 보충하기 위해서는 남쪽 방향으로 활동하는 시간을 늘려보시고, 밝은 공간에서 햇볕을 쬐는 것이 좋습니다. 초불을 켜거나 따뜻한 음식을 즐기세요."
    },
    'Wood': {
      color: "초록색, 청색, 연두색",
      direction: "동쪽",
      items: "나무 소품, 식물, 꽃",
      colorAdvice: "부족한 '목' 기운을 보충하기 위해서 초록색, 청색 계열의 옷이나 액세서리를 자주 착용하십시오. 이 색상들은 성장과 발전을 상징합니다.",
      directionAdvice: "생활 공간에서 동쪽 방향을 활용하세요. 동쪽은 새로운 시작과 성장을 의미합니다. 아침에 동쪽에서 떠오르는 해를 바라보는 것도 좋습니다.",
      itemAdvice: "실내에 식물을 키우거나 나무 가구를 배치하세요. 산책이나 등산 등 자연과 함께하는 활동이 도움이 됩니다."
    },
    'Metal': {
      color: "흰색, 금색, 은색",
      direction: "서쪽",
      items: "금속 액세서리, 동전, 종",
      colorAdvice: "부족한 '금' 기운을 보충하기 위해서 흰색, 금색, 은색 계열의 옷이나 액세서리를 착용하십시오. 이 색상들은 결단력과 정의를 상징합니다.",
      directionAdvice: "생활 공간에서 서쪽 방향을 활용하세요. 서쪽은 수확과 결실을 의미합니다.",
      itemAdvice: "금속 재질의 액세서리나 소품을 가까이 하세요. 음악을 듣거나 악기를 연주하는 것도 금의 기운을 높여줍니다."
    },
    'Earth': {
      color: "노란색, 갈색, 베이지색",
      direction: "중앙",
      items: "도자기, 크리스탈, 황토 제품",
      colorAdvice: "부족한 '토' 기운을 보충하기 위해서 노란색, 갈색, 베이지색 계열의 옷이나 소품을 활용하십시오.",
      directionAdvice: "안정적인 공간에서 시간을 보내세요. 집의 중앙 공간을 정돈하고 활용하는 것이 좋습니다.",
      itemAdvice: "도자기나 황토 제품을 가까이 하세요. 맨발로 땅을 밟는 어싱(Earthing)도 좋습니다."
    }
  };

  const detail1 = chaeumDetails[missing1];
  const detail2 = chaeumDetails[missing2] || detail1;

  // 상세한 건강 분석
  const healthByElement: Record<string, { weakOrgans: string, symptoms: string, medicalAdvice: string, foodRecommendation: string }> = {
    'Water': {
      weakOrgans: `${name}님의 사주 원국에는 '수(水)' 기운이 전무하거나 매우 약하게 나타납니다. 명리학적으로 '수'는 신장, 방광, 생식기, 뼈, 귀 등과 관련이 깊습니다. 따라서 사주상 가장 취약한 장기는 신장과 방광을 포함한 비뇨생식기 계통이며, 다음으로 심장과 혈액순환 계통에도 각별한 주의가 필요합니다.`,
      symptoms: "신장 및 방광 기능 약화로 인해 만성적인 피로감, 허리 통증(특히 하부), 다리나 발의 부종, 소변 관련 문제(잦은 소변, 야간뇨, 잔뇨감, 소변량 감소 등), 생식기 기능 저하, 면역력 약화로 인한 잦은 감기나 질병 등이 나타날 수 있습니다. 또한 뼈 건강에도 취약하여 골밀도 저하나 관절 문제가 발생할 가능성도 있습니다.",
      medicalAdvice: `${name}님의 건강 관리는 '수'와 '화' 기운의 균형을 맞추는 데 중점을 두어야 합니다.\n\n첫째, **수분 섭취**는 생명과 직결됩니다. 하루 최소 2.5~3리터 이상의 깨끗한 물을 꾸준히 섭취하는 것이 필수적입니다. 한 번에 많은 양을 마시기보다, 30분~1시간 간격으로 소량씩 자주 마시는 습관을 들이십시오.\n\n둘째, **식단 관리**는 신장과 심장 건강에 매우 중요합니다. 신장 건강을 위해 저염식 식단을 유지하고, 가공식품 및 인스턴트식품 섭취를 최소화해야 합니다.\n\n셋째, **운동 처방**입니다. 주 3회 이상, 30분 이상의 유산소 운동(걷기, 조깅, 수영, 자전거 타기)을 꾸준히 실천하고 혈액순환을 촉진하고 심폐 기능을 강화해야 합니다.\n\n넷째, **생활 습관** 개선입니다. 충분한 수면(하루 7~8시간)을 취하고, 스트레스 관리에 힘쓰십시오.`,
      foodRecommendation: "신장 및 방광 건강에 좋은 음식으로는 검은콩, 검은깨, 미역, 다시마, 김과 같은 해조류, 블루베리, 수박, 오이, 팥, 옥수수 수염차 등이 있습니다. 이들은 이뇨 작용을 돕고 신장 기능을 강화하는 데 도움을 줍니다. 심장 및 혈액순환 건강에 좋은 음식으로는 토마토, 양파, 마늘, 등푸른생선(고등어, 연어), 견과류(아몬드, 호두), 베리류(딸기, 라즈베리), 녹차 등이 있습니다."
    },
    'Fire': {
      weakOrgans: `${name}님의 사주 원국에는 '화(火)' 기운이 부족합니다. 명리학적으로 '화'는 심장, 소장, 혈액순환, 눈, 혀 등과 관련이 깊습니다.`,
      symptoms: "심장 및 혈액순환 계통의 약화로 인해 손발이 차거나 저림, 가슴 답답함, 어지럼증, 두통, 혈압 불안정 등의 증상이 나타날 수 있습니다.",
      medicalAdvice: `${name}님은 심장과 혈액순환 기능 강화에 중점을 두어야 합니다. 규칙적인 유산소 운동과 스트레칭으로 혈류를 개선하고, 따뜻한 음식과 차를 즐기세요. 추운 환경을 피하고 몸을 따뜻하게 유지하는 것이 중요합니다.`,
      foodRecommendation: "심장 건강에 좋은 음식으로는 빨간색 채소와 과일(토마토, 고추, 사과), 마늘, 양파, 견과류, 등푸른생선 등이 있습니다. 따뜻한 차(생강차, 대추차)도 좋습니다."
    },
    'Wood': {
      weakOrgans: `${name}님의 사주 원국에는 '목(木)' 기운이 부족합니다. 명리학적으로 '목'은 간, 담낭, 눈, 근육, 힘줄 등과 관련이 깊습니다.`,
      symptoms: "간 기능 약화로 인해 피로감, 눈의 피로, 시력 저하, 근육 경련, 손톱이 잘 부러지는 증상 등이 나타날 수 있습니다.",
      medicalAdvice: `${name}님은 간 건강 관리에 중점을 두어야 합니다. 과음을 피하고, 신선한 채소와 과일을 충분히 섭취하세요. 스트레스 관리도 간 건강에 중요합니다. 규칙적인 수면과 적당한 운동을 유지하세요.`,
      foodRecommendation: "간 건강에 좋은 음식으로는 녹색 채소(시금치, 브로콜리, 케일), 레몬, 자몽, 녹차, 강황 등이 있습니다."
    },
    'Metal': {
      weakOrgans: `${name}님의 사주 원국에는 '금(金)' 기운이 부족합니다. 명리학적으로 '금'은 폐, 대장, 피부, 코 등과 관련이 깊습니다.`,
      symptoms: "폐와 호흡기 계통의 약화로 인해 잦은 감기, 기침, 피부 문제, 알레르기, 변비 등의 증상이 나타날 수 있습니다.",
      medicalAdvice: `${name}님은 폐와 호흡기 건강 관리에 중점을 두어야 합니다. 깊은 호흡 연습과 유산소 운동을 통해 폐활량을 키우세요. 공기가 좋은 곳에서 산책하는 것도 좋습니다.`,
      foodRecommendation: "폐 건강에 좋은 음식으로는 도라지, 배, 무, 연근, 마늘, 양파, 흰색 채소 등이 있습니다."
    },
    'Earth': {
      weakOrgans: `${name}님의 사주 원국에는 '토(土)' 기운이 부족합니다. 명리학적으로 '토'는 위, 비장, 입술, 근육 등과 관련이 깊습니다.`,
      symptoms: "소화기 계통의 약화로 인해 소화불량, 복부 팽만감, 식욕 저하 또는 과식, 근력 약화 등의 증상이 나타날 수 있습니다.",
      medicalAdvice: `${name}님은 소화기 건강 관리에 중점을 두어야 합니다. 규칙적인 식사와 천천히 씹어 먹는 습관을 기르세요. 과식을 피하고 소화가 잘 되는 음식을 선택하세요.`,
      foodRecommendation: "소화기 건강에 좋은 음식으로는 노란 호박, 고구마, 감자, 현미, 잡곡, 꿀 등이 있습니다."
    }
  };

  const health = healthByElement[missing1];

  // 2026년 운세
  const fortune2026 = {
    overall: `2025년이 ${name}님께서 새로운 시작을 위한 기반을 다지고 내실을 기하는 시기였다면, 2026년 병오년(丙午年)은 그동안의 노력이 결실을 맺고 강력한 변화와 도약을 맞이하는 한 해가 될 것입니다.\n\n천간의 병화(丙火)와 지지의 오화(午火)가 동시에 들어와 귀인과 명예, 사회적 책임감이 크게 부각되는 시기입니다. 특히 일간 혹은 궁합과 병화가 이루어 강한 합작용이 발생하는데, 이는 안정적인 명예와 사회적 인정을 의미하며, 주변으로부터 신뢰와 지지를 얻게 될 것입니다.\n\n하지만 지지에 오화가 충돌이 되어가며 강한 관심을 끌게 되므로 명예를 얻거나 오히려 다소한 경쟁을 겪을 수 있습니다. 이는 ${name}님에게도 도전과 성장의 기회가 될 것이며, 자신의 역량을 최대한 발휘하여 위기를 기회로 삼는 지혜가 필요합니다.`,
    wealth: `2026년은 재물운에 있어도 변화의 바람이 불어올 것입니다. 병오년의 강한 관살(官殺) 기운은 재물을 지키고 불리는 데 있어 책임감과 규율을 요구합니다.\n\n${name}님은 편재(偏財)가 강한 사주이므로, 재물에 대한 감각이 뛰어나지만, 관살이 들어오면서 재물을 관리하는 능력이 더욱 요구됩니다. 특히 강한 화(火) 기운은 재물을 빨리 소모시킬 수 있으므로, 불필요한 지출을 줄이고 저축과 투자 균형을 맞추는 것이 중요합니다.\n\n새로운 재물 창출의 기회가 생길 수 있으나, 그 과정에서 법적 문제나 계약에 대한 신중한 검토가 필요합니다. 전문가의 조언을 구하거나, 신뢰할 수 있는 사람과 함께 재물을 운용하는 것도 좋은 방법입니다.`,
    career: `직업운은 2026년의 가장 두드러진 특징 중 하나입니다. 병화의 관성은 명예와 직위, 사회적 인정을 의미하며, 오화 역시 도전적인 업무를 상징합니다.\n\n병오년으로 인해 직장에서의 위치가 확고해지거나, 중요한 프로젝트를 맡아 리더십을 발휘할 기회가 있을 수 있습니다. 승진, 이직, 사업 확장 등 경력 변화가 예상되며, 그만큼 어깨에 무거워지는 책임감이 가중될 것입니다.\n\n특히 강한 관성의 기운은 경쟁 시 험난 환경이 놓여져서, 상사나 조직으로부터 강한 압박을 받을 수 있지만, 하지만 이를 잘 활용하면 오히려 명성과 신뢰를 높일 수 있습니다.`,
    health: `건강운은 2026년 병오년에 특히 주의를 기울여야 할 부분입니다. 사주 원국에 부족한 물(水) 기운과 약한 불(火) 기운에 더해, 2026년에는 강한 불(火)의 기운이 중첩됩니다.\n\n이는 심혈관계, 신경과 스트레스와 업무량으로 인해 피로가 누적되기 쉬우며, 이는 면역력 저하로 이어질 수 있습니다. 특히 심장과 혈액순환 계통에 주의가 필요합니다.\n\n명상, 요가, 꾸준한 유산소 운동 등 정기적인 건강 검진을 통해 몸의 변화를 민감하게 감지하고 대처하는 것이 중요합니다. 특히 여름철에는 강한 불 기운으로 인해 체력 소모가 심할 수 있으니, 충분한 휴식과 수분 섭취에 더욱 신경 써야 합니다.`,
    love: `연애운은 2026년에 다소 복잡하고 심오한 양상을 띌 수 있습니다. 병화의 정관은 ${gender === 'male' ? '남성에게' : '여성에게'} 자녀나 명예를 의미하기도 하지만, 사회적 활동과 책임감이 커지는 시기이므로, 연애나 결혼에 대한 고민이 깊어질 수 있습니다.\n\n기존 연인과의 관계에서는 서로의 역할과 책임에 대한 논의가 중요해질 수 있으며, 때로는 진전을 위한 중요한 결정을 내릴 수도 있습니다. 새로운 인연을 찾는 분이라면, 이 시기에 구체적인 계획을 세우고 신중히 알아보길 권합니다.\n\n하지만 강한 관살의 기운은 때때로 관계에서의 긴장감을 유발할 수 있으므로, 상대방과의 소통과 이해를 바탕으로 관계를 발전시켜 나가는 것이 좋겠습니다.`
  };

  return {
    dayMasterReading: dayMasterDescriptions[dayStem] || "일간의 기운을 분석 중입니다.",
    missingElements: missingElements.map(m => ({ element: m.element, priority: m.priority })),
    chaeumAdvice: {
      summary: `${name}님의 사주 원국에는 '${elementNames[missing1]}(${missing1 === 'Water' ? '水' : missing1 === 'Fire' ? '火' : missing1 === 'Wood' ? '木' : missing1 === 'Metal' ? '金' : '土'})' 기운이 전무하고 '${elementNames[missing2]}(${missing2 === 'Water' ? '水' : missing2 === 'Fire' ? '火' : missing2 === 'Wood' ? '木' : missing2 === 'Metal' ? '金' : '土'})' 기운이 매우 약합니다. 이는 신체적, 정신적 균형을 맞추고 재물과 명예를 더욱 견고히 하는 데 있어 물과 불의 기운을 보충하는 것이 매우 중요함을 의미합니다.\n\n물은 지혜, 유연성, 생명력, 재물을 상징하며, 불은 열정, 활력, 명예, 사회성을 상징합니다. 이 두 기운을 조화롭게 채워 넣음으로써 삶의 전반적인 안정과 발전을 도모할 수 있습니다.`,
      color: detail1.color,
      direction: detail1.direction,
      items: detail1.items,
      colorAdvice: detail1.colorAdvice,
      directionAdvice: detail1.directionAdvice,
      itemAdvice: detail1.itemAdvice
    },
    healthAnalysis: health,
    fortune2026,
    luckyTable: [
      { date: "1월 15일 (갑자일)", time: "오전 9시-11시", direction: "동쪽" },
      { date: "3월 21일 (경인일)", time: "오전 7시-9시", direction: "남쪽" },
      { date: "6월 10일 (임오일)", time: "오후 1시-3시", direction: "서쪽" },
      { date: "9월 8일 (을유일)", time: "오후 3시-5시", direction: "북쪽" },
      { date: "12월 21일 (병술일)", time: "오전 5시-7시", direction: "동쪽" }
    ],
    fengShuiThesis: `${name}님의 사주에서 물과 불의 기운이 부족하므로, 거주 공간에서 이 기운을 보충하는 것이 중요합니다.\n\n북쪽에는 작은 분수나 어항을 배치하고, 남쪽에는 밝은 조명이나 붉은 색상의 소품을 두세요. 침실은 북쪽이나 동쪽에 배치하면 안정적인 수면에 도움이 됩니다. 거실의 중앙에는 노란색이나 베이지색 러그를 깔아 토의 기운으로 균형을 잡아주세요.\n\n또한 환기를 자주 하고 식물을 키우면 기의 흐름이 원활해집니다. 어수선한 공간은 기의 흐름을 막으므로, 정리정돈을 습관화하세요.`
  };
}

export const analyzeSaju = async (input: UserInput): Promise<SajuAnalysisResult> => {
  const apiKey = getApiKey(input.apiKey);
  const useAI = !!apiKey;
  
  let ai: any = null;
  if (useAI) {
    ai = new GoogleGenAI({ apiKey: apiKey });
  }

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

  // 4. Calculate Daewun (10-year cycles) - Wonkwang style with year display
  const yun = baZi.getYun(input.gender === 'male' ? 1 : 0);
  const daewunList: CycleItem[] = [];
  const daewunObjs = yun.getDaYun();
  const startAge = yun.getStartYear(); // Age when first Daewun starts
  
  // Calculate Daewun with start years
  for (let i = 0; i < daewunObjs.length && i < 13; i++) {
    try {
      const dy = daewunObjs[i];
      const dyStartAge = dy.getStartAge();
      const ganZhi = dy.getGanZhi();
      const startYear = year + dyStartAge;
      
      daewunList.push({
        age: dyStartAge === 0 ? 0.6 : dyStartAge,
        ganji: ganZhi,
        ganjiKorean: getGanjiKorean(ganZhi),
        tenGod: getTenGod(dayStem, ganZhi.charAt(0)),
        startYear: startYear
      });
      
      if (dyStartAge > 121) break; 
    } catch (e) {
      console.warn("Daewun error", e);
      break;
    }
  }

  // 5. Calculate Saewun (Yearly Luck) - with calendar year
  const saewunList: CycleItem[] = [];
  const currentYear = new Date().getFullYear();
  // Show 10 years before and 10 years after current year (total ~21 years visible initially)
  for (let i = 0; i <= 80; i++) {
    const targetYear = year + i;
    if (targetYear > 2100) break;

    try {
      const l = Lunar.fromYmd(targetYear, 6, 1);
      const ganZhi = l.getYearInGanZhi();
      saewunList.push({
        age: i + 1, // Age (Korean age)
        ganji: ganZhi,
        ganjiKorean: getGanjiKorean(ganZhi),
        tenGod: getTenGod(dayStem, ganZhi.charAt(0)),
        year: targetYear
      });
    } catch (e) {
      console.warn(`Saewun calculation stopped at year ${targetYear}:`, e);
      break;
    }
  }

  // 6. Calculate Wolwun (Monthly Luck) - Current year focused
  const wolwunList: CycleItem[] = [];
  const wolwunYear = currentYear; // Focus on current year
  
  for (let m = 1; m <= 12; m++) {
    try {
      const s = Solar.fromYmd(wolwunYear, m, 15);
      const l = s.getLunar();
      const bz = l.getEightChar();
      const monthGan = bz.getMonthGan();
      const monthZhi = bz.getMonthZhi();
      const mGanZhi = monthGan + monthZhi;

      wolwunList.push({
        age: m, // Month number
        ganji: mGanZhi,
        ganjiKorean: getGanjiKorean(mGanZhi),
        tenGod: getTenGod(dayStem, monthGan),
        year: wolwunYear
      });
    } catch (e) {
      console.warn(`Wolwun error at ${wolwunYear}.${m}`, e);
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

  // If no API key, use default interpretations
  if (!useAI) {
    const defaultResult = getDefaultInterpretation(dayStem, counts, input.name, input.gender);
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
      missingElements: defaultResult.missingElements,
      dayMasterReading: defaultResult.dayMasterReading,
      chaeumAdvice: defaultResult.chaeumAdvice,
      healthAnalysis: defaultResult.healthAnalysis,
      fortune2026: defaultResult.fortune2026,
      luckyTable: defaultResult.luckyTable,
      fengShuiThesis: defaultResult.fengShuiThesis
    };
  }

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
    // Fallback to default if AI fails
    const defaultResult = getDefaultInterpretation(dayStem, counts, input.name, input.gender);
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
      missingElements: defaultResult.missingElements,
      dayMasterReading: defaultResult.dayMasterReading,
      chaeumAdvice: defaultResult.chaeumAdvice,
      healthAnalysis: defaultResult.healthAnalysis,
      fortune2026: defaultResult.fortune2026,
      luckyTable: defaultResult.luckyTable,
      fengShuiThesis: defaultResult.fengShuiThesis
    };
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