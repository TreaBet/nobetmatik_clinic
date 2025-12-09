
import React, { useState, useEffect, useMemo } from 'react';
import { Scheduler } from './scheduler';
import { readStaffFromExcel } from '../../services/excelService';
import { exportToExcel } from './services/reportService'; 
import { generateTemplate } from '../../services/excelService';
import { exportToJSON, importFromJSON } from '../../services/backupService';
import { generateShareLink, parseShareLink } from '../../services/shareService';
import { Staff, Service, RoleConfig, ScheduleResult, UnitConstraint, Preset } from '../../types';
import { ICONS, MOCK_STAFF, MOCK_SERVICES, DEFAULT_UNIT_CONSTRAINTS } from '../../constants';
import { Card, Button } from '../../components/ui';
import { Moon, Sun, Activity, Info, X, Eye, ArrowLeft, Users, Settings2, Zap, BookOpen, MousePointerClick, DoorOpen } from 'lucide-react';
import { StaffManager } from './components/StaffManager'; 
import { ServiceManager } from './components/ServiceManager'; 
import { ScheduleViewer } from './components/ScheduleViewer'; 

const loadState = <T,>(key: string, defaultValue: T): T => {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return defaultValue;
    const parsed = JSON.parse(stored);
    if (parsed === null || parsed === undefined) return defaultValue;
    if (Array.isArray(defaultValue) && !Array.isArray(parsed)) return defaultValue;
    return parsed;
  } catch (e) {
    return defaultValue;
  }
};

const DEFAULT_UNITS = ['Genel Cerrahi', 'KBB', 'Beyin ve Ortopedi', 'Plastik'];
const DEFAULT_SPECIALTIES = ['Transplantasyon', 'Yara Bakım'];

interface NurseAppProps {
    onBack: () => void;
}

export default function App({ onBack }: NurseAppProps) {
  const [activeTab, setActiveTab] = useState<'staff' | 'services' | 'generate'>('staff');
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoTab, setInfoTab] = useState<'about' | 'manual'>('manual');
  
  const [customUnits, setCustomUnits] = useState<string[]>(() => loadState('nobet_units', DEFAULT_UNITS));
  const [customSpecialties, setCustomSpecialties] = useState<string[]>(() => loadState('nobet_specialties', DEFAULT_SPECIALTIES));

  const [staff, setStaff] = useState<Staff[]>(() => {
      const loaded = loadState('nobet_staff', MOCK_STAFF as unknown as Staff[]);
      if (!Array.isArray(loaded)) return [];
      return loaded.map(s => {
          let sNew = { ...s, isActive: s.isActive !== undefined ? s.isActive : true };
          if (sNew.specialty === 'transplant') sNew.specialty = 'Transplantasyon';
          if (sNew.specialty === 'wound') sNew.specialty = 'Yara Bakım';
          return sNew;
      });
  });

  const [services, setServices] = useState<Service[]>(() => loadState('nobet_services', MOCK_SERVICES as unknown as Service[]));
  const [roleConfigs, setRoleConfigs] = useState<Record<number, RoleConfig>>(() => loadState('nobet_roleConfigs', {}));
  const [unitConstraints, setUnitConstraints] = useState<UnitConstraint[]>(() => loadState('nobet_constraints', DEFAULT_UNIT_CONSTRAINTS));
  
  const [month, setMonth] = useState(() => loadState('nobet_month', new Date().getMonth()));
  const [year, setYear] = useState(() => loadState('nobet_year', new Date().getFullYear()));
  const [randomizeDays, setRandomizeDays] = useState(() => loadState('nobet_randomize', true));
  const [preventEveryOther, setPreventEveryOther] = useState(() => loadState('nobet_preventEveryOther', true));
  const [dailyTotalTarget, setDailyTotalTarget] = useState(() => loadState('nobet_dailyTotalTarget', 6)); 
  const [isBlackAndWhite, setIsBlackAndWhite] = useState(() => loadState('nobet_bw_theme', false));
  
  const [savedPresets, setSavedPresets] = useState<Preset[]>(() => loadState('nobet_user_presets', []));

  const [result, setResult] = useState<ScheduleResult | null>(null);
  const [loading, setLoading] = useState(false);

  const [isReadOnly, setIsReadOnly] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);

  useEffect(() => {
    if (isBlackAndWhite) {
      document.body.style.backgroundColor = '#020617'; 
      document.documentElement.classList.add('high-contrast'); 
    } else {
      document.body.style.backgroundColor = '#f3f4f6'; 
      document.documentElement.classList.remove('high-contrast');
    }
  }, [isBlackAndWhite]);

  useEffect(() => {
      const shareData = parseShareLink();
      if (shareData) {
          setIsReadOnly(true);
          setStaff(shareData.staff || []);
          setServices(shareData.services || []);
          setResult(shareData.result);
          setMonth(shareData.month || new Date().getMonth());
          setYear(shareData.year || new Date().getFullYear());
          setActiveTab('generate');
      }
  }, []);

  useEffect(() => { if(!isReadOnly) localStorage.setItem('nobet_staff', JSON.stringify(staff)); }, [staff, isReadOnly]);
  useEffect(() => { if(!isReadOnly) localStorage.setItem('nobet_services', JSON.stringify(services)); }, [services, isReadOnly]);
  useEffect(() => { if(!isReadOnly) localStorage.setItem('nobet_roleConfigs', JSON.stringify(roleConfigs)); }, [roleConfigs, isReadOnly]);
  useEffect(() => { if(!isReadOnly) localStorage.setItem('nobet_constraints', JSON.stringify(unitConstraints)); }, [unitConstraints, isReadOnly]);
  useEffect(() => { if(!isReadOnly) localStorage.setItem('nobet_month', JSON.stringify(month)); }, [month, isReadOnly]);
  useEffect(() => { if(!isReadOnly) localStorage.setItem('nobet_year', JSON.stringify(year)); }, [year, isReadOnly]);
  useEffect(() => { if(!isReadOnly) localStorage.setItem('nobet_randomize', JSON.stringify(randomizeDays)); }, [randomizeDays, isReadOnly]);
  useEffect(() => { if(!isReadOnly) localStorage.setItem('nobet_preventEveryOther', JSON.stringify(preventEveryOther)); }, [preventEveryOther, isReadOnly]);
  useEffect(() => { if(!isReadOnly) localStorage.setItem('nobet_dailyTotalTarget', JSON.stringify(dailyTotalTarget)); }, [dailyTotalTarget, isReadOnly]);
  useEffect(() => { localStorage.setItem('nobet_bw_theme', JSON.stringify(isBlackAndWhite)); }, [isBlackAndWhite]); 
  
  useEffect(() => { if(!isReadOnly) localStorage.setItem('nobet_units', JSON.stringify(customUnits)); }, [customUnits, isReadOnly]);
  useEffect(() => { if(!isReadOnly) localStorage.setItem('nobet_specialties', JSON.stringify(customSpecialties)); }, [customSpecialties, isReadOnly]);
  
  useEffect(() => { if(!isReadOnly) localStorage.setItem('nobet_user_presets', JSON.stringify(savedPresets)); }, [savedPresets, isReadOnly]);

  const uniqueRoles = useMemo(() => {
    if (!Array.isArray(staff)) return [];
    return Array.from(new Set(staff.map(s => s.role))).sort((a: number, b: number) => a - b);
  }, [staff]);

  useEffect(() => {
     if(isReadOnly) return;
     let changed = false;
     const newConfigs = { ...roleConfigs };
     uniqueRoles.forEach(r => {
         if (!newConfigs[r]) {
             newConfigs[r] = { role: r, quotaService: 5, weekendLimit: 2, quotaEmergency: 0 };
             changed = true;
         }
     });
     if (changed) setRoleConfigs(newConfigs);
  }, [uniqueRoles, roleConfigs, isReadOnly]);

  const handleResetData = () => {
      if (window.confirm("Tüm veriler (Personel, Servisler, Ayarlar) silinip varsayılan verilere dönülecek. Emin misiniz?")) {
          localStorage.clear();
          window.location.reload();
      }
  };
  
  const handleLoadPreset = (preset: Preset) => {
      setStaff(preset.staff);
      setServices(preset.services);
      if (preset.customUnits) setCustomUnits(preset.customUnits);
      if (preset.customSpecialties) setCustomSpecialties(preset.customSpecialties);
      setUnitConstraints(preset.unitConstraints);
      setDailyTotalTarget(preset.dailyTotalTarget);
      setResult(null); 
      alert(`"${preset.name}" şablonu başarıyla yüklendi.`);
  };

  const handleAddPreset = (newPreset: Preset) => {
      if (savedPresets.some(p => p.id === newPreset.id)) newPreset.id = `preset_${Date.now()}`;
      setSavedPresets(prev => [...prev, newPreset]);
  };

  const handleDeletePreset = (id: string) => {
      if (window.confirm("Bu şablonu silmek istediğinize emin misiniz?")) {
          setSavedPresets(prev => prev.filter(p => p.id !== id));
      }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          try {
              const importedStaff = await readStaffFromExcel(e.target.files[0]);
              setStaff(importedStaff);
              alert(`${importedStaff.length} personel yüklendi. Hedefler ve kısıtlamalar Excel'den okundu.`);
          } catch (error) {
              alert('Dosya okunurken hata oluştu.');
          }
      }
  };

  const handleExportBackup = () => {
    // Pass extra nurse-specific data to backup
    exportToJSON(
        staff, 
        services, 
        roleConfigs, 
        { month, year, randomizeDays, preventEveryOther, dailyTotalTarget }, 
        { unitConstraints, customUnits, customSpecialties, presets: savedPresets }
    );
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        try {
            const data = await importFromJSON(e.target.files[0]);
            if (Array.isArray(data.staff)) setStaff(data.staff);
            if (Array.isArray(data.services)) setServices(data.services);
            if (data.roleConfigs) setRoleConfigs(data.roleConfigs);
            
            // Restore Nurse Specifics
            if (data.unitConstraints) setUnitConstraints(data.unitConstraints);
            if (data.customUnits) setCustomUnits(data.customUnits);
            if (data.customSpecialties) setCustomSpecialties(data.customSpecialties);
            if (data.presets) setSavedPresets(data.presets);

            if (data.config) {
                setMonth(data.config.month);
                setYear(data.config.year);
                setRandomizeDays(data.config.randomizeDays);
                setPreventEveryOther(data.config.preventEveryOther);
                if (data.config.dailyTotalTarget) setDailyTotalTarget(data.config.dailyTotalTarget);
            }
            alert("Yedek başarıyla yüklendi.");
        } catch (error) {
            alert("Yedek dosyası geçersiz veya okunamadı.");
        }
        e.target.value = ''; // Reset input
    }
  };

  const handleGenerate = () => {
      setLoading(true);
      setTimeout(() => {
          try {
              const scheduler = new Scheduler(staff, services, {
                  year,
                  month,
                  maxRetries: 50,
                  randomizeOrder: randomizeDays,
                  preventEveryOtherDay: preventEveryOther,
                  unitConstraints: unitConstraints,
                  dailyTotalTarget: dailyTotalTarget,
                  holidays: [] 
              });
              const res = scheduler.generate();
              setResult(res);
              setActiveTab('generate');
          } catch (e: any) {
              alert("Çizelge oluşturulamadı: " + e.message);
          } finally {
              setLoading(false);
          }
      }, 100);
  };
  
  const handleDownload = () => {
      if (!result) return;
      exportToExcel(result, services, year, month, staff);
  };

  const handleCreateShareLink = () => {
      if(!result) return;
      const link = generateShareLink(result, services, staff, year, month);
      setShareLink(link);
      navigator.clipboard.writeText(link).then(() => {
          alert("Link panoya kopyalandı!");
      });
  };

  return (
    <div className={`min-h-screen font-sans transition-colors duration-500 ${isBlackAndWhite ? 'text-slate-100 selection:bg-indigo-500/30' : 'text-slate-900 selection:bg-indigo-100'}`}>
        <nav className={`sticky top-0 z-40 backdrop-blur-md border-b transition-colors duration-500 ${isBlackAndWhite ? 'bg-slate-950/80 border-slate-800' : 'bg-white/80 border-gray-200 shadow-sm'}`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16 items-center">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" onClick={onBack} className={isBlackAndWhite ? 'text-white hover:bg-slate-800' : 'text-gray-600'}>
                             <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <div className={`p-2 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 shadow-lg shadow-indigo-500/30`}>
                             <Activity className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className={`text-xl font-bold tracking-tight ${isBlackAndWhite ? 'text-white' : 'text-slate-900'}`}>Nöbetmatik <span className="text-indigo-500">v2.1</span></h1>
                            <p className={`text-[10px] font-medium uppercase tracking-widest ${isBlackAndWhite ? 'text-slate-500' : 'text-slate-400'}`}>Enterprise Edition</p>
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
                            <Users className="w-4 h-4" /> Personel Yönetimi
                         </button>
                         <button onClick={() => setActiveTab('services')} className={`py-3 px-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'services' ? (isBlackAndWhite ? 'border-indigo-500 text-indigo-400' : 'border-indigo-600 text-indigo-600') : (isBlackAndWhite ? 'border-transparent text-slate-400 hover:text-white' : 'border-transparent text-gray-500 hover:text-gray-700')}`}>
                             <Settings2 className="w-4 h-4" /> Servis Kuralları
                         </button>
                         <button onClick={() => setActiveTab('generate')} className={`py-3 px-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'generate' ? (isBlackAndWhite ? 'border-indigo-500 text-indigo-400' : 'border-indigo-600 text-indigo-600') : (isBlackAndWhite ? 'border-transparent text-slate-400 hover:text-white' : 'border-transparent text-gray-500 hover:text-gray-700')}`}>
                             <Zap className="w-4 h-4" /> Çizelge Oluştur
                         </button>
                    </div>
                </div>
            )}
        </nav>

        <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
            {isReadOnly && (
                <div className="mb-6 bg-indigo-600 text-white p-4 rounded-xl shadow-lg flex justify-between items-center animate-in fade-in slide-in-from-top-4">
                    <div className="flex items-center gap-3">
                        <Eye className="w-6 h-6 opacity-80" />
                        <div>
                            <h3 className="font-bold">Salt Okunur Mod (Paylaşım)</h3>
                            <p className="text-sm opacity-80">Bu çizelge paylaşılan bir link üzerinden görüntüleniyor. Düzenleme yapılamaz.</p>
                        </div>
                    </div>
                    <Button onClick={() => { setIsReadOnly(false); window.location.hash = ''; window.location.search = ''; window.location.reload(); }} className="bg-white text-indigo-700 hover:bg-indigo-50 border-none shadow-none text-sm h-9">
                        Kendi Çizelgeni Oluştur
                    </Button>
                </div>
            )}

            {activeTab === 'staff' && !isReadOnly && (
                <StaffManager 
                    staff={staff} setStaff={setStaff}
                    roleConfigs={roleConfigs} setRoleConfigs={setRoleConfigs}
                    handleResetData={handleResetData}
                    handleFileUpload={handleFileUpload}
                    generateTemplate={generateTemplate}
                    handleImportBackup={handleImportBackup}
                    handleExportBackup={handleExportBackup}
                    isBlackAndWhite={isBlackAndWhite}
                    daysInMonth={new Date(year, month + 1, 0).getDate()}
                    customUnits={customUnits} setCustomUnits={setCustomUnits}
                    customSpecialties={customSpecialties} setCustomSpecialties={setCustomSpecialties}
                    onLoadPreset={handleLoadPreset}
                    savedPresets={savedPresets}
                    onAddPreset={handleAddPreset}
                    onDeletePreset={handleDeletePreset}
                />
            )}

            {activeTab === 'services' && !isReadOnly && (
                <ServiceManager 
                    services={services} setServices={setServices}
                    staff={staff}
                    isBlackAndWhite={isBlackAndWhite}
                    unitConstraints={unitConstraints} setUnitConstraints={setUnitConstraints}
                    dailyTotalTarget={dailyTotalTarget} setDailyTotalTarget={setDailyTotalTarget}
                    customSpecialties={customSpecialties}
                />
            )}

            {(activeTab === 'generate' || isReadOnly) && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {!isReadOnly && (
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
                                
                                <div className="flex items-center gap-3 pb-2">
                                     <label className={`flex items-center gap-2 cursor-pointer text-sm font-medium ${isBlackAndWhite ? 'text-gray-300' : 'text-gray-700'}`}>
                                        <input type="checkbox" checked={randomizeDays} onChange={e => setRandomizeDays(e.target.checked)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                        <span>Rastgele Sıra</span>
                                     </label>
                                     <label className={`flex items-center gap-2 cursor-pointer text-sm font-medium ${isBlackAndWhite ? 'text-gray-300' : 'text-gray-700'}`}>
                                        <input type="checkbox" checked={preventEveryOther} onChange={e => setPreventEveryOther(e.target.checked)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                        <span>Gün Aşırı Engelle</span>
                                     </label>
                                </div>

                                <Button onClick={handleGenerate} disabled={loading} className={`h-[42px] ${isBlackAndWhite ? '!bg-indigo-600 !border-indigo-500' : ''}`}>
                                    {loading ? 'Hesaplanıyor...' : 'Çizelgeyi Oluştur'}
                                </Button>
                            </div>
                        </Card>
                    )}

                    {loading && (
                         <div className="py-20 text-center animate-pulse">
                            <div className={`text-5xl mb-4 font-bold ${isBlackAndWhite ? 'text-indigo-400' : 'text-indigo-600'}`}>...</div>
                            <h3 className={`text-xl font-bold ${isBlackAndWhite ? 'text-white' : 'text-gray-800'}`}>Nöbetler Dağıtılıyor</h3>
                            <p className={isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}>Milyonlarca olasılık Monte Carlo simülasyonu ile hesaplanıyor.</p>
                         </div>
                    )}

                    {!loading && result && (
                        <ScheduleViewer 
                            result={result} 
                            setResult={setResult}
                            services={services}
                            staff={staff}
                            year={year}
                            month={month}
                            isBlackAndWhite={isBlackAndWhite}
                            handleDownload={handleDownload}
                            isReadOnly={isReadOnly}
                            onShare={handleCreateShareLink}
                        />
                    )}
                </div>
            )}
        </main>

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
                                <h3 className="font-bold text-lg text-indigo-500">Nöbetmatik v2.1 Enterprise</h3>
                                <p className={isBlackAndWhite ? 'text-gray-300' : 'text-gray-600'}>
                                    Bu sistem, sağlık kurumlarındaki karmaşık nöbet çizelgeleme süreçlerini otomatize etmek için geliştirilmiştir.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <h4 className={`font-bold flex items-center gap-2 ${isBlackAndWhite ? 'text-indigo-400' : 'text-indigo-700'}`}>
                                        <MousePointerClick className="w-4 h-4"/> 1. Personel Yönetimi
                                    </h4>
                                    <div className={`text-sm ${isBlackAndWhite ? 'text-gray-300' : 'text-gray-600'}`}>
                                        Personel ekleyin, birimlerini belirleyin ve oda arkadaşı detaylarını girin.
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <h4 className={`font-bold flex items-center gap-2 ${isBlackAndWhite ? 'text-indigo-400' : 'text-indigo-700'}`}>
                                        <Settings2 className="w-4 h-4"/> 2. Servis Kuralları
                                    </h4>
                                    <div className={`text-sm ${isBlackAndWhite ? 'text-gray-300' : 'text-gray-600'}`}>
                                        Servislerinizi ve günlük kişi sayılarını (Min-Max) tanımlayın.
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <h4 className={`font-bold flex items-center gap-2 ${isBlackAndWhite ? 'text-indigo-400' : 'text-indigo-700'}`}>
                                        <DoorOpen className="w-4 h-4"/> 3. Oda & Çakışma Mantığı
                                    </h4>
                                    <p className={`text-sm ${isBlackAndWhite ? 'text-gray-300' : 'text-gray-600'}`}>
                                        Aynı odada kalan kişilerin salon numarasını aynı girin.
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
