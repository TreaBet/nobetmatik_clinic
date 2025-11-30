
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Scheduler } from './services/scheduler';
import { exportToExcel, generateTemplate, readStaffFromExcel } from './services/excelService';
import { Staff, Service, ScheduleResult, Role, Group, RoleConfig, DaySchedule } from './types';
import { ICONS, MOCK_STAFF, MOCK_SERVICES } from './constants';
import { Card, Button, Badge, MultiSelect } from './components/ui';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Moon, Sun, Edit3, X, Save, CheckCircle2, RefreshCw } from 'lucide-react';

// Helper for LocalStorage
const loadState = <T,>(key: string, defaultValue: T): T => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch (e) {
    console.error(`Error loading key ${key}`, e);
    return defaultValue;
  }
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'staff' | 'services' | 'generate'>('staff');
  
  // --- PERSISTENT STATE ---
  const [staff, setStaff] = useState<Staff[]>(() => loadState('nobet_staff', MOCK_STAFF as unknown as Staff[]));
  const [services, setServices] = useState<Service[]>(() => loadState('nobet_services', MOCK_SERVICES as unknown as Service[]));
  const [roleConfigs, setRoleConfigs] = useState<Record<number, RoleConfig>>(() => loadState('nobet_roleConfigs', {}));
  
  // Generator Config Persistence
  const [month, setMonth] = useState(() => loadState('nobet_month', new Date().getMonth()));
  const [year, setYear] = useState(() => loadState('nobet_year', new Date().getFullYear()));
  const [randomizeDays, setRandomizeDays] = useState(() => loadState('nobet_randomize', true));
  const [preventEveryOther, setPreventEveryOther] = useState(() => loadState('nobet_preventEveryOther', true));
  const [isBlackAndWhite, setIsBlackAndWhite] = useState(() => loadState('nobet_bw_theme', false));

  // --- NON-PERSISTENT STATE (Session only) ---
  const [result, setResult] = useState<ScheduleResult | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [monteCarloIters] = useState(1000); 
  
  // Edit Mode
  const [isEditing, setIsEditing] = useState(false);
  const [editingSlot, setEditingSlot] = useState<{day: number, serviceId: string, currentStaffId: string} | null>(null);

  // Form States
  const [newStaff, setNewStaff] = useState<Partial<Staff>>({ 
    name: '', role: 2, group: 'Genel', quotaService: 5, quotaEmergency: 2, weekendLimit: 2, offDays: [], requestedDays: []
  });
  const [newService, setNewService] = useState<Partial<Service>>({ 
    name: '', minDailyCount: 1, maxDailyCount: 1, allowedRoles: [1, 2, 3], priorityRoles: [], preferredGroup: 'Farketmez', isEmergency: false 
  });

  // --- PERSISTENCE EFFECTS ---
  useEffect(() => { localStorage.setItem('nobet_staff', JSON.stringify(staff)); }, [staff]);
  useEffect(() => { localStorage.setItem('nobet_services', JSON.stringify(services)); }, [services]);
  useEffect(() => { localStorage.setItem('nobet_roleConfigs', JSON.stringify(roleConfigs)); }, [roleConfigs]);
  useEffect(() => { localStorage.setItem('nobet_month', JSON.stringify(month)); }, [month]);
  useEffect(() => { localStorage.setItem('nobet_year', JSON.stringify(year)); }, [year]);
  useEffect(() => { localStorage.setItem('nobet_randomize', JSON.stringify(randomizeDays)); }, [randomizeDays]);
  useEffect(() => { localStorage.setItem('nobet_preventEveryOther', JSON.stringify(preventEveryOther)); }, [preventEveryOther]);
  useEffect(() => { localStorage.setItem('nobet_bw_theme', JSON.stringify(isBlackAndWhite)); }, [isBlackAndWhite]);

  // Bulk Role Configuration Logic
  const uniqueRoles = useMemo(() => Array.from(new Set(staff.map(s => s.role))).sort((a: number, b: number) => a - b), [staff]);

  // Ensure role configs exist for all roles found in staff (auto-fill defaults if missing)
  useEffect(() => {
     let changed = false;
     const newConfigs = { ...roleConfigs };
     uniqueRoles.forEach(r => {
         if (!newConfigs[r]) {
             newConfigs[r] = { role: r, quotaService: 5, quotaEmergency: 2, weekendLimit: 2 };
             changed = true;
         }
     });
     if (changed) {
         setRoleConfigs(newConfigs);
     }
  }, [uniqueRoles, roleConfigs]);

  const handleApplyRoleConfig = (role: number) => {
    const config = roleConfigs[role];
    if (!config) return;

    setStaff(prevStaff => prevStaff.map(s => {
      if (s.role === role) {
        return {
          ...s,
          quotaService: config.quotaService,
          quotaEmergency: config.quotaEmergency,
          weekendLimit: config.weekendLimit
        };
      }
      return s;
    }));
    alert(`Tüm Kıdem ${role} personelleri güncellendi.`);
  };

  const updateRoleConfig = (role: number, field: keyof RoleConfig, value: number) => {
     setRoleConfigs(prev => ({
         ...prev,
         [role]: {
             ...prev[role],
             role,
             [field]: value
         }
     }));
  };

  const handleResetData = () => {
      if (window.confirm("Tüm veriler (Personel, Servisler, Ayarlar) silinip varsayılan verilere dönülecek. Emin misiniz?")) {
          localStorage.clear();
          window.location.reload();
      }
  };

  const handleAddStaff = () => {
    if (!newStaff.name) return;
    setStaff([...staff, { ...newStaff, id: Date.now().toString() } as Staff]);
    setNewStaff({ name: '', role: 2, group: 'Genel', quotaService: 5, quotaEmergency: 2, weekendLimit: 2, offDays: [], requestedDays: [] });
  };

  const handleDeleteStaff = (id: string) => {
    setStaff(staff.filter(s => s.id !== id));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          try {
              const importedStaff = await readStaffFromExcel(e.target.files[0]);
              setStaff(importedStaff);
              alert(`${importedStaff.length} personel yüklendi. Şimdi 'Kıdem Bazlı Ayarlar' bölümünden nöbet sayılarını belirleyin.`);
          } catch (error) {
              alert('Dosya okunurken hata oluştu.');
          }
      }
  };

  const handleAddService = () => {
    if (!newService.name) return;
    setServices([...services, { ...newService, id: Date.now().toString() } as Service]);
    setNewService({ name: '', minDailyCount: 1, maxDailyCount: 1, allowedRoles: [1, 2, 3], priorityRoles: [], preferredGroup: 'Farketmez', isEmergency: false });
  };

  const handleDeleteService = (id: string) => {
    setServices(services.filter(s => s.id !== id));
  };

  const handleGenerate = async () => {
    setLoading(true);
    setResult(null);

    setTimeout(() => {
      try {
        const scheduler = new Scheduler(staff, services, {
          year,
          month,
          maxRetries: monteCarloIters,
          randomizeOrder: randomizeDays,
          preventEveryOtherDay: preventEveryOther
        });
        const res = scheduler.generate();
        setResult(res);
        setActiveTab('generate');
      } catch (e) {
        alert("Çizelge oluşturulamadı. Lütfen kısıtlamaları (günlük kişi sayısı vs.) ve personel kotalarını kontrol edin.");
      } finally {
        setLoading(false);
      }
    }, 100);
  };

  const handleDownload = () => {
    if (result) {
      exportToExcel(result, services, year, month);
    }
  };

  // --- MANUAL EDITING LOGIC ---
  const recalculateStats = (newSchedule: DaySchedule[]) => {
      if(!result) return;

      const newStats = staff.map(s => {
          let total = 0, serviceCount = 0, emergency = 0, weekend = 0, sat = 0, sun = 0;
          
          newSchedule.forEach(day => {
              const assignment = day.assignments.find(a => a.staffId === s.id);
              if(assignment) {
                  total++;
                  if(assignment.isEmergency) emergency++; else serviceCount++;
                  if(day.isWeekend) weekend++;
                  const date = new Date(year, month, day.day);
                  if(date.getDay() === 6) sat++;
                  if(date.getDay() === 0) sun++;
              }
          });

          return {
            staffId: s.id,
            totalShifts: total,
            serviceShifts: serviceCount,
            emergencyShifts: emergency,
            weekendShifts: weekend,
            saturdayShifts: sat,
            sundayShifts: sun
          };
      });

      const unfilled = newSchedule.reduce((acc, day) => acc + day.assignments.filter(a => a.staffId === 'EMPTY').length, 0);

      setResult({
          ...result,
          schedule: newSchedule,
          stats: newStats,
          unfilledSlots: unfilled
      });
  };

  const handleUpdateAssignment = (newStaffId: string) => {
      if (!editingSlot || !result) return;
      
      const newSchedule = [...result.schedule];
      const dayData = newSchedule.find(d => d.day === editingSlot.day);
      if(!dayData) return;

      const targetAssignmentIndex = dayData.assignments.findIndex(a => a.serviceId === editingSlot.serviceId && a.staffId === editingSlot.currentStaffId);
      if(targetAssignmentIndex === -1) return;

      const newStaffMember = staff.find(s => s.id === newStaffId);
      const isRemoving = newStaffId === 'EMPTY';

      const updatedAssignment = {
          ...dayData.assignments[targetAssignmentIndex],
          staffId: isRemoving ? 'EMPTY' : newStaffMember!.id,
          staffName: isRemoving ? 'BOŞ' : newStaffMember!.name,
          role: isRemoving ? 0 : newStaffMember!.role,
          group: isRemoving ? 'Genel' : newStaffMember!.group
      };

      dayData.assignments[targetAssignmentIndex] = updatedAssignment as any;
      recalculateStats(newSchedule);
      setEditingSlot(null);
  };

  const getAvailableStaffForEdit = () => {
      if(!editingSlot || !result) return [];
      
      const daySchedule = result.schedule.find(s => s.day === editingSlot.day);
      const service = services.find(s => s.id === editingSlot.serviceId);
      
      if(!daySchedule || !service) return [];

      const assignedStaffIds = new Set(daySchedule.assignments.map(a => a.staffId));
      
      return staff.filter(s => {
          if (assignedStaffIds.has(s.id) && s.id !== editingSlot.currentStaffId) return false;
          if (!service.allowedRoles.includes(s.role)) return false;
          if (s.offDays.includes(editingSlot.day)) return false;
          return true;
      });
  };

  const chartData = useMemo(() => {
    if (!result) return [];
    return result.stats.map(s => {
      const p = staff.find(st => st.id === s.staffId);
      return {
        name: p?.name || '?',
        targetService: p?.quotaService || 0,
        actualService: s.serviceShifts,
        targetEmergency: p?.quotaEmergency || 0,
        actualEmergency: s.emergencyShifts
      };
    });
  }, [result, staff]);

  return (
    <div className={`min-h-screen font-sans pb-20 transition-all duration-300 ${isBlackAndWhite ? 'bg-white text-black' : 'bg-gray-100 text-gray-800'}`}>
      
      {/* Modal for Manual Edit */}
      {editingSlot && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border-0 ring-1 ring-gray-200">
                  <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                      <h3 className="font-bold text-gray-900">Nöbet Değiştir (Gün: {editingSlot.day})</h3>
                      <button onClick={() => setEditingSlot(null)}><X className="w-5 h-5 text-gray-500 hover:text-gray-800" /></button>
                  </div>
                  <div className="p-2 max-h-[60vh] overflow-y-auto bg-gray-50">
                      <div className="space-y-2">
                          <button 
                             onClick={() => handleUpdateAssignment('EMPTY')}
                             className="w-full p-3 text-left bg-white border border-red-100 rounded-lg hover:bg-red-50 flex justify-between items-center text-red-600 font-bold shadow-sm transition-all"
                          >
                              <span>BOŞ BIRAK</span>
                              <X className="w-4 h-4" />
                          </button>
                          {getAvailableStaffForEdit().map(s => (
                              <button 
                                key={s.id}
                                onClick={() => handleUpdateAssignment(s.id)}
                                className={`w-full p-3 text-left border rounded-lg flex justify-between items-center shadow-sm transition-all ${
                                    s.id === editingSlot.currentStaffId 
                                    ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500 z-10' 
                                    : 'bg-white border-gray-200 hover:border-indigo-300 hover:shadow-md'
                                }`}
                              >
                                  <div>
                                      <div className="font-bold text-gray-900">{s.name}</div>
                                      <div className="text-xs text-gray-500 mt-0.5">Kıdem: {s.role} | Grup: {s.group}</div>
                                  </div>
                                  {s.id === editingSlot.currentStaffId && <CheckCircle2 className="w-5 h-5 text-indigo-600" />}
                              </button>
                          ))}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Header */}
      <header className={`border-b sticky top-0 z-30 shadow-sm backdrop-blur-md bg-white/90 ${isBlackAndWhite ? 'bg-black border-black text-white' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center h-auto md:h-20 py-4 md:py-0 gap-4">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl shadow-sm ${isBlackAndWhite ? 'bg-white text-black' : 'bg-gradient-to-br from-indigo-600 to-blue-600 text-white'}`}>
                {ICONS.Shield}
              </div>
              <div className={isBlackAndWhite ? 'text-white' : ''}>
                <h1 className="text-xl font-bold leading-none tracking-tight">Nöbetmatik v20</h1>
                <span className={`text-xs font-bold tracking-wider uppercase ${isBlackAndWhite ? 'text-gray-300' : 'text-indigo-600'}`}>Enterprise Edition</span>
              </div>
            </div>
            
            <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
              <nav className={`flex p-1.5 rounded-xl ${isBlackAndWhite ? 'bg-gray-800' : 'bg-gray-100 border border-gray-200'}`}>
                {(['staff', 'services', 'generate'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${
                      activeTab === tab 
                        ? (isBlackAndWhite ? 'bg-white text-black shadow' : 'bg-white text-indigo-700 shadow-md transform scale-[1.02]') 
                        : (isBlackAndWhite ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900')
                    }`}
                  >
                    {tab === 'staff' && 'Personel'}
                    {tab === 'services' && 'Servis & Kurallar'}
                    {tab === 'generate' && 'Çizelge & Rapor'}
                  </button>
                ))}
              </nav>
              <button 
                onClick={() => setIsBlackAndWhite(!isBlackAndWhite)}
                className={`p-2.5 rounded-full transition-all duration-200 ${isBlackAndWhite ? 'bg-white text-black' : 'bg-gray-100 text-gray-500 hover:bg-indigo-100 hover:text-indigo-600'}`}
                title={isBlackAndWhite ? "Normal Moda Geç" : "Yüksek Kontrast Moduna Geç"}
              >
                 {isBlackAndWhite ? <Sun className="w-5 h-5"/> : <Moon className="w-5 h-5"/>}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* STAFF TAB */}
        {activeTab === 'staff' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row justify-between items-end gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Personel Yönetimi</h2>
                <p className="text-gray-500 mt-1">Excel'den toplu yükleyin veya manuel ekleyin. Kıdem bazlı kurallar tanımlayın.</p>
              </div>
              <div className="flex gap-3">
                 <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
                 
                 <Button variant="danger" onClick={handleResetData} className={isBlackAndWhite ? 'border-black text-black bg-white' : ''}>
                    <RefreshCw className="w-4 h-4" /> Verileri Sıfırla
                 </Button>

                 <Button variant="secondary" onClick={generateTemplate} className={isBlackAndWhite ? 'border-black text-black' : ''}>
                    {ICONS.Template} Taslak İndir
                 </Button>
                 <Button variant="primary" onClick={() => fileInputRef.current?.click()} className={isBlackAndWhite ? '!bg-black' : ''}>
                    {ICONS.Upload} Excel'den Yükle
                 </Button>
              </div>
            </div>

            {/* Role Configs */}
            {staff.length > 0 && (
                <Card className={`p-6 border ${isBlackAndWhite ? 'bg-white border-black' : 'bg-indigo-50/50 border-indigo-100'}`}>
                    <div className={`mb-4 flex items-center gap-2 ${isBlackAndWhite ? 'text-black' : 'text-indigo-800'}`}>
                        {ICONS.Settings}
                        <h3 className="font-bold text-lg">Kıdem Bazlı Toplu Ayarlar</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {uniqueRoles.map(role => (
                            <div key={role} className={`p-4 rounded-xl shadow-sm border transition-all hover:shadow-md ${isBlackAndWhite ? 'bg-white border-black' : 'bg-white border-indigo-100'}`}>
                                <div className="font-bold mb-3 border-b pb-2 flex justify-between items-center">
                                    <span className="text-indigo-900">Kıdem {role}</span>
                                    <Badge color="gray">{staff.filter(s => s.role === role).length} Kişi</Badge>
                                </div>
                                <div className="grid grid-cols-3 gap-3 mb-4">
                                    <div className="text-center">
                                        <label className="text-[10px] uppercase font-bold text-gray-500 block mb-1">Servis</label>
                                        <input 
                                            type="number" 
                                            className={`w-full text-center border-gray-300 rounded-lg p-1.5 text-sm focus:ring-indigo-500 focus:border-indigo-500 ${isBlackAndWhite ? 'border-black' : ''}`}
                                            value={roleConfigs[role]?.quotaService || 0}
                                            onChange={(e) => updateRoleConfig(role, 'quotaService', parseInt(e.target.value))}
                                        />
                                    </div>
                                    <div className="text-center">
                                        <label className="text-[10px] uppercase font-bold text-gray-500 block mb-1">Acil</label>
                                        <input 
                                            type="number" 
                                            className={`w-full text-center border-gray-300 rounded-lg p-1.5 text-sm focus:ring-indigo-500 focus:border-indigo-500 ${isBlackAndWhite ? 'border-black' : ''}`}
                                            value={roleConfigs[role]?.quotaEmergency || 0}
                                            onChange={(e) => updateRoleConfig(role, 'quotaEmergency', parseInt(e.target.value))}
                                        />
                                    </div>
                                    <div className="text-center">
                                        <label className="text-[10px] uppercase font-bold text-gray-500 block mb-1">H.Sonu</label>
                                        <input 
                                            type="number" 
                                            className={`w-full text-center border-gray-300 rounded-lg p-1.5 text-sm focus:ring-indigo-500 focus:border-indigo-500 ${isBlackAndWhite ? 'border-black' : ''}`}
                                            value={roleConfigs[role]?.weekendLimit || 0}
                                            onChange={(e) => updateRoleConfig(role, 'weekendLimit', parseInt(e.target.value))}
                                        />
                                    </div>
                                </div>
                                <Button variant="secondary" className={`w-full justify-center text-xs py-2 ${isBlackAndWhite ? 'bg-black text-white border-none hover:bg-gray-800' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200'}`} onClick={() => handleApplyRoleConfig(role)}>
                                    Ayarları Uygula
                                </Button>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* Manual Add Form */}
            <Card className={`p-6 border-l-4 ${isBlackAndWhite ? 'border-black' : 'border-l-indigo-400'}`}>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-end">
                <div className="md:col-span-3">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Manuel Ekle: Ad Soyad</label>
                  <input 
                    type="text" 
                    value={newStaff.name} 
                    onChange={e => setNewStaff({...newStaff, name: e.target.value})}
                    className="w-full border-gray-300 rounded-lg shadow-sm p-2.5 border focus:ring-indigo-500 focus:border-indigo-500" 
                    placeholder="Örn: Dr. Ahmet"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Kıdem</label>
                  <input type="number" min="1" max="10" value={newStaff.role} onChange={e => setNewStaff({...newStaff, role: parseInt(e.target.value)})} className="w-full border-gray-300 rounded-lg shadow-sm p-2.5 border focus:ring-indigo-500 focus:border-indigo-500" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Grup</label>
                  <select value={newStaff.group} onChange={e => setNewStaff({...newStaff, group: e.target.value as Group})} className="w-full border-gray-300 rounded-lg shadow-sm p-2.5 border focus:ring-indigo-500 focus:border-indigo-500">
                    <option value="Genel">Genel</option><option value="A">A Grubu</option><option value="B">B Grubu</option><option value="C">C Grubu</option><option value="D">D Grubu</option>
                  </select>
                </div>
                <div className="md:col-span-3">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Hedefler (Srv / Acil / HS)</label>
                  <div className="flex gap-2">
                    <input type="number" value={newStaff.quotaService} onChange={e => setNewStaff({...newStaff, quotaService: parseInt(e.target.value)})} className="w-1/3 border-gray-300 rounded-lg shadow-sm p-2.5 border text-center focus:ring-indigo-500 focus:border-indigo-500" />
                    <input type="number" value={newStaff.quotaEmergency} onChange={e => setNewStaff({...newStaff, quotaEmergency: parseInt(e.target.value)})} className="w-1/3 border-gray-300 rounded-lg shadow-sm p-2.5 border text-center focus:ring-indigo-500 focus:border-indigo-500" />
                    <input type="number" value={newStaff.weekendLimit} onChange={e => setNewStaff({...newStaff, weekendLimit: parseInt(e.target.value)})} className="w-1/3 border-gray-300 rounded-lg shadow-sm p-2.5 border text-center focus:ring-indigo-500 focus:border-indigo-500" />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <Button onClick={handleAddStaff} className={`w-full justify-center ${isBlackAndWhite ? '!bg-black' : ''}`}>
                    {ICONS.UserPlus} Ekle
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="overflow-hidden border-0 shadow-md">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className={isBlackAndWhite ? 'bg-black text-white' : 'bg-gray-50'}>
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Personel</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Kıdem & Grup</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Hedefler</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">İzin (Off)</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">İstek</th>
                      <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {staff.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap"><div className="font-semibold text-gray-900">{p.name}</div></td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex gap-2">
                            <Badge color={isBlackAndWhite ? "gray" : "purple"}>Kıdem {p.role}</Badge>
                            <Badge color="gray">{p.group}</Badge>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-mono">
                           {p.quotaService} / {p.quotaEmergency} / {p.weekendLimit}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center gap-2">
                             <div className={`rounded-lg px-2 py-1 flex items-center gap-2 border shadow-sm ${isBlackAndWhite ? 'bg-white border-black' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                {ICONS.Calendar}
                                <input 
                                  type="text" 
                                  className="bg-transparent border-none outline-none w-24 text-xs font-medium placeholder-red-300 focus:ring-0"
                                  placeholder="Örn: 1,5"
                                  value={p.offDays.join(',')}
                                  onChange={(e) => {
                                    const days = e.target.value.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d));
                                    setStaff(staff.map(s => s.id === p.id ? { ...s, offDays: days } : s));
                                  }}
                                />
                             </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                           <div className={`rounded-lg px-2 py-1 flex items-center gap-2 border shadow-sm ${isBlackAndWhite ? 'bg-white border-black' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                                {ICONS.Heart}
                                <input 
                                  type="text" 
                                  className="bg-transparent border-none outline-none w-24 text-xs font-medium placeholder-emerald-300 focus:ring-0"
                                  placeholder="Örn: 15"
                                  value={p.requestedDays ? p.requestedDays.join(',') : ''}
                                  onChange={(e) => {
                                      const days = e.target.value.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d));
                                      setStaff(staff.map(s => s.id === p.id ? { ...s, requestedDays: days } : s));
                                  }}
                                />
                             </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button onClick={() => handleDeleteStaff(p.id)} className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-full transition-all">{ICONS.Trash}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* SERVICES TAB */}
        {activeTab === 'services' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="flex justify-between items-end bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <div>
                  <h2 className="text-2xl font-bold text-gray-900">Servis Kuralları</h2>
                  <p className="text-gray-500 mt-1">Nöbet noktalarını ve kurallarını yapılandırın.</p>
              </div>
            </div>
            <Card className={`p-6 border-l-4 ${isBlackAndWhite ? 'border-l-black' : 'border-l-indigo-500'}`}>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-6 items-start">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Servis Adı</label>
                  <input type="text" value={newService.name} onChange={e => setNewService({...newService, name: e.target.value})} className="w-full border-gray-300 rounded-lg shadow-sm p-2.5 border focus:ring-indigo-500 focus:border-indigo-500" placeholder="Örn: Acil" />
                  <div className="mt-3 flex items-center gap-2">
                      <input type="checkbox" id="isEmerg" checked={newService.isEmergency} onChange={e => setNewService({...newService, isEmergency: e.target.checked})} className={`rounded text-indigo-600 focus:ring-indigo-500 ${isBlackAndWhite ? 'text-black' : ''}`} />
                      <label htmlFor="isEmerg" className={`text-sm font-medium ${isBlackAndWhite ? 'text-black' : 'text-rose-600'}`}>Bu bir Acil Nöbetidir</label>
                  </div>
                </div>
                <div>
                   <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Min-Max Kişi</label>
                   <div className="flex gap-2">
                       <input type="number" value={newService.minDailyCount} onChange={e => setNewService({...newService, minDailyCount: parseInt(e.target.value)})} className="w-1/2 p-2.5 border-gray-300 border rounded-lg shadow-sm focus:ring-indigo-500" placeholder="Min" />
                       <input type="number" value={newService.maxDailyCount} onChange={e => setNewService({...newService, maxDailyCount: parseInt(e.target.value)})} className="w-1/2 p-2.5 border-gray-300 border rounded-lg shadow-sm focus:ring-indigo-500" placeholder="Max" />
                   </div>
                </div>
                <div className="md:col-span-2 space-y-4">
                   <div className="space-y-1">
                     <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide">Yazılabilir Kıdemler</label>
                     <MultiSelect label="Seçiniz..." options={uniqueRoles} selected={newService.allowedRoles || []} onChange={(vals) => setNewService({...newService, allowedRoles: vals})} />
                   </div>
                   <div className="space-y-1">
                     <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide">Öncelikli Kıdemler</label>
                     <MultiSelect label="Seçiniz..." options={uniqueRoles} selected={newService.priorityRoles || []} onChange={(vals) => setNewService({...newService, priorityRoles: vals})} />
                   </div>
                </div>
                 <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Öncelikli Grup</label>
                  <select value={newService.preferredGroup} onChange={e => setNewService({...newService, preferredGroup: e.target.value as any})} className="w-full border-gray-300 rounded-lg shadow-sm p-2.5 border focus:ring-indigo-500">
                    <option value="Farketmez">Farketmez</option><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option>
                  </select>
                </div>
                <div className="md:col-span-6 flex justify-end">
                  <Button onClick={handleAddService} className={`w-48 justify-center ${isBlackAndWhite ? '!bg-black' : ''}`}>{ICONS.Plus} Servisi Ekle</Button>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {services.map(s => (
                <Card key={s.id} className={`p-5 relative group hover:shadow-lg transition-all border-l-4 ${isBlackAndWhite ? 'border-l-black' : (s.isEmergency ? 'border-l-rose-500' : 'border-l-indigo-500')}`}>
                  <button onClick={() => handleDeleteService(s.id)} className="absolute top-4 right-4 text-gray-300 hover:text-red-500 transition-colors">{ICONS.Trash}</button>
                  <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-bold text-lg text-gray-900">{s.name}</h3>
                      {s.isEmergency && <Badge color={isBlackAndWhite ? "gray" : "red"}>Acil</Badge>}
                  </div>
                  <div className="space-y-2 text-sm text-gray-600 mt-4 bg-gray-50 p-3 rounded-lg">
                     <div className="flex justify-between items-center"><span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Kişi Sayısı</span><span className="font-bold text-gray-900 bg-white px-2 py-0.5 rounded shadow-sm border">{s.minDailyCount}-{s.maxDailyCount}</span></div>
                     <div className="flex justify-between items-center"><span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Roller</span><span className="font-mono text-xs">{s.allowedRoles.join(', ')}</span></div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* GENERATE TAB */}
        {activeTab === 'generate' && (
          <div className={`space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 ${isBlackAndWhite ? 'high-contrast' : ''}`}>
            
            <Card className={`p-8 border-none overflow-hidden relative ${isBlackAndWhite ? 'bg-black text-white' : 'bg-gradient-to-br from-indigo-900 to-slate-900 text-white'}`}>
              {!isBlackAndWhite && (
                  <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-indigo-500 rounded-full blur-3xl opacity-20 pointer-events-none"></div>
              )}
              <div className="relative z-10 flex flex-col gap-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                  <div>
                    <h2 className="text-3xl font-bold tracking-tight">Nöbet Çizelgesi Oluştur</h2>
                    <p className="opacity-80 mt-2 text-lg font-light">Gelişmiş Monte Carlo simülasyonu ve optimizasyon motoru.</p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center gap-4 bg-white/10 p-3 rounded-2xl backdrop-blur-md border border-white/10">
                      {/* Month/Year Selects */}
                      <div className="flex gap-2">
                        <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))} className={`border border-white/20 rounded-xl p-3 focus:ring-2 focus:ring-white outline-none font-medium cursor-pointer ${isBlackAndWhite ? 'bg-black text-white' : 'bg-indigo-950/50 text-white hover:bg-white/20 transition-colors'}`}>
                            {Array.from({length: 12}, (_, i) => <option key={i} value={i} className="text-black">{new Date(0, i).toLocaleString('tr-TR', {month: 'long'})}</option>)}
                        </select>
                        <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} className={`border border-white/20 rounded-xl p-3 focus:ring-2 focus:ring-white outline-none font-medium cursor-pointer ${isBlackAndWhite ? 'bg-black text-white' : 'bg-indigo-950/50 text-white hover:bg-white/20 transition-colors'}`}>
                            {[2024, 2025, 2026].map(y => <option key={y} value={y} className="text-black">{y}</option>)}
                        </select>
                      </div>
                      <Button onClick={handleGenerate} disabled={loading} className={`h-12 px-8 shadow-xl border border-white/20 text-lg ${isBlackAndWhite ? 'bg-white text-black hover:bg-gray-200' : 'bg-white text-indigo-900 hover:bg-indigo-50 font-bold'}`}>
                        {loading ? 'Hesaplanıyor...' : 'LİSTEYİ OLUŞTUR'}
                      </Button>
                  </div>
                </div>
                {/* Checkboxes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-white/10 pt-6 mt-2">
                    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer" onClick={() => setRandomizeDays(!randomizeDays)}>
                         <input type="checkbox" checked={randomizeDays} onChange={(e) => setRandomizeDays(e.target.checked)} className="w-5 h-5 rounded border-white/30 bg-white/10 text-indigo-500 focus:ring-offset-0 focus:ring-2 focus:ring-white" />
                         <label className="text-sm font-medium cursor-pointer select-none">Rastgele Gün Dağıtımı (Daha iyi dağılım)</label>
                    </div>
                    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer" onClick={() => setPreventEveryOther(!preventEveryOther)}>
                         <input type="checkbox" checked={preventEveryOther} onChange={(e) => setPreventEveryOther(e.target.checked)} className="w-5 h-5 rounded border-white/30 bg-white/10 text-indigo-500 focus:ring-offset-0 focus:ring-2 focus:ring-white" />
                         <label className="text-sm font-medium cursor-pointer select-none">Günaşırı Nöbet Koruması</label>
                    </div>
                </div>
              </div>
            </Card>
            
            {result && (
              <>
                {/* Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className={`p-5 border-l-4 shadow-sm ${isBlackAndWhite ? 'border-l-gray-600' : 'border-l-emerald-500'}`}>
                     <div className="text-sm font-bold uppercase tracking-wider opacity-60 mb-1">Toplam Atama</div>
                     <div className="text-3xl font-bold">
                       {result.schedule.reduce((acc, day) => acc + day.assignments.filter(a => a.staffId !== 'EMPTY').length, 0)}
                     </div>
                  </Card>
                  <Card className={`p-5 border-l-4 shadow-sm ${isBlackAndWhite ? 'border-l-gray-900' : 'border-l-rose-500'}`}>
                     <div className="text-sm font-bold uppercase tracking-wider opacity-60 mb-1">Boş Kalan</div>
                     <div className={`text-3xl font-bold ${isBlackAndWhite ? '' : 'text-rose-600'}`}>
                       {result.unfilledSlots}
                     </div>
                  </Card>
                  {result.logs.length > 0 ? (
                      <Card className={`p-5 border-l-4 cursor-pointer hover:shadow-md transition-all ${isBlackAndWhite ? 'bg-gray-100 border-l-black' : 'border-l-amber-500 bg-amber-50/50'}`} onClick={() => document.getElementById('log-section')?.scrollIntoView({behavior: 'smooth'})}>
                         <div className="text-sm font-bold uppercase tracking-wider opacity-60 mb-1 flex items-center gap-2">{ICONS.Alert} Uyarılar</div>
                         <div className={`text-3xl font-bold ${isBlackAndWhite ? '' : 'text-amber-600'}`}>{result.logs.length} adet</div>
                      </Card>
                  ) : (
                      <Card className={`p-5 border-l-4 shadow-sm ${isBlackAndWhite ? 'border-l-black' : 'border-l-indigo-500'}`}>
                         <div className="text-sm font-bold uppercase tracking-wider opacity-60 mb-1">Durum</div>
                         <div className={`text-3xl font-bold ${isBlackAndWhite ? '' : 'text-indigo-600'}`}>Sorunsuz</div>
                      </Card>
                  )}
                  <div className="h-full">
                     <Button variant="secondary" onClick={handleDownload} className={`w-full h-full justify-center text-gray-700 bg-white hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 border-2 border-dashed ${isBlackAndWhite ? '!border-black !text-black' : ''}`}>
                       <div className="flex flex-col items-center gap-1">
                           {ICONS.Excel} 
                           <span>Excel Olarak İndir</span>
                       </div>
                     </Button>
                  </div>
                </div>
                
                {/* Logs */}
                {result.logs.length > 0 && (
                    <Card className={isBlackAndWhite ? 'bg-white border-black border-2' : 'bg-amber-50 border-amber-200 border'} id="log-section">
                        <div className={`p-4 border-b font-bold flex items-center gap-2 ${isBlackAndWhite ? 'border-black' : 'border-amber-200 text-amber-800'}`}>
                            {ICONS.Alert} Sistem Logları ve Hatalar
                        </div>
                        <div className={`p-4 max-h-48 overflow-y-auto text-sm font-mono space-y-1.5 ${isBlackAndWhite ? 'text-black' : 'text-amber-900'}`}>
                            {result.logs.map((log, i) => <div key={i} className="flex gap-2"><span>•</span><span>{log}</span></div>)}
                        </div>
                    </Card>
                )}

                {/* Chart */}
                <Card className="p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-6">
                      <div className="w-1 h-6 bg-indigo-500 rounded-full"></div>
                      <h3 className="font-bold text-lg text-gray-900">Hedef Tutarlılığı Grafiği</h3>
                  </div>
                  <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }} barGap={2}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis dataKey="name" tick={{fontSize: 11, fill: '#4b5563', fontWeight: 500}} interval={0} angle={-45} textAnchor="end" height={60} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#4b5563', fontSize: 12 }} axisLine={false} tickLine={false} />
                        <Tooltip 
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            cursor={{fill: '#f3f4f6'}}
                        />
                        <Legend verticalAlign="top" iconType="circle" wrapperStyle={{paddingBottom: '20px'}}/>
                        <Bar dataKey="targetService" name="Hedef (Srv)" fill={isBlackAndWhite ? '#d1d5db' : '#e0e7ff'} stroke={isBlackAndWhite ? "black" : "none"} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="actualService" name="Gerçekleşen (Srv)" fill={isBlackAndWhite ? 'black' : '#4f46e5'} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="targetEmergency" name="Hedef (Acil)" fill={isBlackAndWhite ? '#9ca3af' : '#fee2e2'} stroke={isBlackAndWhite ? "black" : "none"} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="actualEmergency" name="Gerçekleşen (Acil)" fill={isBlackAndWhite ? 'url(#stripePattern)' : '#f43f5e'} stroke={isBlackAndWhite ? "black" : "none"} radius={[4, 4, 0, 0]} />
                         <defs>
                            <pattern id="stripePattern" patternUnits="userSpaceOnUse" width="4" height="4">
                              <path d="M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2" style={{stroke:'black', strokeWidth:1}} />
                            </pattern>
                        </defs>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                {/* Main Schedule Table with strictly enforced styles */}
                <Card className="report-table-container shadow-md border-0 overflow-hidden">
                  <div className="p-4 bg-gray-50 border-b flex justify-between items-center sticky left-0 z-30">
                      <div className="flex items-center gap-2">
                         <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                         <span className="text-sm font-bold uppercase tracking-wide text-gray-700">Çizelge Detayı</span>
                      </div>
                      <Button variant="secondary" onClick={() => setIsEditing(!isEditing)} className={`text-xs h-8 ${isEditing ? 'bg-indigo-100 text-indigo-800 border-indigo-200' : ''}`}>
                          {isEditing ? <Save className="w-3.5 h-3.5"/> : <Edit3 className="w-3.5 h-3.5"/>}
                          {isEditing ? 'Düzenlemeyi Bitir' : 'Manuel Düzenle'}
                      </Button>
                  </div>
                  
                  <table className="report-table w-full">
                    <thead>
                      <tr>
                        <th className="sticky-col w-28 bg-gray-800 text-white">Gün</th>
                        {services.map(s => (
                          <th key={s.id} className="min-w-[160px]">
                              <div className="truncate font-bold text-sm">{s.name}</div>
                              <div className="text-[10px] font-normal opacity-70 mt-0.5">Min: {s.minDailyCount} Personel</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.schedule.map((day) => (
                        <tr key={day.day} className={day.isWeekend ? 'is-weekend' : ''}>
                          <td className="sticky-col align-middle">
                            <div className="flex flex-col items-center justify-center h-full py-1">
                              <span className="text-xl font-bold text-gray-700">{day.day}</span>
                              <span className={`text-[10px] uppercase font-bold px-1.5 rounded ${day.isWeekend ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>
                                {new Date(year, month, day.day).toLocaleString('tr-TR', {weekday: 'short'})}
                              </span>
                            </div>
                          </td>
                          {services.map(service => {
                            const assignments = day.assignments.filter(a => a.serviceId === service.id);
                            return (
                              <td key={service.id}>
                                <div className="flex flex-col gap-1.5 min-h-[50px] justify-center">
                                    {assignments.length > 0 ? assignments.map((a, idx) => {
                                      let badgeClass = 'slot-normal';
                                      if (a.staffId === 'EMPTY') badgeClass = 'slot-empty';
                                      else if (a.isEmergency) badgeClass = 'slot-emergency';
                                      
                                      return (
                                        <div 
                                          key={idx} 
                                          onClick={() => isEditing && setEditingSlot({day: day.day, serviceId: service.id, currentStaffId: a.staffId})}
                                          className={`slot-badge ${badgeClass} ${isEditing ? 'clickable' : ''}`}
                                        >
                                          <div className="flex items-center gap-1.5">
                                             <div className={`w-1.5 h-1.5 rounded-full ${a.isEmergency ? 'bg-red-500' : 'bg-indigo-500'}`}></div>
                                             <span className="font-semibold block truncate text-sm">{a.staffName}</span>
                                          </div>
                                          {a.staffId !== 'EMPTY' && <span className="opacity-75 text-[10px] block pl-3">Kıdem: {a.role}</span>}
                                        </div>
                                      );
                                    }) : (
                                      <span className="text-gray-300 text-center text-xs block py-2 border-2 border-dashed border-gray-100 rounded">-</span>
                                    )}
                                  </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
