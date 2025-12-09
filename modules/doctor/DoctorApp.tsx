
import React, { useState, useEffect, useCallback } from 'react';
import { Scheduler } from './scheduler';
import { readStaffFromExcel, generateTemplate } from '../../services/excelService';
import { exportToExcel } from './services/reportService';
import { exportToJSON, importFromJSON, AppData } from '../../services/backupService';
import { generateShareLink, parseShareLink } from '../../services/shareService';
import { Staff, Service, RoleConfig, ScheduleResult, DaySchedule } from '../../types';
import { ICONS, MOCK_STAFF, MOCK_SERVICES } from '../../constants';
import { Card, Button, DateSelectModal } from '../../components/ui';
import { Moon, Sun, Zap, Sparkles, Activity, Dna, ArrowLeft, Calendar as CalendarIcon, History, Check, Copy, X, Info, BookOpen, MousePointerClick, Settings2, Users, ShieldCheck } from 'lucide-react';
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
  
  // Info Modal State
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoTab, setInfoTab] = useState<'about' | 'manual'>('manual');

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
      
      <nav className={`sticky top-0 z-40 backdrop-blur-md border-b transition-colors duration-500 ${isBlackAndWhite ? 'bg-slate-950/80 border-slate-800' : 'bg-white/80 border-gray-200 shadow-sm'}`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16 items-center">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" onClick={onBack} className={isBlackAndWhite ? 'text-white hover:bg-slate-800' : 'text-gray-600'}>
                             <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <div className={`p-2 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-600 shadow-lg shadow-indigo-500/30`}>
                             <ShieldCheck className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className={`text-xl font-bold tracking-tight ${isBlackAndWhite ? 'text-white' : 'text-slate-900'}`}>Nöbetmatik</h1>
                            <p className={`text-[10px] font-bold uppercase tracking-widest ${isBlackAndWhite ? 'text-indigo-400' : 'text-indigo-600'}`}>HEKİM MODÜLÜ</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                         <button onClick={() => setIsBlackAndWhite(!isBlackAndWhite)} className={`p-2 rounded-full transition-colors ${isBlackAndWhite ? 'bg-slate-800 text-yellow-400 hover:bg-slate-700' : 'bg-gray-100 text-slate-600 hover:bg-gray-200'}`} title={isBlackAndWhite ? "Aydınlık Mod" : "Karanlık Mod"}>
                            {isBlackAndWhite ? <Sun className="w-5 h-5"/> : <Moon className="w-5 h-5"/>}
                         </button>
                         <button onClick={() => setShowInfoModal(true)} className={`p-2 rounded-full transition-colors ${isBlackAndWhite ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-gray-100 text-slate-600 hover:bg-gray-200'}`}>
                            <Info className="w-5 h-5" />
                         </button>
                    </div>
                </div>
            </div>
            {!isReadOnly && (
                <div className={`border-t ${isBlackAndWhite ? 'border-slate-800' : 'border-gray-100'}`}>
                    <div className="max-w-7xl mx-auto px-4 flex gap-1 overflow-x-auto custom-scrollbar">
                         <button onClick={() => setActiveTab('staff')} className={`py-3 px-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'staff' ? (isBlackAndWhite ? 'border-indigo-500 text-indigo-400' : 'border-indigo-600 text-indigo-600') : (isBlackAndWhite ? 'border-transparent text-slate-400 hover:text-white' : 'border-transparent text-gray-500 hover:text-gray-700')}`}>
                            <Users className="w-4 h-4" /> Personel
                         </button>
                         <button onClick={() => setActiveTab('services')} className={`py-3 px-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'services' ? (isBlackAndWhite ? 'border-indigo-500 text-indigo-400' : 'border-indigo-600 text-indigo-600') : (isBlackAndWhite ? 'border-transparent text-slate-400 hover:text-white' : 'border-transparent text-gray-500 hover:text-gray-700')}`}>
                             <Settings2 className="w-4 h-4" /> Servisler
                         </button>
                         <button onClick={() => setActiveTab('generate')} className={`py-3 px-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'generate' ? (isBlackAndWhite ? 'border-indigo-500 text-indigo-400' : 'border-indigo-600 text-indigo-600') : (isBlackAndWhite ? 'border-transparent text-slate-400 hover:text-white' : 'border-transparent text-gray-500 hover:text-gray-700')}`}>
                             <CalendarIcon className="w-4 h-4" /> Çizelge
                         </button>
                         <button onClick={() => setActiveTab('history')} className={`py-3 px-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'history' ? (isBlackAndWhite ? 'border-indigo-500 text-indigo-400' : 'border-indigo-600 text-indigo-600') : (isBlackAndWhite ? 'border-transparent text-slate-400 hover:text-white' : 'border-transparent text-gray-500 hover:text-gray-700')}`}>
                             <History className="w-4 h-4" /> Geçmiş
                         </button>
                    </div>
                </div>
            )}
        </nav>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        
        {activeTab === 'staff' && (
            <StaffManager 
                staff={staff} setStaff={setStaff}
                roleConfigs={roleConfigs} setRoleConfigs={setRoleConfigs}
                handleResetData={handleResetData}
                handleFileUpload={handleFileUpload}
                generateTemplate={generateTemplate}
                handleImportBackup={handleImportBackup}
                handleExportBackup={handleExportBackup}
                isBlackAndWhite={isBlackAndWhite}
                daysInMonth={daysInMonth}
            />
        )}

        {activeTab === 'services' && (
            <ServiceManager 
                services={services} setServices={setServices}
                staff={staff}
                isBlackAndWhite={isBlackAndWhite}
            />
        )}

        {activeTab === 'generate' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Card className={`p-6 border-l-4 transition-colors hover-lift ${isBlackAndWhite ? '!bg-slate-900 !border-slate-800 border-l-indigo-500' : 'border-l-indigo-500'}`}>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                        <div>
                            <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>AY</label>
                            <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className={`w-full rounded-lg shadow-sm p-2.5 border outline-none ${isBlackAndWhite ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}>
                                {Array.from({length: 12}, (_, i) => i).map(m => (
                                    <option key={m} value={m}>{new Date(2024, m).toLocaleString('tr-TR', { month: 'long' })}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>YIL</label>
                            <input type="number" value={year} onChange={e => setYear(parseInt(e.target.value))} className={`w-full rounded-lg shadow-sm p-2.5 border outline-none ${isBlackAndWhite ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`} />
                        </div>
                        
                        <div className="flex flex-col gap-2 pb-1">
                             <label className={`flex items-center gap-2 cursor-pointer text-sm font-medium ${isBlackAndWhite ? 'text-gray-300' : 'text-gray-700'}`}>
                                <input type="checkbox" checked={randomizeDays} onChange={e => setRandomizeDays(e.target.checked)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                <span>Rastgele Sıra</span>
                             </label>
                             <label className={`flex items-center gap-2 cursor-pointer text-sm font-medium ${isBlackAndWhite ? 'text-gray-300' : 'text-gray-700'}`}>
                                <input type="checkbox" checked={preventEveryOther} onChange={e => setPreventEveryOther(e.target.checked)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                <span>Gün Aşırı Engelle</span>
                             </label>
                        </div>

                        <div className="flex gap-2">
                            <Button onClick={() => setShowHolidayModal(true)} variant="secondary" className={`flex-1 h-[42px] ${isBlackAndWhite ? '!bg-slate-800 !text-white !border-slate-700' : ''}`}>
                                Tatiller ({holidays.length})
                            </Button>
                            <Button onClick={handleGenerate} disabled={loading} className={`flex-1 h-[42px] ${isBlackAndWhite ? '!bg-indigo-600 !border-indigo-500' : ''}`}>
                                {loading ? '...' : 'Oluştur'}
                            </Button>
                        </div>
                    </div>
                </Card>

                {loading && (
                     <div className="py-20 text-center animate-pulse">
                        <div className={`text-5xl mb-4 font-bold ${isBlackAndWhite ? 'text-indigo-400' : 'text-indigo-600'}`}>...</div>
                        <h3 className={`text-xl font-bold ${isBlackAndWhite ? 'text-white' : 'text-gray-800'}`}>Hesaplanıyor</h3>
                        <p className={isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}>Monte Carlo simülasyonu çalışıyor.</p>
                     </div>
                )}

                {!loading && result && (
                    <>
                        <div className="flex justify-end mb-2">
                             <Button variant="ghost" onClick={handleArchiveMonth} className={`text-xs ${isBlackAndWhite ? 'text-gray-400 hover:text-white' : 'text-gray-500'}`}>
                                 <History className="w-3.5 h-3.5 mr-1"/> Bu ayı arşive kaydet
                             </Button>
                        </div>
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
                            onShare={handleCreateShareLink}
                        />
                    </>
                )}
            </div>
        )}

        {activeTab === 'history' && (
            <HistoryManager 
                mode={MODE}
                isBlackAndWhite={isBlackAndWhite}
                onLoad={handleLoadHistory}
            />
        )}
      </main>

      {/* Holiday Modal */}
      {showHolidayModal && (
          <DateSelectModal 
              isOpen={showHolidayModal}
              onClose={() => setShowHolidayModal(false)}
              title="Resmi Tatil Günleri"
              selectedDays={holidays}
              onSave={setHolidays}
              daysInMonth={daysInMonth}
              color="red"
          />
      )}

        {showInfoModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                <div className={`rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden animate-scale-in flex flex-col max-h-[85vh] ${isBlackAndWhite ? 'bg-slate-900 border border-slate-700 text-white' : 'bg-white'}`}>
                    <div className={`p-4 border-b flex justify-between items-center shrink-0 ${isBlackAndWhite ? 'bg-slate-950 border-slate-800' : 'bg-gray-50 border-gray-100'}`}>
                        <div className="flex gap-4">
                            <button onClick={() => setInfoTab('manual')} className={`text-sm font-bold pb-1 border-b-2 transition-colors ${infoTab === 'manual' ? (isBlackAndWhite ? 'border-indigo-500 text-indigo-400' : 'border-indigo-600 text-indigo-600') : 'border-transparent text-gray-400'}`}>
                                <BookOpen className="inline w-4 h-4 mr-1"/> Kullanma Kılavuzu
                            </button>
                            <button onClick={() => setInfoTab('about')} className={`text-sm font-bold pb-1 border-b-2 transition-colors ${infoTab === 'about' ? (isBlackAndWhite ? 'border-indigo-500 text-indigo-400' : 'border-indigo-600 text-indigo-600') : 'border-transparent text-gray-400'}`}>
                                <Info className="inline w-4 h-4 mr-1"/> Hakkında
                            </button>
                        </div>
                        <button onClick={() => setShowInfoModal(false)} className="p-1 rounded-full hover:bg-black/10"><X className="w-5 h-5" /></button>
                    </div>
                    
                    <div className="p-6 overflow-y-auto custom-scrollbar">
                        {infoTab === 'about' ? (
                            <div className="space-y-4">
                                <h3 className="font-bold text-lg text-indigo-500">Nöbetmatik Enterprise (Hekim Modülü)</h3>
                                <p className={isBlackAndWhite ? 'text-gray-300' : 'text-gray-600'}>
                                    Bu modül, kıdem ve grup öncelikli çalışan doktorlar için optimize edilmiştir.
                                    Servis öncelikleri, acil servis kotaları ve hafta sonu limitlerini dikkate alarak adil dağıtım yapar.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <h4 className={`font-bold flex items-center gap-2 ${isBlackAndWhite ? 'text-indigo-400' : 'text-indigo-700'}`}>
                                        <MousePointerClick className="w-4 h-4"/> 1. Personel Yönetimi
                                    </h4>
                                    <div className={`text-sm ${isBlackAndWhite ? 'text-gray-300' : 'text-gray-600'}`}>
                                        Doktorları ekleyin, kıdemlerini (1, 2, 3) ve gruplarını (A, B, C, D) belirleyin.
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <h4 className={`font-bold flex items-center gap-2 ${isBlackAndWhite ? 'text-indigo-400' : 'text-indigo-700'}`}>
                                        <Settings2 className="w-4 h-4"/> 2. Servis Kuralları
                                    </h4>
                                    <div className={`text-sm ${isBlackAndWhite ? 'text-gray-300' : 'text-gray-600'}`}>
                                        Her servis için hangi kıdemlerin nöbet tutabileceğini ve kaç kişi gerektiğini ayarlayın.
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <h4 className={`font-bold flex items-center gap-2 ${isBlackAndWhite ? 'text-indigo-400' : 'text-indigo-700'}`}>
                                        <CalendarIcon className="w-4 h-4"/> 3. Çizelge & Geçmiş
                                    </h4>
                                    <p className={`text-sm ${isBlackAndWhite ? 'text-gray-300' : 'text-gray-600'}`}>
                                        Oluşturulan çizelgeleri geçmişe kaydedebilir ve sonradan inceleyebilirsiniz.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}
    </div>
  );
}