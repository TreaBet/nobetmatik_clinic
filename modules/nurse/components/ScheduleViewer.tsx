
import React, { useState, useMemo, useEffect } from 'react';
import { ScheduleResult, Service, Staff, DaySchedule } from '../../../types';
import { Card, Button } from '../../../components/ui';
import { ICONS } from '../../../constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Edit3, Save, Share2, Pencil, RotateCcw, LayoutGrid, Users, Link as LinkIcon, Star, GripVertical, Check, X, Search, AlertTriangle } from 'lucide-react';

interface ScheduleViewerProps {
    result: ScheduleResult;
    setResult: (res: ScheduleResult) => void;
    services: Service[];
    staff: Staff[];
    year: number;
    month: number;
    isBlackAndWhite: boolean;
    handleDownload: () => void;
    isReadOnly?: boolean;
    onShare?: () => void;
}

export const ScheduleViewer: React.FC<ScheduleViewerProps> = ({ result, setResult, services, staff, year, month, isBlackAndWhite, handleDownload, isReadOnly = false, onShare }) => {
    
    // --- View Mode State ---
    const [viewMode, setViewMode] = useState<'daily' | 'staff'>('daily');

    // --- Manual Edit State (Daily View) ---
    const [isEditing, setIsEditing] = useState(false);
    const [editingSlot, setEditingSlot] = useState<{day: number, serviceId: string, currentStaffId: string} | null>(null);
    const [searchTerm, setSearchTerm] = useState("");

    // --- History / Undo State ---
    const [history, setHistory] = useState<DaySchedule[][]>([]);

    // --- Drag & Drop State ---
    const [dragData, setDragData] = useState<{day: number, serviceId: string, staffId: string} | null>(null);
    const [dragOverTarget, setDragOverTarget] = useState<{day: number, serviceId: string, staffId: string} | null>(null);

    // --- Stats Logic ---
    const chartData = useMemo(() => {
        if (!staff || !result) return [];
        return result.stats.map(s => {
          const p = staff.find(st => st.id === s.staffId);
          const displayName = p ? `${p.name} (${p.unit || '-'})` : '?';
          
          return {
            name: displayName,
            unit: p?.unit || '', // Store for sorting
            targetService: p?.quotaService || 0,
            actualService: s.totalShifts,
            weekendShifts: s.weekendShifts
          };
        }).sort((a, b) => (a.unit || "").localeCompare(b.unit || ""));
      }, [result, staff]);

    // Calculate dynamic width for the chart to allow scrolling
    const chartWidth = useMemo(() => {
        return Math.max(800, chartData.length * 60); // 60px per bar group
    }, [chartData]);

    const fairnessScore = useMemo(() => {
        if (!staff || !result) return { stdDev: "0", reqRate: 0 };
        const totalShifts = result.stats.map(s => s.totalShifts);
        const mean = totalShifts.reduce((a,b) => a+b, 0) / totalShifts.length;
        const variance = totalShifts.reduce((a,b) => a + Math.pow(b - mean, 2), 0) / totalShifts.length;
        const stdDev = Math.sqrt(variance);

        let totalReqs = 0;
        let metReqs = 0;
        staff.forEach(s => {
            totalReqs += s.requestedDays.length;
            s.requestedDays.forEach(day => {
                const daySchedule = result.schedule.find(ds => ds.day === day);
                if (daySchedule?.assignments.some(a => a.staffId === s.id)) metReqs++;
            });
        });
        const reqRate = totalReqs === 0 ? 100 : Math.round((metReqs / totalReqs) * 100);

        return { stdDev: stdDev.toFixed(2), reqRate };
    }, [result, staff]);

    // --- Helper Functions ---
    const addToHistory = () => {
        const snapshot = JSON.parse(JSON.stringify(result.schedule));
        setHistory(prev => [...prev.slice(-19), snapshot]); 
    };

    const handleUndo = () => {
        if (history.length === 0) return;
        const previousSchedule = history[history.length - 1];
        const newHistory = history.slice(0, -1);
        setHistory(newHistory);
        recalculateStats(previousSchedule); 
    };

    const recalculateStats = (newSchedule: DaySchedule[]) => {
        const newStats = staff.map(s => {
            let total = 0, serviceCount = 0, emergency = 0, weekend = 0, sat = 0, sun = 0;
            newSchedule.forEach(day => {
                const assignment = day.assignments.find(a => a.staffId === s.id);
                if(assignment) {
                    total++;
                    if (assignment.isEmergency) emergency++; else serviceCount++;
                    const date = new Date(year, month, day.day);
                    const d = date.getDay();
                    if (d === 0 || d === 6) weekend++; 
                    if (d === 6) sat++;
                    if (d === 0) sun++;
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

    // --- Daily View Edit Logic ---
    const handleUpdateAssignment = (newStaffId: string) => {
        if (!editingSlot) return;
        addToHistory();
        updateAssignment(editingSlot.day, editingSlot.serviceId, editingSlot.currentStaffId, newStaffId);
        setEditingSlot(null);
        setSearchTerm("");
    };

    const updateAssignment = (day: number, serviceId: string, oldStaffId: string, newStaffId: string) => {
        const newSchedule = [...result.schedule];
        const dayData = newSchedule.find(d => d.day === day);
        if(!dayData) return;

        const targetAssignmentIndex = dayData.assignments.findIndex(a => a.serviceId === serviceId && a.staffId === oldStaffId);
        if(targetAssignmentIndex === -1) return;

        const newStaffMember = staff.find(s => s.id === newStaffId);
        const isRemoving = newStaffId === 'EMPTY';
        
        const existingIsEmergency = dayData.assignments[targetAssignmentIndex].isEmergency;

        const updatedAssignment = {
            ...dayData.assignments[targetAssignmentIndex],
            staffId: isRemoving ? 'EMPTY' : newStaffMember!.id,
            staffName: isRemoving ? 'BOŞ' : newStaffMember!.name,
            role: isRemoving ? 0 : newStaffMember!.role,
            group: isRemoving ? 'Genel' : newStaffMember!.group,
            unit: isRemoving ? '' : newStaffMember!.unit,
            isEmergency: existingIsEmergency
        };

        dayData.assignments[targetAssignmentIndex] = updatedAssignment as any;
        recalculateStats(newSchedule);
    };

    // --- Drag & Drop ---
    const handleDragStart = (e: React.DragEvent, day: number, serviceId: string, staffId: string) => {
        if(!isEditing) return;
        setDragData({ day, serviceId, staffId });
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        if(!isEditing) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDragEnter = (e: React.DragEvent, day: number, serviceId: string, staffId: string) => {
        if(!isEditing || !dragData) return;
        if (dragData.day === day && dragData.serviceId === serviceId && dragData.staffId === staffId) return;
        setDragOverTarget({ day, serviceId, staffId });
    };

    const handleDrop = (e: React.DragEvent, targetDay: number, targetServiceId: string, targetStaffId: string) => {
        if(!isEditing || !dragData) return;
        e.preventDefault();
        setDragOverTarget(null);
        
        if (dragData.day === targetDay && dragData.serviceId === targetServiceId && dragData.staffId === targetStaffId) {
            setDragData(null);
            return;
        }

        addToHistory(); 

        const newSchedule = [...result.schedule];
        const sourceDay = newSchedule.find(d => d.day === dragData.day);
        const targetDayObj = newSchedule.find(d => d.day === targetDay);
        
        if(!sourceDay || !targetDayObj) return;

        const sourceIdx = sourceDay.assignments.findIndex(a => a.serviceId === dragData.serviceId && a.staffId === dragData.staffId);
        const targetIdx = targetDayObj.assignments.findIndex(a => a.serviceId === targetServiceId && a.staffId === targetStaffId);

        if(sourceIdx === -1 || targetIdx === -1) return;

        const sourceAssignment = sourceDay.assignments[sourceIdx];
        const targetAssignment = targetDayObj.assignments[targetIdx];

        sourceDay.assignments[sourceIdx] = {
            ...sourceAssignment,
            staffId: targetAssignment.staffId,
            staffName: targetAssignment.staffName,
            role: targetAssignment.role,
            group: targetAssignment.group,
            unit: targetAssignment.unit
        };

        targetDayObj.assignments[targetIdx] = {
            ...targetAssignment,
            staffId: sourceAssignment.staffId,
            staffName: sourceAssignment.staffName,
            role: sourceAssignment.role,
            group: sourceAssignment.group,
            unit: sourceAssignment.unit
        };

        recalculateStats(newSchedule);
        setDragData(null);
    };

    const getAvailableStaffForEdit = () => {
        if(!editingSlot) return [];
        const daySchedule = result.schedule.find(s => s.day === editingSlot.day);
        if(!daySchedule) return [];
        
        const assignedStaffIds = new Set(daySchedule.assignments.map(a => a.staffId));
        
        let candidates = staff.filter(s => {
            if (assignedStaffIds.has(s.id) && s.id !== editingSlot.currentStaffId) return false;
            if (s.offDays.includes(editingSlot.day)) return false;
            return true;
        });

        if (searchTerm) {
            const lower = searchTerm.toLocaleLowerCase('tr-TR');
            candidates = candidates.filter(s => s.name.toLocaleLowerCase('tr-TR').includes(lower));
        }

        return candidates;
    };

    // Sorting staff for matrix view
    const sortedStaff = useMemo(() => {
        return [...staff].sort((a, b) => {
            const unitA = a.unit || "";
            const unitB = b.unit || "";
            return unitA.localeCompare(unitB) || a.name.localeCompare(b.name);
        });
    }, [staff]);

    // Determine colors for Unfilled Slots Card
    const unfilledCount = result.unfilledSlots;
    const isSuccess = unfilledCount === 0;

    // Use effect to focus search
    useEffect(() => {
        if (editingSlot) {
            const input = document.getElementById('staff-search-input');
            if(input) input.focus();
        }
    }, [editingSlot]);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Scorecard */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className={`p-4 md:p-5 border-l-4 shadow-sm transition-all hover:shadow-md ${isBlackAndWhite ? 'bg-slate-900 border-slate-700 border-l-emerald-500 text-white' : 'border-l-emerald-500'}`}>
                     <div className={`text-[10px] md:text-xs font-bold uppercase tracking-wider opacity-60 mb-1 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>Toplam Atama</div>
                     <div className={`text-2xl md:text-3xl font-bold ${isBlackAndWhite ? 'text-emerald-400' : 'text-gray-900'}`}>
                       {result.schedule.reduce((acc, day) => acc + day.assignments.filter(a => a.staffId !== 'EMPTY').length, 0)}
                     </div>
                  </Card>
                  
                  <Card className={`p-4 md:p-5 border-l-4 shadow-sm transition-all hover:shadow-md ${isBlackAndWhite 
                        ? (isSuccess ? 'bg-slate-900 border-slate-700 border-l-emerald-500 text-white' : 'bg-slate-900 border-slate-700 border-l-rose-500 text-white') 
                        : (isSuccess ? 'border-l-emerald-500' : 'border-l-rose-500')}`}>
                     <div className={`text-[10px] md:text-xs font-bold uppercase tracking-wider opacity-60 mb-1 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>Boş Kalan</div>
                     <div className={`text-2xl md:text-3xl font-bold ${
                         isBlackAndWhite 
                            ? (isSuccess ? 'text-emerald-400' : 'text-rose-400') 
                            : (isSuccess ? 'text-emerald-600' : 'text-rose-600')
                     }`}>
                       {result.unfilledSlots}
                     </div>
                  </Card>

                  <Card className={`p-4 md:p-5 border-l-4 shadow-sm transition-all hover:shadow-md ${isBlackAndWhite ? 'bg-slate-900 border-slate-700 border-l-indigo-500 text-white' : 'border-l-indigo-500'}`}>
                     <div className={`text-[10px] md:text-xs font-bold uppercase tracking-wider opacity-60 mb-1 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>Adalet Puanı (SD)</div>
                     <div className="flex items-end gap-2">
                        <div className={`text-2xl md:text-3xl font-bold ${isBlackAndWhite ? 'text-indigo-400' : 'text-indigo-600'}`}>{fairnessScore.stdDev}</div>
                     </div>
                  </Card>
                  <Card className={`p-4 md:p-5 border-l-4 shadow-sm transition-all hover:shadow-md ${isBlackAndWhite ? 'bg-slate-900 border-slate-700 border-l-blue-500 text-white' : 'border-l-blue-500'}`}>
                     <div className={`text-[10px] md:text-xs font-bold uppercase tracking-wider opacity-60 mb-1 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>İstek Karşılama</div>
                     <div className={`text-2xl md:text-3xl font-bold ${isBlackAndWhite ? 'text-blue-400' : 'text-blue-600'}`}>%{fairnessScore.reqRate}</div>
                  </Card>
            </div>

            {/* Actions Bar - View Switcher & Buttons */}
            <div className={`flex flex-col xl:flex-row justify-between items-center p-3 rounded-xl border shadow-sm gap-3 ${isBlackAndWhite ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'}`}>
                 
                 {/* VIEW MODE SWITCHER */}
                 <div className={`flex p-1 rounded-lg border ${isBlackAndWhite ? 'bg-slate-800 border-slate-700' : 'bg-gray-100 border-gray-200'}`}>
                    <button 
                        onClick={() => setViewMode('daily')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${viewMode === 'daily' ? (isBlackAndWhite ? 'bg-slate-600 text-white shadow' : 'bg-white text-indigo-600 shadow') : (isBlackAndWhite ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-800')}`}
                    >
                        <LayoutGrid className="w-3.5 h-3.5" /> Günlük
                    </button>
                    <button 
                        onClick={() => setViewMode('staff')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${viewMode === 'staff' ? (isBlackAndWhite ? 'bg-slate-600 text-white shadow' : 'bg-white text-indigo-600 shadow') : (isBlackAndWhite ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-800')}`}
                    >
                        <Users className="w-3.5 h-3.5" /> Personel
                    </button>
                 </div>

                 <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-center sm:justify-end">
                    <Button variant="secondary" onClick={handleDownload} className={`text-xs h-9 flex-1 sm:flex-none ${isBlackAndWhite ? 'bg-slate-800 text-white border-slate-700 hover:bg-slate-700' : ''}`}>
                       {ICONS.Excel} Excel
                    </Button>
                    {!isReadOnly && onShare && (
                        <Button variant="secondary" onClick={onShare} className={`text-xs h-9 flex-1 sm:flex-none text-indigo-700 bg-indigo-50 border-indigo-200 hover:bg-indigo-100 ${isBlackAndWhite ? 'bg-slate-800 text-indigo-300 border-slate-700 hover:bg-slate-700' : ''}`}>
                            <LinkIcon className="w-4 h-4 mr-1" /> Link
                        </Button>
                    )}
                    {!isReadOnly && history.length > 0 && (
                        <Button variant="secondary" onClick={handleUndo} className={`text-xs h-9 flex-1 sm:flex-none text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-200 ${isBlackAndWhite ? 'bg-slate-800 text-amber-400 border-slate-700 hover:bg-slate-700' : ''}`}>
                            <RotateCcw className="w-4 h-4 mr-1" /> Geri Al
                        </Button>
                    )}
                    
                    {!isReadOnly && viewMode === 'daily' && (
                         <Button variant="secondary" onClick={() => setIsEditing(!isEditing)} className={`text-xs h-9 w-full sm:w-auto ${isEditing ? (isBlackAndWhite ? 'bg-indigo-900/50 text-indigo-200 border-indigo-500' : 'bg-indigo-50 text-indigo-800 border-indigo-200') : (isBlackAndWhite ? 'bg-slate-800 text-white border-slate-700 hover:bg-slate-700' : '')}`}>
                            {isEditing ? <Save className="w-3.5 h-3.5"/> : <Edit3 className="w-3.5 h-3.5"/>}
                            {isEditing ? 'Bitti' : 'Düzenle'}
                        </Button>
                    )}
                 </div>
            </div>

            {/* Chart */}
            <Card className={`p-4 md:p-6 shadow-md overflow-hidden ${isBlackAndWhite ? 'bg-slate-900 border-slate-700 text-white' : ''}`}>
                  <div className="flex items-center gap-2 mb-4 md:mb-6">
                      <div className={`w-1 h-6 rounded-full ${isBlackAndWhite ? 'bg-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.5)]' : 'bg-indigo-500'}`}></div>
                      <h3 className={`font-bold text-lg ${isBlackAndWhite ? 'text-white' : 'text-gray-900'}`}>Hedef Tutarlılığı Grafiği</h3>
                  </div>
                  <div className="w-full overflow-x-auto pb-4 custom-scrollbar">
                      <div style={{ width: `${chartWidth}px`, height: '400px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }} barGap={4}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isBlackAndWhite ? "#374151" : "#e5e7eb"} />
                            <XAxis dataKey="name" tick={{fontSize: 11, fill: isBlackAndWhite ? '#d1d5db' : '#4b5563', fontWeight: 600}} interval={0} angle={-45} textAnchor="end" height={80} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: isBlackAndWhite ? '#d1d5db' : '#4b5563', fontSize: 12 }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid ' + (isBlackAndWhite ? '#334155' : '#e5e7eb'), boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px', backgroundColor: isBlackAndWhite ? '#1e293b' : 'white', color: isBlackAndWhite ? 'white' : 'black' }} cursor={{fill: isBlackAndWhite ? '#1e293b' : '#f3f4f6'}} />
                            <Legend verticalAlign="top" iconType="circle" wrapperStyle={{paddingBottom: '20px'}}/>
                            <Bar dataKey="targetService" name="Hedef (Toplam)" fill={isBlackAndWhite ? '#4f46e5' : '#e0e7ff'} radius={[4, 4, 0, 0]} />
                            <Bar dataKey="actualService" name="Gerçekleşen" fill={isBlackAndWhite ? '#818cf8' : '#4f46e5'} radius={[4, 4, 0, 0]} />
                            <Bar dataKey="weekendShifts" name="Haftasonu" fill={isBlackAndWhite ? '#fb7185' : '#f43f5e'} radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                  </div>
            </Card>

            {/* Schedule Table (Grid) */}
            {viewMode === 'daily' && (
                <Card className={`shadow-lg border-0 ${isBlackAndWhite ? 'bg-slate-900' : ''}`}>
                    <div className="report-table-container overflow-x-auto">
                      <table className="report-table w-full">
                        <thead>
                          <tr>
                            <th className={`sticky-col w-20 md:w-28 shadow-sm z-30 text-center ${isBlackAndWhite ? 'bg-slate-950 text-white border-b border-slate-700' : 'bg-white text-gray-800'}`}>GÜN</th>
                            {services.map(s => (
                              <th key={s.id} className={`min-w-[150px] md:min-w-[180px] ${isBlackAndWhite ? 'bg-slate-950 text-white border-b border-slate-700' : ''}`}>
                                  <div className="truncate uppercase font-extrabold text-[11px] tracking-widest">{s.name}</div>
                                  <div className="text-[9px] font-medium opacity-50 mt-0.5">MİN: {s.minDailyCount} PERSONEL</div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {result.schedule.map((day, index) => {
                              const isHoliday = day.isHoliday;
                              const isWeekend = day.isWeekend;
                              return (
                                <tr key={day.day} className={`${isWeekend || isHoliday ? 'is-weekend' : ''} ${index % 2 === 0 ? 'bg-slate-900/50' : ''}`}>
                                  {/* Day Column */}
                                  <td className={`sticky-col p-0 border-r border-b ${isBlackAndWhite ? 'bg-slate-950 border-slate-800 text-slate-200' : 'border-gray-100'}`} style={{ height: '1px' }}>
                                    <div className={`flex flex-col items-center justify-center h-full min-h-[70px] w-full ${isHoliday ? (isBlackAndWhite ? 'bg-red-900/20' : 'bg-red-50') : 'bg-inherit'}`}>
                                      <span className={`text-2xl font-black leading-none tracking-tight ${isHoliday ? 'text-red-500' : (isBlackAndWhite ? 'text-white' : 'text-gray-800')}`}>{day.day}</span>
                                      <span className={`text-[10px] uppercase font-bold tracking-wider mt-1 ${isHoliday ? 'text-red-400' : (isWeekend ? (isBlackAndWhite ? 'text-slate-400' : 'text-indigo-600') : (isBlackAndWhite ? 'text-slate-600' : 'text-gray-400'))}`}>
                                        {new Date(year, month, day.day).toLocaleString('tr-TR', {weekday: 'short'})}
                                      </span>
                                    </div>
                                  </td>
                                  
                                  {/* Service Columns */}
                                  {services.map(service => {
                                    const assignments = day.assignments.filter(a => a.serviceId === service.id);
                                    return (
                                      <td key={service.id} 
                                        className={`align-top h-full p-2 border-b border-r ${isBlackAndWhite ? 'border-slate-800 bg-slate-900' : 'border-gray-100'} ${isHoliday ? (isBlackAndWhite ? 'bg-red-900/5' : 'bg-red-50/10') : ''}`}
                                        style={{ height: '1px' }}
                                        onDragOver={isEditing ? handleDragOver : undefined}
                                        onDrop={isEditing ? (e) => handleDrop(e, day.day, service.id, "dummy") : undefined} // Fallback drop
                                      >
                                        <div className="flex flex-col gap-1.5 min-h-[40px] h-full justify-start">
                                            {assignments.length > 0 ? assignments.map((a, idx) => {
                                              let bgClass = isBlackAndWhite ? 'bg-slate-800' : 'bg-white shadow-sm border border-gray-100';
                                              let textClass = isBlackAndWhite ? 'text-slate-200' : 'text-gray-800';
                                              
                                              if (a.staffId === 'EMPTY') {
                                                  bgClass = isBlackAndWhite ? 'bg-slate-900 border border-dashed border-slate-700' : 'bg-gray-50 border border-dashed border-gray-300';
                                                  textClass = 'text-gray-400 italic';
                                              }
                                              
                                              const staffMember = staff.find(s => s.id === a.staffId);
                                              const isSenior = staffMember?.role === 1;
                                              const isDraggable = isEditing;
                                              
                                              // Drag State
                                              const isDraggingItem = dragData && dragData.day === day.day && dragData.serviceId === service.id && dragData.staffId === a.staffId;
                                              const isDropTarget = dragOverTarget && dragOverTarget.day === day.day && dragOverTarget.serviceId === service.id && dragOverTarget.staffId === a.staffId;

                                              if (isDraggingItem) bgClass = isBlackAndWhite ? 'bg-indigo-900/40 border border-indigo-500' : 'bg-indigo-50 border border-indigo-300';
                                              if (isDropTarget) bgClass = isBlackAndWhite ? 'bg-emerald-900/40 border border-emerald-500' : 'bg-emerald-50 border border-emerald-300';

                                              const dotColor = a.isEmergency 
                                                  ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]' 
                                                  : (isBlackAndWhite ? 'bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.6)]' : 'bg-indigo-500');

                                              return (
                                                <div 
                                                  key={idx} 
                                                  draggable={isDraggable}
                                                  onDragStart={isDraggable ? (e) => handleDragStart(e, day.day, service.id, a.staffId) : undefined}
                                                  onDrop={isDraggable ? (e) => handleDrop(e, day.day, service.id, a.staffId) : undefined}
                                                  onDragEnter={isDraggable ? (e) => handleDragEnter(e, day.day, service.id, a.staffId) : undefined}
                                                  onClick={(e) => {
                                                      if (isEditing) {
                                                          e.stopPropagation();
                                                          setEditingSlot({day: day.day, serviceId: service.id, currentStaffId: a.staffId});
                                                      }
                                                  }}
                                                  className={`
                                                      relative group/slot flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200
                                                      ${bgClass} ${isEditing ? 'cursor-move hover:ring-2 hover:ring-indigo-500/50' : 'cursor-default'}
                                                      ${isDraggingItem ? 'opacity-50 scale-95' : 'opacity-100'}
                                                  `}
                                                >
                                                   <div className="flex items-center gap-2.5 overflow-hidden">
                                                       <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${a.staffId === 'EMPTY' ? 'hidden' : dotColor}`}></div>
                                                       <span className={`truncate text-xs font-bold ${textClass}`}>{a.staffName}</span>
                                                   </div>
                                                   {isSenior && a.staffId !== 'EMPTY' && (
                                                       <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0 ml-1 drop-shadow-sm" />
                                                   )}
                                                   {isEditing && (
                                                       <GripVertical className="absolute right-1 w-3 h-3 text-gray-500 opacity-0 group-hover/slot:opacity-50" />
                                                   )}
                                                </div>
                                              );
                                            }) : (
                                              <span className={`text-center text-[10px] block py-4 border border-dashed rounded-lg h-full flex items-center justify-center select-none opacity-20 ${isBlackAndWhite ? 'border-slate-700 text-slate-500' : 'border-gray-200 text-gray-400'}`}>-</span>
                                            )}
                                          </div>
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                          })}
                        </tbody>
                      </table>
                    </div>
                </Card>
            )}

            {/* Editing Dropdown (Same as previous, just ensuring styles match) */}
            {editingSlot && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4 animate-fade-in"
                    onClick={() => setEditingSlot(null)}
                >
                    <div 
                        className={`rounded-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[70vh] transition-all transform animate-scale-in shadow-2xl ring-1 ${isBlackAndWhite ? 'bg-slate-800 border-slate-700 ring-white/10' : 'bg-white border-gray-200 ring-black/5'}`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className={`p-4 flex justify-between items-center shrink-0 border-b ${isBlackAndWhite ? 'border-slate-700 bg-slate-900/90 text-white' : 'border-gray-100 bg-gray-50/90 text-gray-900'}`}>
                             <div>
                                <h3 className="font-bold text-sm">Nöbet Değiştir</h3>
                                <div className="text-[11px] opacity-70 uppercase tracking-wide font-medium mt-0.5">{editingSlot.day} {new Date(year, month, editingSlot.day).toLocaleString('tr-TR', {month:'long'})}</div>
                             </div>
                             <button onClick={() => setEditingSlot(null)} className="p-1.5 rounded-full hover:bg-black/10 transition-colors"><X className="w-4 h-4" /></button>
                        </div>
                        <div className={`p-3 border-b ${isBlackAndWhite ? 'border-slate-700 bg-slate-800' : 'border-slate-100 bg-white'}`}>
                             <div className="relative">
                                 <Search className={`w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 ${isBlackAndWhite ? 'text-gray-400' : 'text-slate-400'}`} />
                                 <input 
                                    id="staff-search-input"
                                    type="text" 
                                    placeholder="Personel ara..." 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className={`w-full text-sm rounded-lg pl-9 pr-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow ${isBlackAndWhite ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400' : 'bg-white border-gray-200 text-gray-800 placeholder-gray-400'}`}
                                    autoComplete="off"
                                 />
                             </div>
                        </div>
                        <div className={`flex-1 overflow-y-auto p-1.5 custom-scrollbar ${isBlackAndWhite ? 'bg-slate-800' : 'bg-white'}`}>
                            <div className="space-y-1">
                                <button 
                                    onClick={() => handleUpdateAssignment('EMPTY')}
                                    className={`w-full px-3 py-2.5 text-left rounded-lg flex justify-between items-center group transition-all ${isBlackAndWhite ? 'hover:bg-slate-700' : 'hover:bg-rose-50'}`}
                                >
                                    <span className="text-rose-500 font-bold text-sm group-hover:text-rose-600 flex items-center gap-2">
                                        <X className="w-4 h-4" /> Nöbeti Boşalt
                                    </span>
                                </button>
                                {getAvailableStaffForEdit().map(s => {
                                    const isActive = s.id === editingSlot.currentStaffId;
                                    const isSenior = s.role === 1;
                                    return (
                                        <button 
                                            key={s.id}
                                            onClick={() => handleUpdateAssignment(s.id)}
                                            className={`w-full px-3 py-2.5 text-left rounded-lg flex justify-between items-center transition-all group ${isActive ? (isBlackAndWhite ? 'bg-indigo-900/40 text-indigo-100 border border-indigo-700/50' : 'bg-indigo-50 text-indigo-700 border border-indigo-200') : (isBlackAndWhite ? 'hover:bg-slate-700/80 text-slate-300 border border-transparent' : 'hover:bg-gray-50 text-gray-700 border border-transparent')}`}
                                        >
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-semibold">{s.name}</span>
                                                    {isSenior && <Star className="w-3 h-3 text-amber-400 fill-amber-400" />}
                                                </div>
                                                <div className="text-[10px] opacity-60 mt-0.5">{s.unit}</div>
                                            </div>
                                            {isActive && <Check className={`w-4 h-4 ${isBlackAndWhite ? 'text-indigo-400' : 'text-indigo-600'}`} />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
