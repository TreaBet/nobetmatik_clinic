
import React, { useState, useRef, useMemo } from 'react';
import { Staff, RoleConfig, Group } from '../../../types';
import { Card, Button, Badge, DateSelectModal } from '../../../components/ui';
import { ICONS } from '../../../constants';
import { RefreshCw, FileJson, Upload, Check, X, Trash2, UserPlus } from 'lucide-react';

interface StaffManagerProps {
    staff: Staff[];
    setStaff: React.Dispatch<React.SetStateAction<Staff[]>>;
    roleConfigs: Record<number, RoleConfig>;
    setRoleConfigs: React.Dispatch<React.SetStateAction<Record<number, RoleConfig>>>;
    handleResetData: () => void;
    handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    generateTemplate: () => void;
    handleImportBackup: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleExportBackup: () => void;
    isBlackAndWhite: boolean;
    daysInMonth: number;
}

export const StaffManager: React.FC<StaffManagerProps> = ({
    staff, setStaff, roleConfigs, setRoleConfigs,
    handleResetData, handleFileUpload, generateTemplate,
    handleImportBackup, handleExportBackup, isBlackAndWhite, daysInMonth
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const backupInputRef = useRef<HTMLInputElement>(null);
    const [newStaff, setNewStaff] = useState<Partial<Staff>>({ 
        name: '', role: 2, group: 'Genel', quotaService: 5, quotaEmergency: 2, weekendLimit: 2, offDays: [], requestedDays: [], isActive: true
    });

    const [dateModal, setDateModal] = useState<{ isOpen: boolean, staffId: string, type: 'off' | 'request' } | null>(null);
    const uniqueRoles = useMemo(() => Array.from(new Set(staff.map(s => s.role))).sort((a: number, b: number) => a - b), [staff]);

    const handleAddStaff = () => {
        if (!newStaff.name) return;
        setStaff([...staff, { ...newStaff, id: Date.now().toString(), isActive: true } as Staff]);
        setNewStaff({ name: '', role: 2, group: 'Genel', quotaService: 5, quotaEmergency: 2, weekendLimit: 2, offDays: [], requestedDays: [], isActive: true });
    };

    const handleDeleteStaff = (id: string) => {
        if(window.confirm("Personeli silmek istediğinize emin misiniz?")) {
            setStaff(staff.filter(s => s.id !== id));
        }
    };
    
    const toggleStaffActive = (id: string) => {
        setStaff(staff.map(s => s.id === id ? { ...s, isActive: !s.isActive } : s));
    };

    const updateRoleConfig = (role: number, field: keyof RoleConfig, value: number) => {
        setRoleConfigs(prev => ({
            ...prev,
            [role]: { ...prev[role], role, [field]: value }
        }));
    };

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
        alert(`Tüm Kıdem ${role} doktorları güncellendi.`);
    };

    const openDateModal = (staffId: string, type: 'off' | 'request') => {
        setDateModal({ isOpen: true, staffId, type });
    };

    const handleDateSave = (days: number[]) => {
        if (!dateModal) return;
        setStaff(staff.map(s => {
            if (s.id === dateModal.staffId) {
                return dateModal.type === 'off' ? { ...s, offDays: days } : { ...s, requestedDays: days };
            }
            return s;
        }));
    };

    const inputClass = `w-full rounded-lg shadow-sm p-2.5 border focus:ring-2 focus:ring-indigo-500 outline-none transition-colors ${
        isBlackAndWhite 
        ? '!bg-slate-800 !border-slate-700 text-white placeholder-slate-400' 
        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
    }`;
    
    const smallInputClass = `text-center rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none border transition-colors ${
        isBlackAndWhite 
        ? '!bg-slate-800 !border-slate-600 text-white' 
        : 'bg-white border-gray-300 text-gray-900'
    }`;

    // Helper for buttons in Dark Mode to ensure they remain readable on hover
    const btnClass = `text-xs px-3 ${isBlackAndWhite ? '!bg-slate-800 !text-white !border-slate-700 hover:!bg-slate-700 hover:!text-white' : ''}`;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
             {/* Header & Actions */}
             <div className={`flex flex-col xl:flex-row justify-between items-end gap-4 p-6 rounded-xl border shadow-sm transition-colors ${isBlackAndWhite ? '!bg-slate-900 !border-slate-800' : 'bg-white border-gray-200'}`}>
              <div>
                <h2 className={`text-2xl font-bold ${isBlackAndWhite ? 'text-white' : 'text-gray-900'}`}>Doktor Listesi</h2>
                <p className={`mt-1 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>Grup (A, B, C, D) ve Kıdem bazlı yönetim.</p>
              </div>
              <div className="flex flex-wrap gap-2 w-full xl:w-auto justify-start xl:justify-end">
                 <div style={{ display: 'none' }}>
                    <input type="file" ref={fileInputRef} accept=".xlsx, .xls" onChange={handleFileUpload} />
                    <input type="file" ref={backupInputRef} accept=".json" onChange={handleImportBackup} />
                 </div>
                 
                 <Button variant="secondary" onClick={() => backupInputRef.current?.click()} className={btnClass}>
                    <Upload className="w-3.5 h-3.5" /> Yedek Yükle
                 </Button>

                 <Button variant="secondary" onClick={handleExportBackup} className={btnClass}>
                    <FileJson className="w-3.5 h-3.5" /> Yedek Al
                 </Button>

                 <Button variant="danger" onClick={handleResetData} className="text-xs px-3">
                    <RefreshCw className="w-3.5 h-3.5" /> Sıfırla
                 </Button>

                 <Button variant="secondary" onClick={generateTemplate} className={btnClass}>
                    {ICONS.Template} Taslak
                 </Button>

                 <Button variant="primary" onClick={() => fileInputRef.current?.click()} className={`text-xs px-3 ${isBlackAndWhite ? '!bg-indigo-600 !border-indigo-500' : ''}`}>
                    {ICONS.Upload} Excel
                 </Button>
              </div>
            </div>

            {/* Role Configs */}
            {staff.length > 0 && (
                <Card className={`p-6 border transition-colors hover-lift ${isBlackAndWhite ? '!bg-slate-900 !border-slate-800' : 'bg-indigo-50/30 border-indigo-100'}`}>
                    <div className={`mb-4 flex items-center gap-2 ${isBlackAndWhite ? 'text-white' : 'text-indigo-800'}`}>
                        {ICONS.Settings}
                        <h3 className="font-bold text-lg">Kıdem Bazlı Toplu Ayarlar</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {uniqueRoles.map(role => (
                            <div key={role} className={`p-5 rounded-xl shadow-sm border transition-all flex flex-col gap-4 hover-lift ${isBlackAndWhite ? '!bg-slate-800 !border-slate-700 text-white' : 'bg-white border-gray-200'}`}>
                                <div className="flex justify-between items-center border-b pb-2 border-gray-100/10">
                                    <h4 className="font-bold text-lg">Kıdem {role}</h4>
                                    <Badge color="gray">{staff.filter(s => s.role === role).length} Kişi</Badge>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className={`text-xs font-bold uppercase ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>SERVİS KOTASI</span>
                                        <input type="number" value={roleConfigs[role]?.quotaService ?? 5} onChange={(e) => updateRoleConfig(role, 'quotaService', parseInt(e.target.value))} className={`w-20 ${smallInputClass}`} />
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className={`text-xs font-bold uppercase ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>ACİL KOTASI</span>
                                        <input type="number" value={roleConfigs[role]?.quotaEmergency ?? 2} onChange={(e) => updateRoleConfig(role, 'quotaEmergency', parseInt(e.target.value))} className={`w-20 ${smallInputClass}`} />
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className={`text-xs font-bold uppercase ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>HAFTASONU LİMİT</span>
                                        <input type="number" value={roleConfigs[role]?.weekendLimit ?? 2} onChange={(e) => updateRoleConfig(role, 'weekendLimit', parseInt(e.target.value))} className={`w-20 ${smallInputClass}`} />
                                    </div>
                                </div>
                                <Button variant="secondary" onClick={() => handleApplyRoleConfig(role)} className={`w-full mt-2 text-xs py-2 h-9 ${isBlackAndWhite ? '!bg-slate-700 !border-slate-600 !text-white hover:!bg-slate-600' : ''}`}>
                                    Bu Ayarları Uygula
                                </Button>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* Manual Add Form */}
            <Card className={`p-6 border-l-4 transition-colors hover-lift ${isBlackAndWhite ? '!bg-slate-900 !border-slate-800 border-l-indigo-500' : 'border-l-indigo-500'}`}>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                    <div className="md:col-span-3">
                        <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>AD SOYAD</label>
                        <input type="text" value={newStaff.name} onChange={e => setNewStaff({...newStaff, name: e.target.value})} className={inputClass} placeholder="Örn: Dr. Ahmet" />
                    </div>
                    <div className="md:col-span-2">
                         <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>KIDEM</label>
                         <input type="number" value={newStaff.role} onChange={e => setNewStaff({...newStaff, role: parseInt(e.target.value)})} className={inputClass} />
                    </div>
                    <div className="md:col-span-2">
                        <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>GRUP</label>
                        <select value={newStaff.group} onChange={e => setNewStaff({...newStaff, group: e.target.value as Group})} className={inputClass}>
                            <option value="Genel">Genel</option><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option>
                        </select>
                    </div>
                    <div className="md:col-span-3">
                         <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>HEDEFLER (SRV / ACİL / HS)</label>
                         <div className="flex gap-2">
                             <input type="number" value={newStaff.quotaService} onChange={e => setNewStaff({...newStaff, quotaService: parseInt(e.target.value)})} className={inputClass} placeholder="Srv" />
                             <input type="number" value={newStaff.quotaEmergency} onChange={e => setNewStaff({...newStaff, quotaEmergency: parseInt(e.target.value)})} className={inputClass} placeholder="Acil" />
                             <input type="number" value={newStaff.weekendLimit} onChange={e => setNewStaff({...newStaff, weekendLimit: parseInt(e.target.value)})} className={inputClass} placeholder="HS" />
                         </div>
                    </div>
                    <div className="md:col-span-2">
                        <Button onClick={handleAddStaff} className={`w-full h-[42px] ${isBlackAndWhite ? '!bg-indigo-600 !border-indigo-500 text-white' : ''}`}>
                            <UserPlus className="w-4 h-4 mr-2" /> Ekle
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Staff List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {staff.map(person => (
                    <Card key={person.id} className={`p-4 relative group transition-all border-l-4 hover-lift ${isBlackAndWhite ? `!bg-slate-900 !border-slate-800 !text-white ${person.isActive !== false ? 'border-l-indigo-500' : 'border-l-slate-700 opacity-60'}` : `${person.isActive !== false ? 'border-l-indigo-500' : 'border-l-gray-300 bg-gray-50 opacity-60'}`}`}>
                        <div className="absolute top-4 left-4 z-10" title={person.isActive !== false ? "Personel Aktif" : "Personel Pasif"}>
                            <button onClick={() => toggleStaffActive(person.id)} className={`group relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${person.isActive !== false ? (isBlackAndWhite ? 'bg-emerald-600' : 'bg-indigo-600') : (isBlackAndWhite ? 'bg-slate-700' : 'bg-gray-200 hover:bg-gray-300')}`}>
                                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${person.isActive !== false ? 'translate-x-5' : 'translate-x-0'}`}>
                                    <span className={`absolute inset-0 flex h-full w-full items-center justify-center transition-opacity ${person.isActive !== false ? 'opacity-0' : 'opacity-100'}`} aria-hidden="true"><X className="h-3 w-3 text-gray-400" strokeWidth={3} /></span>
                                    <span className={`absolute inset-0 flex h-full w-full items-center justify-center transition-opacity ${person.isActive !== false ? 'opacity-100' : 'opacity-0'}`} aria-hidden="true"><Check className={`h-3 w-3 ${isBlackAndWhite ? 'text-emerald-600' : 'text-indigo-600'}`} strokeWidth={3} /></span>
                                </span>
                            </button>
                        </div>

                        <button onClick={() => handleDeleteStaff(person.id)} className={`absolute top-3 right-3 transition-colors ${isBlackAndWhite ? 'text-gray-500 hover:text-red-400' : 'text-gray-300 hover:text-red-500'}`}>{ICONS.Trash}</button>
                        
                        <div className="flex items-center gap-3 mb-3 ml-16">
                             <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shrink-0 ${isBlackAndWhite ? (person.isActive !== false ? 'bg-indigo-900 text-indigo-200' : 'bg-slate-800 text-slate-500') : (person.isActive !== false ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200 text-gray-400')}`}>
                                 {person.name.charAt(0)}
                             </div>
                             <div>
                                 <h4 className={`font-bold truncate max-w-[140px] ${person.isActive === false && 'line-through'}`} title={person.name}>{person.name}</h4>
                                 <div className="flex gap-2 text-xs opacity-70">
                                     <span>Kıdem: {person.role}</span>
                                     <span>•</span>
                                     <span>Grup: {person.group}</span>
                                 </div>
                             </div>
                        </div>

                        <div className={`grid grid-cols-3 gap-2 text-center text-xs p-2 rounded-lg mb-4 ${isBlackAndWhite ? 'bg-slate-800' : 'bg-white shadow-sm border border-gray-100'}`}>
                             <div><div className={`font-bold ${person.isActive !== false ? 'text-indigo-500' : 'text-gray-400'}`}>{person.quotaService}</div><div className="opacity-60">Servis</div></div>
                             <div><div className={`font-bold ${person.isActive !== false ? 'text-rose-500' : 'text-gray-400'}`}>{person.quotaEmergency}</div><div className="opacity-60">Acil</div></div>
                             <div><div className={`font-bold ${person.isActive !== false ? 'text-orange-500' : 'text-gray-400'}`}>{person.weekendLimit}</div><div className="opacity-60">H.Sonu</div></div>
                        </div>

                        <div className="flex gap-2">
                             <Button variant="secondary" onClick={() => openDateModal(person.id, 'off')} disabled={person.isActive === false} className={`flex-1 ${btnClass}`}>İzin ({person.offDays.length})</Button>
                             <Button variant="secondary" onClick={() => openDateModal(person.id, 'request')} disabled={person.isActive === false} className={`flex-1 ${btnClass}`}>İstek ({person.requestedDays.length})</Button>
                        </div>
                    </Card>
                ))}
            </div>

            {dateModal && (
                <DateSelectModal 
                    isOpen={dateModal.isOpen}
                    onClose={() => setDateModal(null)}
                    title={dateModal.type === 'off' ? 'İzinli Günleri Seç' : 'Nöbet İstenen Günleri Seç'}
                    selectedDays={dateModal.type === 'off' ? (staff.find(s => s.id === dateModal.staffId)?.offDays || []) : (staff.find(s => s.id === dateModal.staffId)?.requestedDays || [])}
                    onSave={handleDateSave}
                    daysInMonth={daysInMonth}
                    color={dateModal.type === 'off' ? 'red' : 'green'}
                />
            )}
        </div>
    );
};
