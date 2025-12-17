import React, { useState, useRef, useEffect } from 'react';
import { UserInput, SajuAnalysisResult, ChatMessage, CycleItem, Pillar } from './types';
import { analyzeSaju, consultSaju } from './services/geminiService';
import PillarCard from './components/PillarCard';
import LoadingSpinner from './components/LoadingSpinner';
// @ts-ignore
import html2canvas from "html2canvas";
// @ts-ignore
import jsPDF from "jspdf";

// Helper to deduce Element Color for Wonkwang Style (배경색)
const getElementBgColor = (char: string): string => {
  if ("甲乙寅卯".includes(char)) return "bg-green-100"; // 목 - 초록
  if ("丙丁巳午".includes(char)) return "bg-red-100"; // 화 - 빨강
  if ("戊己辰戌丑未".includes(char)) return "bg-yellow-100"; // 토 - 노랑
  if ("庚辛申酉".includes(char)) return "bg-gray-200"; // 금 - 회색
  if ("壬癸亥子".includes(char)) return "bg-blue-100"; // 수 - 파랑
  return "bg-white";
};

// 텍스트 색상
const getElementTextColor = (char: string): string => {
  if ("甲乙寅卯".includes(char)) return "text-green-800";
  if ("丙丁巳午".includes(char)) return "text-red-600";
  if ("戊己辰戌丑未".includes(char)) return "text-yellow-700";
  if ("庚辛申酉".includes(char)) return "text-gray-700";
  if ("壬癸亥子".includes(char)) return "text-blue-800";
  return "text-black";
};

// 원광대 만세력 스타일 대운 테이블 (정확히 동일한 레이아웃)
const DaewunTable: React.FC<{ data: CycleItem[], birthYear: number, currentAge: number }> = ({ data, birthYear, currentAge }) => {
  // 원광대 스타일: 오른쪽에서 왼쪽으로 읽음 (낮은 나이 -> 높은 나이)
  // 테이블에서는 높은 나이가 왼쪽, 낮은 나이가 오른쪽
  const displayData = [...data].sort((a, b) => {
    const ageA = typeof a.age === 'number' ? a.age : parseFloat(String(a.age));
    const ageB = typeof b.age === 'number' ? b.age : parseFloat(String(b.age));
    return ageB - ageA; // 내림차순 (121 -> 1)
  });
  
  return (
    <div className="mb-6">
      <h4 className="font-bold text-base mb-2 text-gray-800">대운 (大運)</h4>
      <div className="w-full overflow-x-auto pb-2">
        <table className="border-collapse min-w-max">
          <tbody>
            {/* 나이 행 (맨 위) */}
            <tr>
              {displayData.map((item, idx) => {
                const age = typeof item.age === 'number' ? item.age : parseFloat(String(item.age));
                const isCurrentDaewun = currentAge >= age && currentAge < age + 10;
                return (
                  <td key={idx} className={`w-10 text-[10px] text-center py-0.5 border border-gray-400 font-bold ${isCurrentDaewun ? 'bg-orange-300' : 'bg-gray-100'}`}>
                    {item.age}
                  </td>
                );
              })}
            </tr>
            {/* 천간 행 */}
            <tr>
              {displayData.map((item, idx) => {
                const age = typeof item.age === 'number' ? item.age : parseFloat(String(item.age));
                const isCurrentDaewun = currentAge >= age && currentAge < age + 10;
                return (
                  <td key={idx} className={`w-10 text-center py-1 text-lg font-bold font-serif border border-gray-400 ${isCurrentDaewun ? 'bg-orange-200' : getElementBgColor(item.ganji.charAt(0))} ${getElementTextColor(item.ganji.charAt(0))}`}>
                    {item.ganji.charAt(0)}
                  </td>
                );
              })}
            </tr>
            {/* 지지 행 */}
            <tr>
              {displayData.map((item, idx) => {
                const age = typeof item.age === 'number' ? item.age : parseFloat(String(item.age));
                const isCurrentDaewun = currentAge >= age && currentAge < age + 10;
                return (
                  <td key={idx} className={`w-10 text-center py-1 text-lg font-bold font-serif border border-gray-400 ${isCurrentDaewun ? 'bg-orange-200' : getElementBgColor(item.ganji.charAt(1))} ${getElementTextColor(item.ganji.charAt(1))}`}>
                    {item.ganji.charAt(1)}
                  </td>
                );
              })}
            </tr>
            {/* 시작년도 행 (맨 아래) */}
            <tr>
              {displayData.map((item, idx) => {
                const age = typeof item.age === 'number' ? item.age : parseFloat(String(item.age));
                const isCurrentDaewun = currentAge >= age && currentAge < age + 10;
                return (
                  <td key={idx} className={`w-10 text-[9px] text-center py-0.5 border border-gray-400 ${isCurrentDaewun ? 'bg-orange-100' : 'bg-white'} text-gray-600`}>
                    {item.startYear}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500 mt-1">← 스크롤하여 미래 대운 확인 (총 {data.length}개 대운)</p>
    </div>
  );
};

// 원광대 만세력 스타일 세운 테이블 (정확한 스타일) - 한글 병기 추가
const SaewunTable: React.FC<{ data: CycleItem[], currentAge: number, birthYear: number }> = ({ data, currentAge, birthYear }) => {
  // 역순으로 표시 (높은 나이 왼쪽 → 낮은 나이 오른쪽)
  const displayData = [...data].reverse();
  const currentYear = new Date().getFullYear();

  // 한자 -> 한글 변환
  const getKorean = (char: string): string => {
    const ganMap: Record<string, string> = {"甲":"갑","乙":"을","丙":"병","丁":"정","戊":"무","己":"기","庚":"경","辛":"신","壬":"임","癸":"계"};
    const zhiMap: Record<string, string> = {"子":"자","丑":"축","寅":"인","卯":"모","辰":"진","巳":"사","午":"오","未":"미","申":"신","酉":"유","戌":"술","亥":"해"};
    return ganMap[char] || zhiMap[char] || '';
  };
  
  return (
    <div className="mb-6">
      <h4 className="font-bold text-base mb-2 text-gray-800 bg-gray-100 inline-block px-2 py-1">세운 (歲運)</h4>
      <div className="w-full overflow-x-auto pb-2">
        {/* 년도 행 (상단) */}
        <div className="flex flex-row min-w-max">
          {displayData.map((item, idx) => {
            const isCurrentYear = item.year === currentYear;
            return (
              <div key={idx} className={`w-10 text-[8px] text-center py-0.5 border border-gray-300 ${isCurrentYear ? 'bg-orange-300 font-bold' : 'bg-white'} text-gray-700`}>
                {item.year}
              </div>
            );
          })}
        </div>
        {/* 천간 행 + 한글 */}
        <div className="flex flex-row min-w-max">
          {displayData.map((item, idx) => {
            const isCurrentYear = item.year === currentYear;
            const stem = item.ganji.charAt(0);
            return (
              <div key={idx} className={`w-10 text-center py-0.5 border-x border-gray-300 relative ${isCurrentYear ? 'bg-orange-200' : getElementBgColor(stem)} ${getElementTextColor(stem)}`}>
                <span className="text-base font-bold font-serif">{stem}</span>
                <span className="text-[8px] text-gray-500 absolute bottom-0 right-0.5">{getKorean(stem)}</span>
              </div>
            );
          })}
        </div>
        {/* 지지 행 + 한글 */}
        <div className="flex flex-row min-w-max">
          {displayData.map((item, idx) => {
            const isCurrentYear = item.year === currentYear;
            const branch = item.ganji.charAt(1);
            return (
              <div key={idx} className={`w-10 text-center py-0.5 border-x border-gray-300 relative ${isCurrentYear ? 'bg-orange-200' : getElementBgColor(branch)} ${getElementTextColor(branch)}`}>
                <span className="text-base font-bold font-serif">{branch}</span>
                <span className="text-[8px] text-gray-500 absolute bottom-0 right-0.5">{getKorean(branch)}</span>
              </div>
            );
          })}
        </div>
        {/* 나이 행 (하단) */}
        <div className="flex flex-row min-w-max">
          {displayData.map((item, idx) => {
            const isCurrentYear = item.year === currentYear;
            return (
              <div key={idx} className={`w-10 text-[9px] text-center py-0.5 border border-gray-300 ${isCurrentYear ? 'bg-orange-300 font-bold' : 'bg-white'}`}>
                {item.age}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// 원광대 만세력 스타일 월운 테이블 - 수십 년치 표시 (태어난 해~현재+5년) - 한글 병기 추가
const WolwunTable: React.FC<{ data: CycleItem[], title: string, birthYear: number }> = ({ data, title, birthYear }) => {
  // 역순으로 표시 (최근 → 과거)
  const displayData = [...data].reverse();
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  // 한자 -> 한글 변환
  const getKorean = (char: string): string => {
    const ganMap: Record<string, string> = {"甲":"갑","乙":"을","丙":"병","丁":"정","戊":"무","己":"기","庚":"경","辛":"신","壬":"임","癸":"계"};
    const zhiMap: Record<string, string> = {"子":"자","丑":"축","寅":"인","卯":"모","辰":"진","巳":"사","午":"오","未":"미","申":"신","酉":"유","戌":"술","亥":"해"};
    return ganMap[char] || zhiMap[char] || '';
  };
  
  return (
    <div className="mb-6">
      <h4 className="font-bold text-base mb-2 text-gray-800 bg-yellow-100 inline-block px-2 py-1 border border-yellow-300">{title}</h4>
      <div className="w-full overflow-x-auto pb-2">
        {/* 천간 행 + 한글 */}
        <div className="flex flex-row min-w-max">
          {displayData.map((item, idx) => {
            const monthNum = Number(item.age);
            const isCurrentMonth = item.year === currentYear && monthNum === currentMonth;
            const isYearStart = item.age === 1; // 1월이 년도의 시작
            const stem = item.ganji.charAt(0);
            return (
              <div key={idx} className={`w-10 text-center py-0.5 border border-gray-300 relative ${isYearStart ? 'border-l-2 border-l-red-400' : ''} ${isCurrentMonth ? 'bg-pink-200' : getElementBgColor(stem)} ${getElementTextColor(stem)}`}>
                <span className="text-base font-bold font-serif">{stem}</span>
                <span className="text-[8px] text-gray-500 absolute bottom-0 right-0.5">{getKorean(stem)}</span>
              </div>
            );
          })}
        </div>
        {/* 지지 행 + 한글 */}
        <div className="flex flex-row min-w-max">
          {displayData.map((item, idx) => {
            const monthNum = Number(item.age);
            const isCurrentMonth = item.year === currentYear && monthNum === currentMonth;
            const isYearStart = item.age === 1;
            const branch = item.ganji.charAt(1);
            return (
              <div key={idx} className={`w-10 text-center py-0.5 border-x border-b border-gray-300 relative ${isYearStart ? 'border-l-2 border-l-red-400' : ''} ${isCurrentMonth ? 'bg-pink-200' : getElementBgColor(branch)} ${getElementTextColor(branch)}`}>
                <span className="text-base font-bold font-serif">{branch}</span>
                <span className="text-[8px] text-gray-500 absolute bottom-0 right-0.5">{getKorean(branch)}</span>
              </div>
            );
          })}
        </div>
        {/* 월 행 (하단) */}
        <div className="flex flex-row min-w-max">
          {displayData.map((item, idx) => {
            const monthNum = Number(item.age);
            const isCurrentMonth = item.year === currentYear && monthNum === currentMonth;
            const isYearStart = item.age === 1;
            return (
              <div key={idx} className={`w-10 text-[10px] text-center py-0.5 border-x border-b border-gray-300 ${isYearStart ? 'border-l-2 border-l-red-400' : ''} ${isCurrentMonth ? 'bg-pink-300 font-bold' : 'bg-white'}`}>
                {item.age}
              </div>
            );
          })}
        </div>
        {/* 년도 행 (맨 하단) - 1월마다 년도 표시 */}
        <div className="flex flex-row min-w-max">
          {displayData.map((item, idx) => {
            const isYearLabel = item.age === 1; // 1월 위치에 년도 표시
            return (
              <div key={idx} className={`w-10 text-[8px] text-center py-0.5 bg-gray-50 ${isYearLabel ? 'text-gray-700 font-bold' : 'text-transparent'}`}>
                {isYearLabel ? item.year : ''}
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-1">← 스크롤하여 과거/미래 월운 확인 (총 {Math.ceil(data.length / 12)}년치)</p>
    </div>
  );
};

// New Component for Exact Pillar Cell Matching the Image
const ExactPillarCell: React.FC<{ pillar: Pillar, label: string }> = ({ pillar, label }) => {
  return (
    <div className="flex flex-col w-full h-full border-r last:border-r-0 border-gray-300">
      {/* Top Label (Ten God Stem) */}
      <div className="text-center py-1 text-sm font-bold bg-gray-100 border-b border-gray-300">
        {label}
      </div>
      
      {/* Content Area */}
      <div className="flex-1 flex flex-col items-center py-2 bg-white space-y-2">
        
        {/* Stem Box */}
        <div className="flex flex-col items-center">
           <span className="text-xs font-bold text-gray-600 mb-0.5">{pillar.stemTenGod}</span>
           <div className={`w-12 h-12 border flex items-center justify-center shadow-sm relative ${getElementBgColor(pillar.stem)}`}>
             <span className="font-serif text-3xl font-bold z-10">{pillar.stem}</span>
             {/* Small Korean */}
             <span className="absolute bottom-0 right-0 text-[9px] text-gray-500 p-0.5 opacity-70">{pillar.stemKorean}</span>
           </div>
        </div>

        {/* Branch Box */}
        <div className="flex flex-col items-center">
           <div className={`w-12 h-12 border flex items-center justify-center shadow-sm relative ${getElementBgColor(pillar.branch)}`}>
             <span className="font-serif text-3xl font-bold z-10">{pillar.branch}</span>
             <span className="absolute bottom-0 right-0 text-[9px] text-gray-500 p-0.5 opacity-70">{pillar.branchKorean}</span>
           </div>
           <span className="text-xs font-bold text-gray-600 mt-0.5">{pillar.branchTenGod}</span>
        </div>

        {/* Ji Jang Gan (Hidden Stems) - Displayed as small list */}
        <div className="flex space-x-1 mt-1">
          {pillar.jiJangGan.map((char, i) => (
             <span key={i} className="text-[10px] text-gray-500 font-serif">{char}</span>
          ))}
        </div>

      </div>
    </div>
  );
}

const App: React.FC = () => {
  const [input, setInput] = useState<UserInput>({ name: '', birthDate: '', birthTime: '', gender: 'male', apiKey: '' });
  const [sajuResult, setSajuResult] = useState<SajuAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const fullReportRef = useRef<HTMLDivElement>(null); // 전체 화면 캡처용

  // New State for API Key UI
  const [isKeySaved, setIsKeySaved] = useState(false);

  // localStorage에서 API 키 불러오기 (앱 시작 시)
  useEffect(() => {
    const savedApiKey = localStorage.getItem('gemini_api_key');
    if (savedApiKey) {
      setInput(prev => ({ ...prev, apiKey: savedApiKey }));
      setIsKeySaved(true);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setInput(prev => ({ ...prev, [name]: value }));
  };

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(prev => ({ ...prev, apiKey: e.target.value }));
    setIsKeySaved(false); // Reset saved status on edit
  };

  const handleSaveKey = () => {
    if (input.apiKey && input.apiKey.trim().length > 0) {
      // localStorage에 API 키 저장
      localStorage.setItem('gemini_api_key', input.apiKey.trim());
      setIsKeySaved(true);
    }
  };

  // API 키 삭제 함수
  const handleDeleteKey = () => {
    localStorage.removeItem('gemini_api_key');
    setInput(prev => ({ ...prev, apiKey: '' }));
    setIsKeySaved(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.birthDate || !input.birthTime || !input.name) return;
    setIsAnalyzing(true);
    setSajuResult(null);
    try {
      const result = await analyzeSaju(input);
      setSajuResult(result);
      const missingText = result.missingElements.map(m => `${m.priority}순위 ${m.element}`).join(', ');
      const welcomeMsg = `반갑네, ${input.name}. 내 자네의 사주를 짚어보니 ${missingText} 기운이 가장 시급하구려. 이를 채우면 대박이 날 터이니, 궁금한 것이 있다면 상세히 물어보게나.

예시 질문:
• 내년에 직장을 이직하는데 좋은가요?
• 내년에 애인이 생기나요?
• 내년에 사업을 하면 좋은가요?
• 건강은 어떤 부분을 조심해야 하나요?`;
      setChatMessages([{ id: 'init', role: 'model', text: welcomeMsg }]);
    } catch (error: any) {
      alert(`[오류 발생] ${error.message || "알 수 없는 오류"}\nAPI Key가 정확한지 확인해주세요.`);
      console.error(error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !sajuResult) return;
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsChatLoading(true);
    try {
      const apiHistory = chatMessages.map(msg => ({ role: msg.role, parts: [{ text: msg.text }] }));
      const answer = await consultSaju(userMsg.text, sajuResult, apiHistory, input.apiKey, input.name);
      setChatMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'model', text: answer }]);
    } catch (error) {
      setChatMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: "도사님이 잠시 출타중이십니다.", isError: true }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // 텍스트 파일 다운로드
  const handleDownloadText = () => {
    if (!sajuResult) return;
    
    let content = `═══════════════════════════════════════════════════════════════
                    천기누설 운명 감정서
═══════════════════════════════════════════════════════════════

【 기본 정보 】
성명: ${input.name}
나이: ${sajuResult.koreanAge}세
생년월일(양력): ${sajuResult.solarDateStr}
생년월일(음력): ${sajuResult.lunarDateStr}
태어난 시각: ${input.birthTime}
절기: ${sajuResult.solarTermStr}

【 사주 원국 】
년주: ${sajuResult.yearPillar.stem}${sajuResult.yearPillar.branch} (${sajuResult.yearPillar.stemKorean}${sajuResult.yearPillar.branchKorean})
월주: ${sajuResult.monthPillar.stem}${sajuResult.monthPillar.branch} (${sajuResult.monthPillar.stemKorean}${sajuResult.monthPillar.branchKorean})
일주: ${sajuResult.dayPillar.stem}${sajuResult.dayPillar.branch} (${sajuResult.dayPillar.stemKorean}${sajuResult.dayPillar.branchKorean})
시주: ${sajuResult.hourPillar.stem}${sajuResult.hourPillar.branch} (${sajuResult.hourPillar.stemKorean}${sajuResult.hourPillar.branchKorean})

【 오행 분포 】
木: ${sajuResult.elementCounts.Wood}개
火: ${sajuResult.elementCounts.Fire}개
土: ${sajuResult.elementCounts.Earth}개
金: ${sajuResult.elementCounts.Metal}개
水: ${sajuResult.elementCounts.Water}개

채워야 할 기운: ${sajuResult.missingElements.map(m => `${m.priority}순위 ${m.element}`).join(', ')}

═══════════════════════════════════════════════════════════════
                    1. 타고난 기질과 운명
═══════════════════════════════════════════════════════════════

${sajuResult.dayMasterReading}

═══════════════════════════════════════════════════════════════
                    2. 개운 비책 (대박의 열쇠)
═══════════════════════════════════════════════════════════════

${sajuResult.chaeumAdvice.summary}

▶ 행운의 색: ${sajuResult.chaeumAdvice.color}
${sajuResult.chaeumAdvice.colorAdvice || ''}

▶ 대박 방위: ${sajuResult.chaeumAdvice.direction}
${sajuResult.chaeumAdvice.directionAdvice || ''}

▶ 개운 아이템: ${sajuResult.chaeumAdvice.items}
${sajuResult.chaeumAdvice.itemAdvice || ''}

═══════════════════════════════════════════════════════════════
                    3. 맞춤형 건강 처방
═══════════════════════════════════════════════════════════════

▶ 취약 장기
${sajuResult.healthAnalysis.weakOrgans}

▶ 예상 증상
${sajuResult.healthAnalysis.symptoms}

▶ 전문의 상세 처방
${sajuResult.healthAnalysis.medicalAdvice}

▶ 추천 식이요법
${sajuResult.healthAnalysis.foodRecommendation}

═══════════════════════════════════════════════════════════════
                    4. 2026년 (병오년) 대박 운세
═══════════════════════════════════════════════════════════════

【 총운 】
${sajuResult.fortune2026.overall}

【 재물운 】
${sajuResult.fortune2026.wealth}

【 직업/사업운 】
${sajuResult.fortune2026.career}

【 건강운 】
${sajuResult.fortune2026.health}

【 애정/가정운 】
${sajuResult.fortune2026.love}

═══════════════════════════════════════════════════════════════
                    5. 귀인과 길일 (풍수지리)
═══════════════════════════════════════════════════════════════

${sajuResult.luckyTable.map(row => `• ${row.date} / ${row.time} / ${row.direction}`).join('\n')}

【 풍수학적 분석 】
${sajuResult.fengShuiThesis}

═══════════════════════════════════════════════════════════════
                    6. 천기도사님과의 상담 기록
═══════════════════════════════════════════════════════════════

`;
    
    // 채팅 내용 추가
    chatMessages.forEach(msg => {
      if (msg.role === 'user') {
        content += `\n[질문] ${msg.text}\n`;
      } else {
        content += `\n[천기도사] ${msg.text}\n`;
      }
    });

    content += `
═══════════════════════════════════════════════════════════════
                    천기누설 운명 감정원
                    ${new Date().toLocaleDateString('ko-KR')} 작성
═══════════════════════════════════════════════════════════════
`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${input.name}_천기누설_통합감정서.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPDF = async () => {
    if (!fullReportRef.current || !sajuResult) return;
    try {
      // 로딩 표시
      const loadingMsg = document.createElement('div');
      loadingMsg.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 9999; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px;';
      loadingMsg.innerHTML = '📄 PDF 생성 중... 잠시만 기다려주세요';
      document.body.appendChild(loadingMsg);

      // 화면에 보이는 전체 콘텐츠를 그대로 캡처
      const element = fullReportRef.current;
      
      const canvas = await html2canvas(element, { 
        scale: 2,
        useCORS: true, 
        backgroundColor: "#F7F5F0",
        logging: false,
        allowTaint: true,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
        scrollX: 0,
        scrollY: 0
      });
      
      document.body.removeChild(loadingMsg);
      
      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth - 10; // 좌우 여백 5mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 5; // 상단 여백
      let pageCount = 0;
      
      // 첫 페이지
      pdf.addImage(imgData, 'JPEG', 5, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;
      pageCount++;
      
      // 추가 페이지
      while (heightLeft > 0) {
        position = heightLeft - imgHeight + 5;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 5, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
        pageCount++;
      }
      
      pdf.save(`${input.name}_천기누설_운명감정서.pdf`);
      alert(`🎉 PDF 다운로드 완료!\n\n총 ${pageCount} 페이지의 상세한 감정서가 저장되었습니다.`);
    } catch (err) { 
      console.error('PDF 생성 오류:', err);
      alert("PDF 다운로드 실패. 텍스트 파일로 다운로드를 시도해주세요."); 
    }
  };

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-oriental-black font-sans">
      {!sajuResult && !isAnalyzing && (
        <div className="max-w-md mx-auto min-h-screen flex flex-col items-center justify-center p-6 animate-fade-in-up">
          <div className="mb-8 text-center">
            <div className="w-24 h-24 mx-auto bg-purple-100 rounded-full flex items-center justify-center mb-4 shadow-inner"><span className="text-6xl">☯️</span></div>
            <h1 className="text-4xl font-serif font-bold text-oriental-black mb-2">천기누설</h1>
            <p className="text-gray-500 text-sm tracking-widest">天機漏洩 : 운명 감정원</p>
          </div>
          <form onSubmit={handleSubmit} className="w-full space-y-5 bg-white p-8 rounded-xl shadow-xl border border-oriental-gold/20">
            
            {/* Custom API Key Section - localStorage 저장 */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🔑</span>
                  <span className="font-bold text-gray-700 text-sm">Gemini API Key</span>
                </div>
                {isKeySaved && (
                  <span className="text-green-600 text-xs font-bold flex items-center gap-1">
                    ✔ 저장됨 (자동 불러옴)
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="password"
                  name="apiKey"
                  value={input.apiKey}
                  onChange={handleApiKeyChange}
                  placeholder={isKeySaved ? "저장된 키가 있습니다" : "API 키를 입력하세요"}
                  className="flex-1 border border-gray-300 rounded p-2 text-sm focus:outline-none focus:border-oriental-gold tracking-widest h-10"
                />
                <button
                  type="button"
                  onClick={handleSaveKey}
                  className="bg-[#B93632] text-white font-bold px-4 rounded-md h-10 shadow-md hover:bg-red-800 transition-colors text-sm whitespace-nowrap"
                >
                  저장
                </button>
                {isKeySaved && (
                  <button
                    type="button"
                    onClick={handleDeleteKey}
                    className="bg-gray-500 text-white font-bold px-3 rounded-md h-10 shadow-md hover:bg-gray-600 transition-colors text-sm"
                    title="저장된 키 삭제"
                  >
                    🗑️
                  </button>
                )}
              </div>
              <p className="text-gray-400 text-xs mt-2">
                💡 API 키는 브라우저에 저장되어 다음에 자동으로 불러옵니다. (선택사항)
              </p>
            </div>

            <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">성명 (姓名)</label><input type="text" name="name" value={input.name} onChange={handleInputChange} placeholder="홍길동" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg" required /></div>
            <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">생년월일 (양력)</label><input type="date" name="birthDate" value={input.birthDate} onChange={handleInputChange} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg" required /></div>
            <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">태어난 시각</label><input type="time" name="birthTime" value={input.birthTime} onChange={handleInputChange} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg" required /></div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">성별</label>
              <div className="flex bg-gray-50 p-1 rounded-lg">
                <label className={`flex-1 text-center py-2 rounded-md cursor-pointer ${input.gender === 'male' ? 'bg-white shadow font-bold' : 'text-gray-400'}`}><input type="radio" name="gender" value="male" className="hidden" checked={input.gender === 'male'} onChange={handleInputChange} />남성</label>
                <label className={`flex-1 text-center py-2 rounded-md cursor-pointer ${input.gender === 'female' ? 'bg-white shadow font-bold' : 'text-gray-400'}`}><input type="radio" name="gender" value="female" className="hidden" checked={input.gender === 'female'} onChange={handleInputChange} />여성</label>
              </div>
            </div>
            
            <button type="submit" className="w-full bg-oriental-black text-white font-serif text-lg py-4 rounded-lg shadow-lg hover:bg-gray-800 transition-all mt-4">운명 감정 받기 ➤</button>
          </form>
        </div>
      )}
      {isAnalyzing && <div className="fixed inset-0 bg-[#F7F5F0] z-50 flex flex-col items-center justify-center"><LoadingSpinner message={`${input.name} 님의 만세력을 짚어보고 있습니다...`} /></div>}
      
      {/* MAIN RESULT VIEW */}
      {sajuResult && (
        <div ref={fullReportRef} className="max-w-4xl mx-auto p-4 md:p-8 space-y-16 pb-32">
          
          <section className="animate-fade-in-up">
            <div className="flex items-center mb-6 border-b border-gray-300 pb-2 justify-between">
              <h1 className="text-2xl font-serif font-bold text-white bg-gray-600 px-4 py-1 rounded-t-lg">만 세 력</h1>
              <div className="text-sm text-gray-500 hover:text-gray-800 cursor-pointer">🏠 홈</div>
            </div>

            {/* 1. MANSE-RYOK HEADER TABLE */}
            <div className="bg-[#fff0e6] border border-gray-300 mb-0">
               <div className="text-center py-2 font-bold text-xl border-b border-gray-300">
                 {input.name}({sajuResult.koreanAge}세)
               </div>
               <div className="grid grid-cols-[80px_1fr] text-sm">
                 <div className="border-r border-gray-300 flex items-center justify-center font-bold bg-[#ffe0cc]">
                   {input.gender === 'male' ? '남자' : '여자'}
                 </div>
                 <div className="p-2 space-y-1 bg-[#fff0e6]">
                    <div className="flex">
                      <span className="w-10 font-bold">(양)</span>
                      <span>{sajuResult.solarDateStr}</span>
                      <span className="ml-4 font-bold">{input.birthTime}</span>
                    </div>
                    <div className="flex">
                      <span className="w-10 font-bold">(음)</span>
                      <span>{sajuResult.lunarDateStr}</span>
                    </div>
                    <div className="flex text-blue-600 font-bold">
                      <span className="w-10">(절)</span>
                      <span>{sajuResult.solarTermStr}</span>
                    </div>
                 </div>
               </div>
            </div>

            {/* 2. PILLARS GRID (EXACT MATCH) */}
            <div className="border border-t-0 border-gray-300 bg-white mb-0">
              <div className="grid grid-cols-4">
                 <ExactPillarCell label="시주" pillar={sajuResult.hourPillar} />
                 <ExactPillarCell label="일주" pillar={sajuResult.dayPillar} />
                 <ExactPillarCell label="월주" pillar={sajuResult.monthPillar} />
                 <ExactPillarCell label="년주" pillar={sajuResult.yearPillar} />
              </div>
            </div>

            {/* 3. ELEMENT COUNTS BAR */}
            <div className="bg-gray-200 border border-t-0 border-gray-300 p-2 flex justify-around text-sm font-bold">
               <span className="text-green-800">木({sajuResult.elementCounts.Wood})</span>
               <span className="text-red-800">火({sajuResult.elementCounts.Fire})</span>
               <span className="text-yellow-700">土({sajuResult.elementCounts.Earth})</span>
               <span className="text-gray-600">金({sajuResult.elementCounts.Metal})</span>
               <span className="text-black">水({sajuResult.elementCounts.Water})</span>
            </div>
            
            <div className="mt-8"></div>

            {/* 원광대 만세력 스타일 대운/세운/월운 테이블 */}
            <DaewunTable 
              data={sajuResult.daewun} 
              birthYear={parseInt(input.birthDate.split('-')[0])} 
              currentAge={sajuResult.koreanAge} 
            />
            <SaewunTable 
              data={sajuResult.saewun} 
              currentAge={sajuResult.koreanAge}
              birthYear={parseInt(input.birthDate.split('-')[0])}
            />
            <WolwunTable 
              data={sajuResult.wolwun} 
              title={`월운 (月運) - ${parseInt(input.birthDate.split('-')[0])}년~${new Date().getFullYear() + 5}년`}
              birthYear={parseInt(input.birthDate.split('-')[0])}
            />
          </section>

          {/* 2. 타고난 기질 */}
          <section className="bg-white p-6 md:p-8 rounded-xl shadow-sm border-l-4 border-gray-800">
            <h2 className="text-2xl font-serif font-bold mb-6">2. 타고난 기질과 운명</h2>
            <p className="leading-8 text-gray-800 text-justify whitespace-pre-line">{sajuResult.dayMasterReading}</p>
          </section>
          
          {/* 3. 개운 비책 (대박의 열쇠) */}
          <section className="bg-[#FFF8F0] p-6 md:p-8 rounded-xl border border-[#E8D4C0] shadow-md">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">🔑</span>
              <h2 className="text-2xl font-serif font-bold text-[#8B6914]">3. 도사님의 개운 비책 (대박의 열쇠)</h2>
            </div>
            <p className="text-gray-600 text-sm mb-6">부족한 오행을 채워 흉을 길로 바꾸는 비법입니다.</p>

            {/* 반드시 채워야 할 기운 */}
            <div className="bg-white p-6 rounded-lg border border-[#E8D4C0] mb-6 text-center">
              <p className="text-gray-600 mb-2">반드시 채워야 할 기운</p>
              <p className="text-sm text-gray-500 mb-3">1순위 · 2순위</p>
              <p className="text-4xl font-bold text-[#C5A059]">
                {sajuResult.missingElements.map(m => m.element.replace('(', '').replace(')', '').split('')[0]).join(' · ')}
              </p>
            </div>

            {/* 개운 조언 요약 */}
            <div className="bg-white/80 p-6 rounded-lg mb-6">
              <p className="leading-8 text-gray-800 text-justify whitespace-pre-line">{sajuResult.chaeumAdvice.summary}</p>
            </div>

            {/* 3가지 개운법 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">🎨</span>
                  <h4 className="font-bold text-gray-800">행운의 색</h4>
                </div>
                <p className="font-bold text-lg text-[#C5A059] mb-3">{sajuResult.chaeumAdvice.color}</p>
                {sajuResult.chaeumAdvice.colorAdvice && (
                  <p className="text-gray-600 text-sm leading-6">{sajuResult.chaeumAdvice.colorAdvice}</p>
                )}
              </div>
              <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">🧭</span>
                  <h4 className="font-bold text-gray-800">대박 방위</h4>
                </div>
                <p className="font-bold text-lg text-[#C5A059] mb-3">{sajuResult.chaeumAdvice.direction}</p>
                {sajuResult.chaeumAdvice.directionAdvice && (
                  <p className="text-gray-600 text-sm leading-6">{sajuResult.chaeumAdvice.directionAdvice}</p>
                )}
              </div>
              <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">🏺</span>
                  <h4 className="font-bold text-gray-800">개운 아이템</h4>
                </div>
                <p className="font-bold text-lg text-[#C5A059] mb-3">{sajuResult.chaeumAdvice.items}</p>
                {sajuResult.chaeumAdvice.itemAdvice && (
                  <p className="text-gray-600 text-sm leading-6">{sajuResult.chaeumAdvice.itemAdvice}</p>
                )}
              </div>
            </div>
          </section>

          {/* 4. 건강 처방 */}
          <section className="bg-blue-50 p-6 md:p-8 rounded-xl border border-blue-100 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🩺</span>
              <h2 className="text-2xl font-serif font-bold text-blue-900">4. 맞춤형 건강 처방 (Medical Report)</h2>
            </div>
            <p className="text-gray-500 text-sm mb-6">의학 전문의가 분석한 사주 체질과 관리법입니다.</p>
            
            <div className="space-y-6">
              {/* 취약 장기 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
                  <h3 className="font-bold text-lg mb-3 text-red-600 flex items-center gap-2">⚠️ 취약 장기</h3>
                  <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">{sajuResult.healthAnalysis.weakOrgans}</p>
                </div>
                <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
                  <h3 className="font-bold text-lg mb-3 text-orange-600 flex items-center gap-2">🩺 예상 증상</h3>
                  <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">{sajuResult.healthAnalysis.symptoms}</p>
                </div>
              </div>
              {/* 전문의 상세 처방 */}
              <div className="bg-white p-6 rounded-lg border border-blue-200 shadow-sm">
                <h3 className="font-bold text-lg mb-4 text-blue-800 flex items-center gap-2">📋 전문의 상세 처방</h3>
                <p className="text-gray-700 text-sm leading-8 whitespace-pre-line text-justify">{sajuResult.healthAnalysis.medicalAdvice}</p>
              </div>
              {/* 추천 식이요법 */}
              <div className="bg-green-50 p-6 rounded-lg border border-green-200">
                <h3 className="font-bold text-lg mb-4 text-green-800 flex items-center gap-2">🥗 추천 식이요법</h3>
                <p className="text-gray-700 text-sm leading-7 whitespace-pre-line">{sajuResult.healthAnalysis.foodRecommendation}</p>
              </div>
            </div>
          </section>

          {/* 5. 2026년 운세 */}
          <section className="bg-white p-6 md:p-8 rounded-xl shadow-lg border-t-4 border-red-500">
            <h2 className="text-2xl font-serif font-bold mb-6 text-red-700">5. 2026년 (병오년) 대박 운세</h2>
            
            {/* 총운 */}
            <div className="bg-red-50 p-6 rounded-lg border border-red-100 mb-6">
              <h3 className="font-bold text-lg mb-3 text-red-800">🔥 총운</h3>
              <p className="text-gray-800 leading-8 whitespace-pre-line text-justify">{sajuResult.fortune2026.overall}</p>
            </div>

            {/* 세부 운세 그리드 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-yellow-50 p-5 rounded-lg border border-yellow-200">
                <h4 className="font-bold mb-3 text-yellow-800 flex items-center gap-2">💰 재물운</h4>
                <p className="text-gray-700 text-sm leading-7 whitespace-pre-line">{sajuResult.fortune2026.wealth}</p>
              </div>
              <div className="bg-blue-50 p-5 rounded-lg border border-blue-200">
                <h4 className="font-bold mb-3 text-blue-800 flex items-center gap-2">💼 직업/사업운</h4>
                <p className="text-gray-700 text-sm leading-7 whitespace-pre-line">{sajuResult.fortune2026.career}</p>
              </div>
              <div className="bg-pink-50 p-5 rounded-lg border border-pink-200">
                <h4 className="font-bold mb-3 text-pink-700 flex items-center gap-2">💕 애정/가정운</h4>
                <p className="text-gray-700 text-sm leading-7 whitespace-pre-line">{sajuResult.fortune2026.love}</p>
              </div>
              <div className="bg-green-50 p-5 rounded-lg border border-green-200">
                <h4 className="font-bold mb-3 text-green-800 flex items-center gap-2">💪 건강운</h4>
                <p className="text-gray-700 text-sm leading-7 whitespace-pre-line">{sajuResult.fortune2026.health}</p>
              </div>
            </div>
          </section>

          <section className="bg-gray-900 text-gray-100 p-8 rounded-xl shadow-2xl"><h2 className="text-2xl font-serif font-bold mb-6 text-yellow-500">6. 귀인과 길일 (풍수지리)</h2><div className="mb-8"><table className="w-full text-sm text-left text-gray-300"><thead className="text-xs text-gray-400 uppercase bg-gray-800"><tr><th className="px-4 py-3">날짜</th><th className="px-4 py-3">시간</th><th className="px-4 py-3">방위</th></tr></thead><tbody className="divide-y divide-gray-700">{sajuResult.luckyTable.map((row, index) => <tr key={index}><td className="px-4 py-3 text-yellow-400 font-bold">{row.date}</td><td className="px-4 py-3">{row.time}</td><td className="px-4 py-3 text-blue-400">{row.direction}</td></tr>)}</tbody></table></div><div className="prose prose-invert max-w-none text-justify text-sm opacity-90"><h4 className="font-bold text-yellow-500 mb-2">풍수학적 분석</h4><p className="whitespace-pre-line">{sajuResult.fengShuiThesis}</p></div></section>

          {/* 천기도사님 친견실 - 확장된 채팅 섹션 */}
          <section className="bg-white rounded-xl shadow-lg border-2 border-oriental-black overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-gray-900 to-purple-900 text-white p-4">
              <h3 className="font-serif font-bold text-xl">🔮 天氣道師 親見室 (천기도사 친견실)</h3>
              <p className="text-sm text-gray-300 mt-1">궁금한 사항을 물어보시면 상세히 답변해 드립니다.</p>
            </div>
            
            {/* 채팅 메시지 영역 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 min-h-[400px] max-h-[600px]">
              {chatMessages.map(msg => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[90%] px-5 py-4 rounded-2xl text-sm ${
                    msg.role === 'user' 
                      ? 'bg-oriental-black text-white' 
                      : 'bg-white border border-gray-200 shadow-sm'
                  }`}>
                    {msg.role === 'model' && (
                      <div className="flex items-center gap-2 mb-2 text-amber-700 font-bold">
                        <span>🔮</span>
                        <span>天氣道師 (천기도사)</span>
                      </div>
                    )}
                    <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>
                  </div>
                </div>
              ))}
              {isChatLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-200 px-5 py-4 rounded-2xl shadow-sm">
                    <div className="flex items-center gap-2 text-gray-500">
                      <span className="animate-pulse">🔮</span>
                      <span>도사님이 천기를 읽고 계십니다...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            
            {/* 예시 질문 버튼 */}
            <div className="px-4 py-3 bg-gray-100 border-t border-gray-200">
              <p className="text-xs text-gray-500 mb-2">예시 질문:</p>
              <div className="flex flex-wrap gap-2">
                {['내년에 직장을 이직하는데 좋은가요?', '내년에 애인이 생기나요?', '내년에 사업을 하면 좋은가요?'].map((q, i) => (
                  <button 
                    key={i} 
                    onClick={() => setChatInput(q)}
                    className="text-xs bg-white border border-gray-300 px-3 py-1.5 rounded-full hover:bg-gray-50 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
            
            {/* 입력 폼 - 고민 적는란에 placeholder 개선 */}
            <form onSubmit={handleChatSubmit} className="p-4 border-t bg-white">
              <div className="flex space-x-2">
                <input 
                  type="text" 
                  value={chatInput} 
                  onChange={e => setChatInput(e.target.value)} 
                  placeholder="고민을 적어주세요 ex. 로또구입시기, 직장이직여부, 연애운, 재물운 등" 
                  className="flex-1 px-4 py-3 border rounded-full focus:outline-none focus:ring-2 focus:ring-oriental-gold placeholder:text-gray-400 placeholder:opacity-60" 
                  disabled={isChatLoading} 
                />
                <button 
                  type="submit" 
                  className="bg-oriental-black text-white w-12 h-12 rounded-full flex items-center justify-center hover:bg-gray-800 transition-colors disabled:opacity-50"
                  disabled={isChatLoading || !chatInput.trim()}
                >
                  ➤
                </button>
              </div>
            </form>
          </section>

          {/* 다운로드 섹션 */}
          <section className="bg-gradient-to-r from-amber-50 to-orange-50 p-8 rounded-xl border border-amber-200 shadow-lg">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-serif font-bold text-gray-800 mb-2">📄 감정서 다운로드</h3>
              <p className="text-gray-600 text-sm">위의 상담 내용을 포함한 전체 감정서를 다운로드하세요.</p>
            </div>
            
            <div className="flex flex-col md:flex-row justify-center gap-4">
              <button 
                onClick={handleDownloadText} 
                className="flex items-center justify-center gap-2 bg-white border-2 border-gray-300 text-gray-700 px-8 py-4 rounded-xl shadow-md hover:bg-gray-50 transition-all font-bold"
              >
                <span className="text-2xl">📝</span>
                <span>텍스트 파일 (TXT)</span>
              </button>
              <button 
                onClick={handleDownloadPDF} 
                className="flex items-center justify-center gap-2 bg-oriental-black text-white px-8 py-4 rounded-xl shadow-md hover:bg-gray-800 transition-all font-bold"
              >
                <span className="text-2xl">📕</span>
                <span>PDF 파일</span>
              </button>
            </div>
            
            <div className="mt-6 text-center">
              <button 
                onClick={() => setShowEditModal(true)} 
                className="text-gray-500 hover:text-gray-700 underline text-sm"
              >
                ✏️ 내용 편집 후 다운로드
              </button>
            </div>
            
            <div className="mt-6 p-4 bg-white/50 rounded-lg">
              <p className="text-xs text-gray-500 text-center">
                💡 Tip: 전체 내용(만세력 + 운세 분석 + 상담 기록)을 담으면 PDF 약 <strong>15~25페이지</strong> 분량이 됩니다.
              </p>
            </div>
          </section>

          {/* 처음으로 돌아가기 */}
          <div className="flex justify-center pb-10">
            <button 
              onClick={() => { setSajuResult(null); setChatMessages([]); }} 
              className="text-gray-500 hover:text-gray-700 underline"
            >
              🏠 처음으로 돌아가기
            </button>
          </div>
        </div>
      )}

      {showEditModal && sajuResult && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-6xl h-[90vh] rounded-lg flex flex-col overflow-hidden">
             <div className="p-4 bg-gray-100 flex justify-between items-center border-b"><span className="font-bold text-gray-700">✏️ 편집 모드</span><div className="space-x-3"><button onClick={handleDownloadPDF} className="bg-blue-600 text-white px-4 py-2 rounded font-bold">PDF 저장</button><button onClick={() => setShowEditModal(false)} className="bg-gray-600 text-white px-4 py-2 rounded">닫기</button></div></div>
             <div className="flex-1 overflow-y-auto p-8 bg-gray-50">
               <div ref={reportRef} contentEditable suppressContentEditableWarning className="bg-white p-12 max-w-[210mm] mx-auto shadow-lg min-h-[297mm] outline-none">
                  <h1 className="text-4xl font-serif font-bold text-center mb-10">천기누설 운명 감정서</h1>
                  <p className="text-center mb-10">{input.name} 님</p>
                  <div className="space-y-10">
                    <section>
                      <h2 className="text-2xl font-bold border-b-2 border-black mb-4">1. 사주 원국</h2>
                      {/* PDF Print Version of Grid */}
                      <div className="border border-gray-400">
                         <div className="bg-gray-100 p-2 font-bold border-b border-gray-400">
                           {input.name} ({sajuResult.koreanAge}세) - {input.gender === 'male' ? '남자' : '여자'}
                         </div>
                         <div className="grid grid-cols-4 text-center">
                           <div className="border-r border-gray-300 p-2"><div className="font-bold bg-gray-50 mb-2">시주</div><div className="text-2xl font-serif">{sajuResult.hourPillar.stem}{sajuResult.hourPillar.branch}</div></div>
                           <div className="border-r border-gray-300 p-2"><div className="font-bold bg-gray-50 mb-2">일주</div><div className="text-2xl font-serif">{sajuResult.dayPillar.stem}{sajuResult.dayPillar.branch}</div></div>
                           <div className="border-r border-gray-300 p-2"><div className="font-bold bg-gray-50 mb-2">월주</div><div className="text-2xl font-serif">{sajuResult.monthPillar.stem}{sajuResult.monthPillar.branch}</div></div>
                           <div className="p-2"><div className="font-bold bg-gray-50 mb-2">년주</div><div className="text-2xl font-serif">{sajuResult.yearPillar.stem}{sajuResult.yearPillar.branch}</div></div>
                         </div>
                      </div>
                    </section>
                    <section><h2 className="text-2xl font-bold border-b-2 border-black mb-4">2. 타고난 기질</h2><p className="text-justify">{sajuResult.dayMasterReading}</p></section>
                    <section><h2 className="text-2xl font-bold border-b-2 border-blue-600 mb-4">3. 건강 처방</h2><p className="text-justify whitespace-pre-line">{sajuResult.healthAnalysis.medicalAdvice}</p></section>
                    <section><h2 className="text-2xl font-bold border-b-2 border-red-600 mb-4">4. 2026년 총운</h2><p className="text-justify">{sajuResult.fortune2026.overall}</p></section>
                    <section><h2 className="text-2xl font-bold border-b-2 border-yellow-500 mb-4">5. 풍수 비책</h2><p className="text-justify whitespace-pre-line">{sajuResult.fengShuiThesis}</p></section>
                  </div>
               </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;