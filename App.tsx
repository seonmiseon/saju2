import React, { useState, useRef, useEffect } from 'react';
import { UserInput, SajuAnalysisResult, ChatMessage, CycleItem, Pillar } from './types';
import { analyzeSaju, consultSaju } from './services/geminiService';
import PillarCard from './components/PillarCard';
import LoadingSpinner from './components/LoadingSpinner';
// @ts-ignore
import html2canvas from "html2canvas";
// @ts-ignore
import jsPDF from "jspdf";

// Helper to deduce Element Color for Wonkwang Style
const getElementBgColor = (char: string) => {
  if ("甲乙寅卯".includes(char)) return "bg-green-100 text-green-900 border-green-200";
  if ("丙丁巳午".includes(char)) return "bg-red-100 text-red-900 border-red-200";
  if ("戊己辰戌丑未".includes(char)) return "bg-yellow-100 text-yellow-900 border-yellow-200";
  if ("庚辛申酉".includes(char)) return "bg-gray-100 text-gray-900 border-gray-300";
  if ("壬癸亥子".includes(char)) return "bg-blue-100 text-blue-900 border-blue-200";
  return "bg-white text-gray-900 border-gray-200";
};

// Detailed Cycle Table matching the request
const CycleTable: React.FC<{ title: string, data: CycleItem[], reversed?: boolean }> = ({ title, data, reversed = false }) => {
  // Safe reverse for display if needed
  const displayData = reversed ? [...data].reverse() : data;

  return (
    <div className="mb-8">
      <h4 className="font-serif font-bold text-lg mb-3 text-oriental-black border-l-4 border-oriental-gold pl-3">{title}</h4>
      <div className="w-full overflow-x-auto pb-4 scrollbar-thin">
        <div className="flex flex-row min-w-max gap-0.5">
          {displayData.map((item, idx) => (
            <div key={idx} className="flex flex-col items-center w-14 border border-gray-400 bg-gray-50 shrink-0">
               {/* Header (Age/Year) */}
              <div className="w-full bg-white text-[11px] text-center py-1 font-bold text-black border-b border-gray-300">
                {item.age}
              </div>
               {/* Ten God */}
               <div className="w-full bg-gray-100 text-[10px] text-center py-0.5 border-b border-gray-300 whitespace-nowrap overflow-hidden text-ellipsis px-0.5">
                {item.tenGod}
               </div>
              {/* Ganji */}
              <div className="flex flex-col items-center py-1 bg-white w-full">
                 <span className={`text-xl font-serif font-bold leading-none w-full text-center ${getElementBgColor(item.ganji.charAt(0)).split(' ')[1]}`}>{item.ganji.charAt(0)}</span>
                 <span className={`text-xl font-serif font-bold leading-none mt-1 w-full text-center ${getElementBgColor(item.ganji.charAt(1)).split(' ')[1]}`}>{item.ganji.charAt(1)}</span>
              </div>
              <span className="text-[10px] text-gray-500 pb-1">{item.ganjiKorean}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Specialized Wolwun Table to exactly match Wonkwang Style
const WolwunTable: React.FC<{ title: string, data: CycleItem[] }> = ({ title, data }) => {
  // CRITICAL FIX: Reverse the data array instead of using flex-row-reverse.
  // flex-row-reverse with overflow-x-auto often causes content to be clipped to the left and unreachable.
  // We want Descending Order (Future -> Past) from Left to Right.
  // The input 'data' is Ascending (2025.1 -> 2027.12).
  // So we reverse it -> [2027.12, ..., 2025.1].
  // Rendered L->R, this puts 2027 on Left, 2025 on Right.
  const displayData = [...data].reverse();

  return (
    <div className="mb-8">
      <h4 className="font-serif font-bold text-lg mb-3 text-oriental-black border-l-4 border-oriental-gold pl-3">{title}</h4>
      <div className="w-full overflow-x-auto pb-4 scrollbar-thin">
        <div className="flex flex-row min-w-max"> 
          {displayData.map((item, idx) => {
             const stemColorClass = getElementBgColor(item.ganji.charAt(0));
             const branchColorClass = getElementBgColor(item.ganji.charAt(1));

             return (
               <div key={idx} className="flex flex-col w-12 border-r border-t border-b border-gray-400 first:border-l bg-white shrink-0">
                  {/* 1. Header: Year.Month */}
                  <div className="text-[10px] font-bold text-center py-1 border-b border-gray-300 bg-white">
                    {item.age}
                  </div>
                  {/* 2. Ten God */}
                  <div className="text-[9px] text-center py-0.5 bg-gray-50 border-b border-gray-300 text-gray-700 whitespace-nowrap overflow-hidden">
                    {item.tenGod}
                  </div>
                  {/* 3. Ganji Vertical with Colors */}
                  <div className="flex flex-col items-center py-1 space-y-0.5 w-full flex-1 justify-center">
                    <div className={`w-full text-center py-0.5 ${stemColorClass}`}>
                       <span className="text-lg font-serif font-bold leading-none">{item.ganji.charAt(0)}</span>
                    </div>
                    <div className={`w-full text-center py-0.5 ${branchColorClass}`}>
                       <span className="text-lg font-serif font-bold leading-none">{item.ganji.charAt(1)}</span>
                    </div>
                  </div>
                  {/* 4. Korean Branch */}
                  <div className="text-[9px] text-center pb-1 text-gray-500 pt-1 border-t border-gray-100">
                    {item.ganjiKorean}
                  </div>
               </div>
             );
          })}
        </div>
      </div>
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

  // New State for API Key UI
  const [isKeySaved, setIsKeySaved] = useState(false);

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
      setIsKeySaved(true);
    }
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
      setChatMessages([{ id: 'init', role: 'model', text: `반갑네, ${input.name}. 자네의 사주를 깊이 들여다보니 ${missingText} 기운이 가장 시급하구려.` }]);
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
      const answer = await consultSaju(userMsg.text, sajuResult, apiHistory, input.apiKey);
      setChatMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'model', text: answer }]);
    } catch (error) {
      setChatMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: "도사님이 잠시 출타중이십니다.", isError: true }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 1.5, useCORS: true, backgroundColor: "#F7F5F0" });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = pdf.internal.pageSize.getWidth();
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdf.internal.pageSize.getHeight();
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdf.internal.pageSize.getHeight();
      }
      pdf.save(`${input.name}_천기누설_통합감정서.pdf`);
    } catch (err) { alert("PDF 다운로드 실패"); }
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
            
            {/* Custom API Key Section matching the requested design */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🔑</span>
                <span className="font-bold text-gray-700 text-sm">Gemini API Key</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="password"
                  name="apiKey"
                  value={input.apiKey}
                  onChange={handleApiKeyChange}
                  placeholder="•••••••••••••••••••••••••••"
                  className="flex-1 border border-gray-300 rounded p-2 text-sm focus:outline-none focus:border-oriental-gold tracking-widest h-10"
                />
                <button
                  type="button"
                  onClick={handleSaveKey}
                  className="bg-[#B93632] text-white font-bold px-4 rounded-md h-10 shadow-md hover:bg-red-800 transition-colors text-sm whitespace-nowrap"
                >
                  저장
                </button>
              </div>
              {isKeySaved && (
                <div className="text-green-500 text-xs mt-2 flex items-center font-bold">
                  <span className="mr-1">✔</span> 저장됨
                </div>
              )}
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
        <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-16 pb-32">
          
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

            {/* Cycle Tables */}
            <CycleTable title="대운 (大運 : 121세까지)" data={sajuResult.daewun} reversed={true} />
            <CycleTable title="세운 (歲運 : 121세까지)" data={sajuResult.saewun} reversed={true} />
            <WolwunTable title="월운 (月運 : 2025~2027)" data={sajuResult.wolwun} />
          </section>

          <section className="bg-white p-8 rounded-xl shadow-sm border-l-4 border-gray-800"><h2 className="text-2xl font-serif font-bold mb-6">2. 타고난 기질과 운명</h2><p className="leading-8 text-gray-800 text-justify whitespace-pre-line">{sajuResult.dayMasterReading}</p></section>
          
          <section className="bg-oriental-paper p-8 rounded-xl border border-oriental-gold shadow-md relative overflow-hidden">
            <h2 className="text-2xl font-serif font-bold mb-6 text-oriental-gold">3. 도사님의 개운 비책</h2>
            <div className="bg-white/80 p-6 rounded-lg mb-6 backdrop-blur-sm"><div className="text-center font-bold text-oriental-red text-xl mb-4">필요한 기운: {sajuResult.missingElements.map(m => m.element).join(', ')}</div><p className="leading-relaxed text-gray-800 text-center font-medium">{sajuResult.chaeumAdvice.summary}</p></div>
            <div className="grid grid-cols-3 gap-2 text-center text-sm"><div className="bg-white p-3 rounded shadow-sm"><div className="text-gray-500 mb-1">행운의 색</div><div className="font-bold">{sajuResult.chaeumAdvice.color}</div></div><div className="bg-white p-3 rounded shadow-sm"><div className="text-gray-500 mb-1">대박 방위</div><div className="font-bold">{sajuResult.chaeumAdvice.direction}</div></div><div className="bg-white p-3 rounded shadow-sm"><div className="text-gray-500 mb-1">개운 아이템</div><div className="font-bold">{sajuResult.chaeumAdvice.items}</div></div></div>
          </section>

          <section className="bg-blue-50 p-8 rounded-xl border border-blue-100 shadow-sm">
            <h2 className="text-2xl font-serif font-bold mb-6 text-blue-900">4. 맞춤형 건강 처방 (전문의학박사)</h2>
            <div className="space-y-6">
              <div className="bg-white p-5 rounded-lg border-l-4 border-blue-500 shadow-sm"><h3 className="font-bold text-lg mb-2 text-gray-800">취약 장기 및 증상</h3><p className="text-gray-600 mb-2">⚠️ {sajuResult.healthAnalysis.weakOrgans}</p><p className="text-sm">{sajuResult.healthAnalysis.symptoms}</p></div>
              <div className="bg-white p-5 rounded-lg shadow-sm"><h3 className="font-bold text-lg mb-2 text-gray-800">전문의 상세 처방</h3><p className="text-justify whitespace-pre-line">{sajuResult.healthAnalysis.medicalAdvice}</p></div>
              <div className="bg-green-50 p-5 rounded-lg border border-green-100"><h3 className="font-bold text-lg mb-2 text-green-800">🥗 식이요법</h3><p className="text-sm">{sajuResult.healthAnalysis.foodRecommendation}</p></div>
            </div>
          </section>

          <section><h2 className="text-2xl font-serif font-bold mb-6 border-b-2 border-red-500 inline-block">5. 2026년 대박 총운</h2><div className="bg-white p-8 rounded-xl shadow-lg border-t-4 border-red-500"><p className="text-lg leading-8 text-gray-800 text-justify mb-8 font-medium">{sajuResult.fortune2026.overall}</p><div className="grid grid-cols-1 md:grid-cols-2 gap-6">{['wealth', 'career', 'love', 'health'].map(k => <div key={k} className="bg-gray-50 p-4 rounded-lg"><p className="text-sm text-gray-600 text-justify">{sajuResult.fortune2026[k as keyof typeof sajuResult.fortune2026]}</p></div>)}</div></div></section>

          <section className="bg-gray-900 text-gray-100 p-8 rounded-xl shadow-2xl"><h2 className="text-2xl font-serif font-bold mb-6 text-yellow-500">6. 귀인과 길일 (풍수지리)</h2><div className="mb-8"><table className="w-full text-sm text-left text-gray-300"><thead className="text-xs text-gray-400 uppercase bg-gray-800"><tr><th className="px-4 py-3">날짜</th><th className="px-4 py-3">시간</th><th className="px-4 py-3">방위</th></tr></thead><tbody className="divide-y divide-gray-700">{sajuResult.luckyTable.map((row, index) => <tr key={index}><td className="px-4 py-3 text-yellow-400 font-bold">{row.date}</td><td className="px-4 py-3">{row.time}</td><td className="px-4 py-3 text-blue-400">{row.direction}</td></tr>)}</tbody></table></div><div className="prose prose-invert max-w-none text-justify text-sm opacity-90"><h4 className="font-bold text-yellow-500 mb-2">풍수학적 분석</h4><p className="whitespace-pre-line">{sajuResult.fengShuiThesis}</p></div></section>

          <section className="bg-white rounded-xl shadow-lg border-2 border-oriental-black overflow-hidden flex flex-col h-[600px]">
            <div className="bg-oriental-black text-white p-4"><h3 className="font-serif font-bold text-xl">🔮 천기도사님 親見室</h3></div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">{chatMessages.filter(m => m.id !== 'init').map(msg => <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[85%] px-5 py-4 rounded-2xl text-sm whitespace-pre-wrap ${msg.role === 'user' ? 'bg-oriental-black text-white' : 'bg-white border border-gray-200'}`}>{msg.text}</div></div>)}<div ref={chatEndRef} /></div>
            <form onSubmit={handleChatSubmit} className="p-3 border-t bg-white flex space-x-2"><input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="질문을 입력하세요..." className="flex-1 px-4 py-2 border rounded-full" disabled={isChatLoading} /><button type="submit" className="bg-oriental-black text-white w-10 h-10 rounded-full flex items-center justify-center">➤</button></form>
          </section>

          <div className="flex justify-center pb-10"><button onClick={() => setShowEditModal(true)} className="bg-oriental-gold text-white px-10 py-5 rounded-full shadow-xl text-xl font-serif font-bold hover:bg-yellow-600">📄 다운로드 / 편집</button></div>
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