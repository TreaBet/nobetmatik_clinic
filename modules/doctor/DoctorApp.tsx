
import React, { useState, useEffect, useCallback } from 'react';
import { Scheduler } from './scheduler';
import { readStaffFromExcel, generateTemplate } from '../../services/excelService';
import { exportToExcel } from './services/reportService';
import { exportToJSON, importFromJSON, AppData } from '../../services/backupService';
import { generateShareLink, parseShareLink } from '../../services/shareService';
import { Staff, Service, RoleConfig, ScheduleResult, DaySchedule } from '../../types';
import { ICONS, MOCK_STAFF, MOCK_SERVICES } from '../../constants';
import { Card, Button, DateSelectModal } from '../../components/ui';
import { Moon, Sun, Zap, Sparkles, Activity, Dna, ArrowLeft, Calendar as CalendarIcon, History, Check, Copy, X } from 'lucide-react';
import { StaffManager } from './components/StaffManager'; 
import { ServiceManager } from './components/ServiceManager'; 
import { ScheduleViewer } from './components/ScheduleViewer'; 
import { HistoryManager } from '../../components/HistoryManager';
import { DBService } from '../../services/db';

interface DoctorAppProps {
    onBack: () => void;
}

export default function DoctorApp({ onBack }: DoctorAppProps) {
  const [activeTab, setActiveTab] = useState<'staff' | 'services' | 'generate' | 'history'>('staff');
  const [staff, setStaff] = useState<Staff[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [roleConfigs, setRoleConfigs] = useState<Record<number, RoleConfig>>({});
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());
  const [randomizeDays, setRandomizeDays] = useState(true);
  const [preventEveryOther, setPreventEveryOther] = useState(true);
  const [holidays, setHolidays] = useState<number[]>([]);
  const [useFatigueModel, setUseFatigueModel] = useState(false);
  const [useGeneticAlgorithm, setUseGeneticAlgorithm] = useState(false);
  const [isBlackAndWhite, setIsBlackAndWhite] = useState(false);
  const [previousSchedule, setPreviousSchedule] = useState<DaySchedule[] | null>(null);
  const [result, setResult] = useState<ScheduleResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true); 
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);

  const MODE = 'doctor';

  useEffect(() => {
      const shareData = parseShareLink();
      if (shareData) {
          setIsReadOnly(true);
          setStaff(shareData.staff);
          setServices(shareData.services);
          setResult(shareData.result);
          setMonth(shareData.month);
          setYear(shareData.year);
          setActiveTab('generate');
          setDataLoading(false);
          return;
      }

      Promise.all([
          DBService.getStaff(MODE),
          DBService.getServices(MODE),
          DBService.getConfig(MODE)
      ]).then(([fetchedStaff, fetchedServices, fetchedConfig]) => {
          if (fetchedStaff) setStaff(fetchedStaff);
          else setStaff(MOCK_STAFF as unknown as Staff[]); 

          if (fetchedServices) setServices(fetchedServices);
          else setServices(MOCK_SERVICES as unknown as Service[]);

          if (fetchedConfig) {
              if (fetchedConfig.roleConfigs) setRoleConfigs(fetchedConfig.roleConfigs);
              if (fetchedConfig.month !== undefined) setMonth(fetchedConfig.month);
              if (fetchedConfig.year !== undefined) setYear(fetchedConfig.year);
              if (fetchedConfig.holidays) setHolidays(fetchedConfig.holidays);
              setRandomizeDays(fetchedConfig.randomizeDays ?? true);
              setPreventEveryOther(fetchedConfig.preventEveryOther ?? true);
              setUseFatigueModel(fetchedConfig.useFatigueModel ?? false);
              setUseGeneticAlgorithm(fetchedConfig.useGeneticAlgorithm ?? false);
              setIsBlackAndWhite(fetchedConfig.isBlackAndWhite ?? false);
          }
          setDataLoading(false);
      });
  }, []);

  useEffect(() => {
      if (!isReadOnly) {
          DBService.getPreviousMonthSchedule(MODE, year, month)
            .then(schedule => {
                setPreviousSchedule(schedule || null);
            });
      }
  }, [year, month, isReadOnly]);

  useEffect(() => { if (!isReadOnly && !dataLoading) DBService.saveStaff(MODE, staff); }, [staff, isReadOnly, dataLoading]);
  useEffect(() => { if (!isReadOnly && !dataLoading) DBService.saveServices(MODE, services); }, [services, isReadOnly, dataLoading]);
  useEffect(() => {
      if (!isReadOnly && !dataLoading) {
          DBService.saveConfig(MODE, {
              roleConfigs, month, year, randomizeDays, preventEveryOther, holidays, useFatigueModel, useGeneticAlgorithm, isBlackAndWhite
          });
      }
  }, [roleConfigs, month, year, randomizeDays, preventEveryOther, holidays, useFatigueModel, useGeneticAlgorithm, isBlackAndWhite, isReadOnly, dataLoading]);

  useEffect(() => {
    if (isBlackAndWhite) {
      document.body.style.backgroundColor = '#020617';
      document.documentElement.classList.add('high-contrast');
    } else {
      document.body.style.backgroundColor = '#f3f4f6';
      document.documentElement.classList.remove('high-contrast');
    }
  }, [isBlackAndWhite]);

  const handleResetData = () => {
      if (window.confirm("Tüm veriler varsayılan verilere dönecek. Emin misiniz?")) {
          setStaff(MOCK_STAFF as unknown as Staff[]);
          setServices(MOCK_SERVICES as unknown as Service[]);
      }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          try {
              const importedStaff = await readStaffFromExcel(e.target.files[0]);
              setStaff(importedStaff);
              alert(`${importedStaff.length} personel yüklendi.`);
          } catch (error) {
              alert('Dosya okunurken hata oluştu.');
          }
      }
  };

  const getAppData = useCallback((): AppData => {
      return {
          version: "2.1",
          timestamp: new Date().toISOString(),
          staff,
          services,
          roleConfigs,
          config: {
              month, year, randomizeDays, preventEveryOther, holidays, useFatigueModel, useGeneticAlgorithm
          }
      };
  }, [staff, services, roleConfigs, month, year, randomizeDays, preventEveryOther, holidays, useFatigueModel, useGeneticAlgorithm]);

  const restoreAppData = useCallback((data: AppData) => {
      setStaff(data.staff);
      setServices(data.services);
      setRoleConfigs(data.roleConfigs);
      if (data.config) {
          setMonth(data.config.month);
          setYear(data.config.year);
          setRandomizeDays(data.config.randomizeDays);
          setPreventEveryOther(data.config.preventEveryOther);
          if (data.config.holidays) setHolidays(data.config.holidays);
          if (data.config.useFatigueModel !== undefined) setUseFatigueModel(data.config.useFatigueModel);
          if (data.config.useGeneticAlgorithm !== undefined) setUseGeneticAlgorithm(data.config.useGeneticAlgorithm);
      }
  }, []);

  const handleExportBackup = () => {
      const data = getAppData();
      // Pass undefined for Nurse extras
      exportToJSON(data.staff, data.services, data.roleConfigs, data.config);
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          try {
              const data = await importFromJSON(e.target.files[0]);
              if (window.confirm(`Yedek dosyası yüklenecek:\nSürüm: ${data.version}\nTarih: ${new Date(data.timestamp).toLocaleString()}\n\nMevcut veriler silinecek. Onaylıyor musunuz?`)) {
                  restoreAppData(data);
                  alert("Yedek başarıyla yüklendi.");
              }
          } catch (error) {
              console.error(error);
              alert('Yedek dosyası bozuk veya okunamadı.');
          }
          e.target.value = ''; 
      }
  };

  const handleGenerate = async () => {
    setLoading(true);
    setResult(null);
    setTimeout(() => {
      try {
        const scheduler = new Scheduler(staff, services, {
          year, month, maxRetries: 1000, 
          randomizeOrder: randomizeDays, 
          preventEveryOtherDay: preventEveryOther, 
          holidays,
          useFatigueModel,
          useGeneticAlgorithm
        }, previousSchedule);

        const res = scheduler.generate();
        setResult(res);
      } catch (e) {
        console.error(e);
        alert("Çizelge oluşturulamadı. Lütfen kısıtlamaları kontrol edin.");
      } finally {
        setLoading(false);
      }
    }, 100);
  };

  const handleArchiveMonth = async () => {
      if (!result) return;
      if (window.confirm(`${year} - ${month + 1}. Ay çizelgesini geçmişe kaydetmek istiyor musunuz?`)) {
          await DBService.archiveSchedule(MODE, year, month, result);
          alert("Çizelge başarıyla arşivlendi.");
      }
  };

  const handleCreateShareLink = () => {
      if (!result) return;
      const link = generateShareLink(result, services, staff, year, month);
      setShareLink(link);
  };

  const handleLoadHistory = (hYear: number, hMonth: number) => {
     DBService.getHistory(MODE).then(histList => {
         const target = histList.find(h => h.year === hYear && h.month === hMonth);
         if (target) {
             setYear(hYear);
             setMonth(hMonth);
             setResult({
                 schedule: target.schedule,
                 stats: target.stats || [],
                 unfilledSlots: 0,
                 logs: []
             });
             setActiveTab('generate');
             alert(`Geçmiş kayıt (${hYear}-${hMonth + 1}) yüklendi.`);
         }
     });
  };

  if (dataLoading) {
      return (
          <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
              <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="animate-pulse">Sistem Yükleniyor...</p>
          </div>
      );
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return (
    <div className={`min-h-screen font-sans pb-20 transition-all duration-300 ${isBlackAndWhite ? 'bg-slate-950 text-slate-100 high-contrast' : 'bg-gray-100 text-gray-800'}`}>
      
      <header className={`sticky top-0 z-30 mb-6 ${isBlackAndWhite ? '!bg-slate-900 !border-b border-slate-800 text-white' : 'bg-white border-b border-gray-200 shadow-sm'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center py-4 gap-4">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <Button variant="ghost" onClick={onBack} className={isBlackAndWhite ? 'text-white hover:bg-slate-800' : 'text-gray-600'}>
                  <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className={`p-2 rounded-xl shrink-0 ${isBlackAndWhite ? 'bg-white text-black' : 'bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-500/30'}`}>
                {ICONS.Shield}
              </div>
              <div className={isBlackAndWhite ? 'text-white' : ''}>
                <h1 className="text-xl font-bold leading-none tracking-tight">Nöbetmatik</h1>
                <span className={`text-xs font-bold tracking-wider uppercase ${isBlackAndWhite ? 'text-slate-400' : 'text-indigo-600'}`}>Doktor Modülü</span>
              </div>
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
              {!isReadOnly && (
                  <nav className={`flex p-1 rounded-xl shrink-0 ${isBlackAndWhite ? '!bg-slate-800' : 'bg-gray-100 border border-gray-200'}`}>
                    {(['staff', 'services', 'generate', 'history'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-3 md:px-5 py-2 rounded-lg text-sm font-bold transition-all duration-200 whitespace-nowrap hover-lift ${
                          activeTab === tab 
                            ? (isBlackAndWhite ? 'bg-slate-600 text-white shadow' : 'bg-white text-indigo-700 shadow-sm ring-1 ring-gray-200') 
                            : (isBlackAndWhite ? 'text-slate-400 hover:text-white' : 'text-gray-500 hover:text-gray-800')
                        }`}
                      >
                         {tab === 'staff' && <span className="flex items-center gap-2">{ICONS.Users} Personel</span>}
                         {tab === 'services' && <span className="flex items-center gap-2">{ICONS.Settings} Servisler</span>}
                         {tab === 'generate' && <span className="flex items-center gap-2">{ICONS.Calendar} Çizelge</span>}
                         {tab === 'history' && <span className="flex items-center gap-2"><History className="w-4 h-4"/> Geçmiş</span>}
                      </button>
                    ))}
                  </nav>
              )}
              
              <button onClick={() => setIsBlackAndWhite(!isBlackAndWhite)} className={`p-2 rounded-lg transition-colors shrink-0 ${isBlackAndWhite ? 'bg-slate-800 text-yellow-300 hover:bg-slate-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {isBlackAndWhite ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {!isReadOnly && activeTab === 'staff' && (
             <StaffManager 
                staff={staff} 
                setStaff={setStaff} 
                roleConfigs={roleConfigs} 
                setRoleConfigs={setRoleConfigs} 
                handleResetData={handleResetData}
                handleFileUpload={handleFileUpload}
                generateTemplate={generateTemplate}
                handleImportBackup={handleImportBackup}
                handleExportBackup={handleExportBackup}
                isBlackAndWhite={isBlackAndWhite}
                daysInMonth={daysInMonth}
             />
        )}

        {!isReadOnly && activeTab === 'services' && (
             <ServiceManager 
                services={services} 
                setServices={setServices} 
                staff={staff} 
                isBlackAndWhite={isBlackAndWhite}
             />
        )}

        {!isReadOnly && activeTab === 'history' && (
            <HistoryManager 
                onLoad={handleLoadHistory}
                isBlackAndWhite={isBlackAndWhite}
                mode={MODE}
            />
        )}

        {(activeTab === 'generate' || isReadOnly) && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {!isReadOnly && (
                    <Card className={`p-6 border-l-4 transition-colors hover-lift ${isBlackAndWhite ? '!bg-slate-900 !border-slate-800 border-l-indigo-500' : 'border-l-indigo-500'}`}>
                        <div className="flex flex-col gap-6">
                            <div className="flex flex-col lg:flex-row gap-6 items-end">
                                <div className="flex-1 w-full grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="space-y-1">
                                        <label className={`block text-xs font-bold uppercase tracking-wide ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>Ay</label>
                                        <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))} className={`w-full rounded-lg shadow-sm p-2.5 border focus:ring-2 focus:ring-indigo-500 outline-none ${isBlackAndWhite ? '!bg-slate-800 !border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}>
                                            {['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'].map((m, i) => (
                                                <option key={i} value={i}>{m}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className={`block text-xs font-bold uppercase tracking-wide ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>Yıl</label>
                                        <input type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value))} className={`w-full rounded-lg shadow-sm p-2.5 border focus:ring-2 focus:ring-indigo-500 outline-none ${isBlackAndWhite ? '!bg-slate-800 !border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`} />
                                    </div>
                                    <div className="space-y-1 flex flex-col justify-end">
                                        <Button variant="secondary" onClick={() => setShowHolidayModal(true)} className={`w-full text-xs h-[42px] ${isBlackAndWhite ? '!bg-slate-800 !text-white !border-slate-700 hover:!bg-slate-700 hover:!text-white' : ''}`}>
                                            <CalendarIcon className="w-4 h-4 text-red-500" /> 
                                            {holidays.length > 0 ? `${holidays.length} Tatil Seçili` : 'Tatilleri Seç'}
                                        </Button>
                                    </div>
                                    <div className="space-y-1 flex flex-col justify-end h-full gap-2 mt-auto pb-0.5 col-span-2 md:col-span-1">
                                         <div className={`flex items-center gap-2 p-1.5 rounded-lg border w-full flex-1 ${isBlackAndWhite ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
                                             <input type="checkbox" id="chkRandom" checked={randomizeDays} onChange={e => setRandomizeDays(e.target.checked)} className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer" />
                                             <label htmlFor="chkRandom" className={`text-[10px] md:text-xs font-bold cursor-pointer select-none ${isBlackAndWhite ? 'text-gray-300' : 'text-gray-600'}`}>Rastgele Dağıt</label>
                                         </div>
                                         <div className={`flex items-center gap-2 p-1.5 rounded-lg border w-full flex-1 ${isBlackAndWhite ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
                                             <input type="checkbox" id="chkEveryOther" checked={preventEveryOther} onChange={e => setPreventEveryOther(e.target.checked)} className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer" />
                                             <label htmlFor="chkEveryOther" className={`text-[10px] md:text-xs font-bold cursor-pointer select-none ${isBlackAndWhite ? 'text-gray-300' : 'text-gray-600'}`}>Günaşırı Önle</label>
                                         </div>
                                    </div>
                                </div>
                                <Button 
                                    onClick={handleGenerate} 
                                    disabled={loading} 
                                    className={`w-full lg:w-48 h-[100px] lg:h-auto self-stretch relative overflow-hidden group hover-lift ${isBlackAndWhite ? '!bg-indigo-600 !border-indigo-500' : ''}`}
                                >
                                    {loading ? (
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                                            <span className="text-xs">
                                                {useGeneticAlgorithm ? 'Evrimleşiyor...' : 'Simülasyon...'}
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-1">
                                            <Zap className="w-6 h-6 group-hover:scale-110 transition-transform" />
                                            <span>Çizelge Oluştur</span>
                                        </div>
                                    )}
                                </Button>
                            </div>

                            <div className={`pt-4 border-t ${isBlackAndWhite ? 'border-slate-800' : 'border-gray-100'}`}>
                                <h4 className={`text-xs font-bold uppercase mb-3 flex items-center gap-2 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-400'}`}>
                                    <Sparkles className="w-3.5 h-3.5" /> Gelişmiş Özellikler (İsteğe Bağlı)
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${useFatigueModel ? (isBlackAndWhite ? 'bg-indigo-900/30 border-indigo-500/50' : 'bg-indigo-50 border-indigo-200 shadow-sm') : (isBlackAndWhite ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-gray-200 grayscale opacity-80')}`} onClick={() => setUseFatigueModel(!useFatigueModel)}>
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-full ${useFatigueModel ? 'bg-indigo-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                                                <Activity className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <span className={`block text-sm font-bold ${isBlackAndWhite ? 'text-gray-200' : 'text-gray-700'}`}>Yorgunluk Modeli</span>
                                                <span className="text-[11px] opacity-60">Stres seviyesine göre akıllı dağıtım</span>
                                            </div>
                                        </div>
                                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${useFatigueModel ? 'bg-indigo-500 border-indigo-500' : 'border-gray-400'}`}>
                                            {useFatigueModel && <Check className="w-3 h-3 text-white" />}
                                        </div>
                                    </div>
                                    
                                    <div className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${useGeneticAlgorithm ? (isBlackAndWhite ? 'bg-purple-900/30 border-purple-500/50' : 'bg-purple-50 border-purple-200 shadow-sm') : (isBlackAndWhite ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-gray-200 grayscale opacity-80')}`} onClick={() => setUseGeneticAlgorithm(!useGeneticAlgorithm)}>
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-full ${useGeneticAlgorithm ? 'bg-purple-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                                                <Dna className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <span className={`block text-sm font-bold ${isBlackAndWhite ? 'text-gray-200' : 'text-gray-700'}`}>Genetik Algoritma (Beta)</span>
                                                <span className="text-[11px] opacity-60">Evrimsel yöntemle en iyi sonucu arar</span>
                                            </div>
                                        </div>
                                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${useGeneticAlgorithm ? 'bg-purple-500 border-purple-500' : 'border-gray-400'}`}>
                                            {useGeneticAlgorithm && <Check className="w-3 h-3 text-white" />}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>
                )}
                
                <DateSelectModal 
                    isOpen={showHolidayModal}
                    onClose={() => setShowHolidayModal(false)}
                    title="Resmi Tatil Günlerini Seçin"
                    selectedDays={holidays}
                    onSave={setHolidays}
                    daysInMonth={daysInMonth}
                    color="red"
                />

                {result && (
                    <div className="relative group">
                         {!isReadOnly && (
                            <div className="flex justify-end mb-2">
                                <Button variant="secondary" onClick={handleArchiveMonth} className={`text-xs ${isBlackAndWhite ? '!bg-slate-800 !text-white !border-slate-700 hover:!bg-slate-700' : ''}`}>
                                    <History className="w-4 h-4 mr-2" /> Bu Ayı Geçmişe Kaydet
                                </Button>
                            </div>
                         )}
                        <ScheduleViewer 
                            result={result} 
                            setResult={setResult}
                            services={services} 
                            staff={staff} 
                            year={year} 
                            month={month}
                            isBlackAndWhite={isBlackAndWhite}
                            handleDownload={() => exportToExcel(result, services, year, month, staff)}
                            isReadOnly={isReadOnly}
                            onShare={!isReadOnly ? handleCreateShareLink : undefined}
                        />
                    </div>
                )}
            </div>
        )}
      </main>

      {shareLink && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
              <div className={`p-6 rounded-2xl shadow-xl w-full max-w-lg ${isBlackAndWhite ? 'bg-slate-900 border border-slate-700' : 'bg-white'}`}>
                  <div className="flex justify-between items-center mb-4">
                      <h3 className={`font-bold text-lg ${isBlackAndWhite ? 'text-white' : 'text-gray-900'}`}>Paylaşım Linki Oluşturuldu</h3>
                      <button onClick={() => setShareLink(null)} className="p-1 rounded hover:bg-black/10"><X className="w-5 h-5 text-gray-500" /></button>
                  </div>
                  <div className={`p-3 rounded-lg mb-4 flex gap-2 items-center break-all text-sm font-mono border ${isBlackAndWhite ? 'bg-slate-950 border-slate-800 text-indigo-300' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                      {shareLink}
                  </div>
                  <div className="flex justify-end gap-2">
                      <Button variant="secondary" onClick={() => navigator.clipboard.writeText(shareLink).then(() => alert("Link kopyalandı!"))} className={`text-xs ${isBlackAndWhite ? '!bg-slate-800 !text-white !border-slate-700' : ''}`}>
                          <Copy className="w-4 h-4 mr-2" /> Kopyala
                      </Button>
                      <Button onClick={() => setShareLink(null)} className={`text-xs ${isBlackAndWhite ? '!bg-indigo-600 !border-indigo-500' : ''}`}>Tamam</Button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
