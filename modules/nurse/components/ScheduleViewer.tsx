
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ScheduleResult, Service, Staff, DaySchedule, ShiftAssignment } from '../../../types';
import { Card, Button } from '../../../components/ui';
import { ICONS } from '../../../constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Edit3, Save, Share2, RotateCcw, LayoutGrid, Users, Link as LinkIcon, Star, GripVertical, Check, X, Search, Calendar as CalendarIcon, Clipboard } from 'lucide-react';

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

// --- MEMOIZED COMPONENTS FOR PERFORMANCE ---

interface AssignmentCellProps {
    assignment: ShiftAssignment;
    day: number;
    serviceId: string;
    isEditing: boolean;
    staffList: Staff[];
    isBlackAndWhite: boolean;
    dragData: {day: number, serviceId: string, staffId: string} | null;
    dragOverTarget: {day: number, serviceId: string, staffId: string} | null;
    onDragStart: (e: React.DragEvent, day: number, serviceId: string, staffId: string) => void;
    onDrop: (e: React.DragEvent, day: number, serviceId: string, staffId: string) => void;
    onDragEnter: (e: React.DragEvent, day: number, serviceId: string, staffId: string) => void;
    onCellClick: (day: number, serviceId: string, staffId: string) => void;
}

const AssignmentCell = React.memo(({ 
    assignment, day, serviceId, isEditing, staffList, isBlackAndWhite, 
    dragData, dragOverTarget, onDragStart, onDrop, onDragEnter, onCellClick 
}: AssignmentCellProps) => {
    
    let bgClass = isBlackAndWhite ? 'bg-slate-800' : 'bg-white shadow-sm border border-gray-100';
    let textClass = isBlackAndWhite ? 'text-slate-200' : 'text-gray-800';
    
    if (assignment.staffId === 'EMPTY') {
        bgClass = isBlackAndWhite ? 'bg-slate-900 border border-dashed border-slate-700' : 'bg-gray-50 border border-dashed border-gray-300';
        textClass = 'text-gray-400 italic';
    }
    
    const staffMember = staffList.find(s => s.id === assignment.staffId);
    const isSenior = staffMember?.role === 1;
    
    // Drag State
    const isDraggingItem = dragData && dragData.day === day && dragData.serviceId === serviceId && dragData.staffId === assignment.staffId;
    const isDropTarget = dragOverTarget && dragOverTarget.day === day && dragOverTarget.serviceId === serviceId && dragOverTarget.staffId === assignment.staffId;

    if (isDraggingItem) bgClass = isBlackAndWhite ? 'bg-indigo-900/40 border border-indigo-500' : 'bg-indigo-50 border border-indigo-300';
    if (isDropTarget) bgClass = isBlackAndWhite ? 'bg-emerald-900/40 border border-emerald-500' : 'bg-emerald-50 border border-emerald-300';

    const dotColor = assignment.isEmergency 
        ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]' 
        : (isBlackAndWhite ? 'bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.6)]' : 'bg-indigo-500');

    return (
        <div 
            draggable={isEditing}
            onDragStart={isEditing ? (e) => onDragStart(e, day, serviceId, assignment.staffId) : undefined}
            onDrop={isEditing ? (e) => onDrop(e, day, serviceId, assignment.staffId) : undefined}
            onDragEnter={isEditing ? (e) => onDragEnter(e, day, serviceId, assignment.staffId) : undefined}
            onClick={(e) => {
                if (isEditing) {
                    e.stopPropagation();
                    onCellClick(day, serviceId, assignment.staffId);
                }
            }}
            className={`
                relative group/slot flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200
                ${bgClass} ${isEditing ? 'cursor-move hover:ring-2 hover:ring-indigo-500/50' : 'cursor-default'}
                ${isDraggingItem ? 'opacity-50 scale-95' : 'opacity-100'}
            `}
        >
            <div className="flex items-center gap-2.5 overflow-hidden">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${assignment.staffId === 'EMPTY' ? 'hidden' : dotColor}`}></div>
                <span className={`truncate text-xs font-bold ${textClass}`}>{assignment.staffName}</span>
            </div>
            {isSenior && assignment.staffId !== 'EMPTY' && (
                <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0 ml-1 drop-shadow-sm" />
            )}
            {isEditing && (
                <GripVertical className="absolute right-1 w-3 h-3 text-gray-500 opacity-0 group-hover/slot:opacity-50" />
            )}
        </div>
    );
});

interface DayRowProps {
    day: DaySchedule;
    index: number;
    services: Service[];
    isEditing: boolean;
    staffList: Staff[];
    isBlackAndWhite: boolean;
    year: number;
    month: number;
    dragData: any;
    dragOverTarget: any;
    onDragStart: any;
    onDrop: any;
    onDragEnter: any;
    onDragOver: any;
    onCellClick: any;
}

const DayRow = React.memo(({ 
    day, index, services, isEditing, staffList, isBlackAndWhite, year, month,
    dragData, dragOverTarget, onDragStart, onDrop, onDragEnter, onDragOver, onCellClick
}: DayRowProps) => {
    const isHoliday = day.isHoliday;
    const isWeekend = day.isWeekend;

    return (
        <tr className={`${isWeekend || isHoliday ? 'is-weekend' : ''} ${index % 2 === 0 ? 'bg-slate-900/50' : ''}`}>
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
                        onDragOver={isEditing ? onDragOver : undefined}
                        onDrop={isEditing ? (e) => onDrop(e, day.day, service.id, "dummy") : undefined}
                    >
                        <div className="flex flex-col gap-1.5 min-h-[40px] h-full justify-start">
                            {assignments.length > 0 ? assignments.map((a, idx) => (
                                <AssignmentCell 
                                    key={idx}
                                    assignment={a}
                                    day={day.day}
                                    serviceId={service.id}
                                    isEditing={isEditing}
                                    staffList={staffList}
                                    isBlackAndWhite={isBlackAndWhite}
                                    dragData={dragData}
                                    dragOverTarget={dragOverTarget}
                                    onDragStart={onDragStart}
                                    onDrop={onDrop}
                                    onDragEnter={onDragEnter}
                                    onCellClick={onCellClick}
                                />
                            )) : (
                                <span className={`text-center text-[10px] block py-4 border border-dashed rounded-lg h-full flex items-center justify-center select-none opacity-20 ${isBlackAndWhite ? 'border-slate-700 text-slate-500' : 'border-gray-200 text-gray-400'}`}>-</span>
                            )}
                        </div>
                    </td>
                );
            })}
        </tr>
    );
});

export const ScheduleViewer: React.FC<ScheduleViewerProps> = ({ result, setResult, services, staff, year, month, isBlackAndWhite, handleDownload, isReadOnly = false, onShare }) => {
    
    const [viewMode, setViewMode] = useState<'daily' | 'staff'>('daily');
    const [isEditing, setIsEditing] = useState(false);
    const [editingSlot, setEditingSlot] = useState<{day: number, serviceId: string, currentStaffId: string} | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [history, setHistory] = useState<DaySchedule[][]>([]);
    
    // Drag & Drop State
    const [dragData, setDragData] = useState<{day: number, serviceId: string, staffId: string} | null>(null);
    const [dragOverTarget, setDragOverTarget] = useState<{day: number, serviceId: string, staffId: string} | null>(null);

    // WhatsApp Modal State
    const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);

    // --- Stats Logic ---
    const chartData = useMemo(() => {
        if (!staff || !result) return [];
        return result.stats.map(s => {
          const p = staff.find(st => st.id === s.staffId);
          const displayName = p ? `${p.name} (${p.unit || '-'})` : '?';
          
          return {
            name: displayName,
            unit: p?.unit || '', 
            targetService: p?.quotaService || 0,
            actualService: s.totalShifts,
            weekendShifts: s.weekendShifts
          };
        }).sort((a, b) => (a.unit || "").localeCompare(b.unit || ""));
      }, [result, staff]);

    const chartWidth = useMemo(() => Math.max(800, chartData.length * 60), [chartData]);

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
    const addToHistory = useCallback(() => {
        const snapshot = structuredClone(result.schedule);
        setHistory(prev => [...prev.slice(-19), snapshot]); 
    }, [result.schedule]);

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

        setResult({ ...result, schedule: newSchedule, stats: newStats, unfilledSlots: unfilled });
    };

    const handleUpdateAssignment = (newStaffId: string) => {
        if (!editingSlot) return;
        addToHistory();
        
        const newSchedule = [...result.schedule];
        const dayData = newSchedule.find(d => d.day === editingSlot.day);
        if(!dayData) return;

        const targetAssignmentIndex = dayData.assignments.findIndex(a => a.serviceId === editingSlot.serviceId && a.staffId === editingSlot.currentStaffId);
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
        
        setEditingSlot(null);
        setSearchTerm("");
    };

    // --- Drag & Drop Handlers (Memoized) ---
    const handleDragStart = useCallback((e: React.DragEvent, day: number, serviceId: string, staffId: string) => {
        if(!isEditing) return;
        setDragData({ day, serviceId, staffId });
        e.dataTransfer.effectAllowed = 'move';
    }, [isEditing]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        if(!isEditing) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }, [isEditing]);

    const handleDragEnter = useCallback((e: React.DragEvent, day: number, serviceId: string, staffId: string) => {
        if(!isEditing || !dragData) return;
        if (dragData.day === day && dragData.serviceId === serviceId && dragData.staffId === staffId) return;
        setDragOverTarget({ day, serviceId, staffId });
    }, [isEditing, dragData]);

    const handleDrop = useCallback((e: React.DragEvent, targetDay: number, targetServiceId: string, targetStaffId: string) => {
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

        sourceDay.assignments[sourceIdx] = { ...sourceAssignment, staffId: targetAssignment.staffId, staffName: targetAssignment.staffName, role: targetAssignment.role, group: targetAssignment.group, unit: targetAssignment.unit };
        targetDayObj.assignments[targetIdx] = { ...targetAssignment, staffId: sourceAssignment.staffId, staffName: sourceAssignment.staffName, role: sourceAssignment.role, group: sourceAssignment.group, unit: sourceAssignment.unit };

        recalculateStats(newSchedule);
        setDragData(null);
    }, [isEditing, dragData, result.schedule, addToHistory]);

    const handleCellClick = useCallback((day: number, serviceId: string, staffId: string) => {
        setEditingSlot({day, serviceId, currentStaffId: staffId});
    }, []);

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

    const isSuccess = result.unfilledSlots === 0;

    useEffect(() => {
        if (editingSlot) {
            const input = document.getElementById('staff-search-input');
            if(input) input.focus();
        }
    }, [editingSlot]);

    // --- WhatsApp / ICS Helpers ---
    const copyWhatsAppMessage = (staffId: string) => {
        const person = staff.find(s => s.id === staffId);
        if (!person) return;

        const shifts = result.schedule
            .filter(d => d.assignments.some(a => a.staffId === staffId))
            .sort((a, b) => a.day - b.day)
            .map(d => {
                const date = new Date(year, month, d.day);
                const dayName = date.toLocaleString('tr-TR', { weekday: 'short' });
                const assignment = d.assignments.find(a => a.staffId === staffId);
                const role = assignment?.isEmergency ? 'Acil' : 'Servis';
                const service = services.find(s => s.id === assignment?.serviceId);
                return `${d.day} (${dayName}) - ${service?.name || role}`;
            });

        const text = `Sn. ${person.name}, ${new Date(year, month).toLocaleString('tr-TR', { month: 'long', year: 'numeric' })} Nöbetleriniz:\n\n${shifts.join('\n')}\n\nToplam: ${shifts.length} Nöbet.\nİyi çalışmalar.`;

        navigator.clipboard.writeText(text);
        alert(`${person.name} için nöbet mesajı kopyalandı!`);
    };

    const generateICSFile = (staffId: string) => {
        const person = staff.find(s => s.id === staffId);
        if (!person) return;

        const shifts = result.schedule
            .filter(d => d.assignments.some(a => a.staffId === staffId))
            .map(d => {
                const date = new Date(year, month, d.day);
                const assignment = d.assignments.find(a => a.staffId === staffId);
                const serviceName = services.find(s => s.id === assignment?.serviceId)?.name || 'Nöbet';
                return { date, serviceName };
            });

        if (shifts.length === 0) {
            alert('Nöbet bulunamadı.');
            return;
        }

        let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Nobetmatik//TR\nCALSCALE:GREGORIAN\nMETHOD:PUBLISH\n";
        
        shifts.forEach(shift => {
            const dateStr = shift.date.toISOString().replace(/[-:]/g, '').split('T')[0]; // YYYYMMDD
            const nextDay = new Date(shift.date);
            nextDay.setDate(nextDay.getDate() + 1);
            const endDateStr = nextDay.toISOString().replace(/[-:]/g, '').split('T')[0];

            icsContent += "BEGIN:VEVENT\n";
            icsContent += `DTSTART;VALUE=DATE:${dateStr}\n`;
            icsContent += `DTEND;VALUE=DATE:${endDateStr}\n`;
            icsContent += `SUMMARY:Nöbet: ${shift.serviceName}\n`;
            icsContent += `DESCRIPTION:Nöbetmatik tarafından oluşturuldu.\n`;
            icsContent += "END:VEVENT\n";
        });

        icsContent += "END:VCALENDAR";

        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.setAttribute('download', `${person.name}_Nobetleri_${year}_${month+1}.ics`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

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

            {/* Actions Bar */}
            <div className={`flex flex-col xl:flex-row justify-between items-center p-3 rounded-xl border shadow-sm gap-3 ${isBlackAndWhite ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'}`}>
                 <div className={`flex p-1 rounded-lg border ${isBlackAndWhite ? 'bg-slate-800 border-slate-700' : 'bg-gray-100 border-gray-200'}`}>
                    <button onClick={() => setViewMode('daily')} className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${viewMode === 'daily' ? (isBlackAndWhite ? 'bg-slate-600 text-white shadow' : 'bg-white text-indigo-600 shadow') : (isBlackAndWhite ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-800')}`}>
                        <LayoutGrid className="w-3.5 h-3.5" /> Günlük
                    </button>
                    <button onClick={() => setViewMode('staff')} className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${viewMode === 'staff' ? (isBlackAndWhite ? 'bg-slate-600 text-white shadow' : 'bg-white text-indigo-600 shadow') : (isBlackAndWhite ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-800')}`}>
                        <Users className="w-3.5 h-3.5" /> Personel
                    </button>
                 </div>

                 <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-center sm:justify-end">
                    <Button variant="secondary" onClick={handleDownload} className={`text-xs h-9 flex-1 sm:flex-none ${isBlackAndWhite ? 'bg-slate-800 text-white border-slate-700 hover:bg-slate-700' : ''}`}>
                       {ICONS.Excel} Excel
                    </Button>
                    <Button variant="secondary" onClick={() => setWhatsAppModalOpen(true)} className={`text-xs h-9 flex-1 sm:flex-none ${isBlackAndWhite ? 'bg-slate-800 text-white border-slate-700 hover:bg-slate-700' : ''}`}>
                       <Share2 className="w-4 h-4 mr-1" /> Paylaş & Takvim
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
                          {result.schedule.map((day, index) => (
                              <DayRow 
                                key={day.day}
                                day={day}
                                index={index}
                                services={services}
                                isEditing={isEditing}
                                staffList={staff}
                                isBlackAndWhite={isBlackAndWhite}
                                year={year}
                                month={month}
                                dragData={dragData}
                                dragOverTarget={dragOverTarget}
                                onDragStart={handleDragStart}
                                onDrop={handleDrop}
                                onDragEnter={handleDragEnter}
                                onDragOver={handleDragOver}
                                onCellClick={handleCellClick}
                              />
                          ))}
                        </tbody>
                      </table>
                    </div>
                </Card>
            )}

            {/* Editing Dropdown */}
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

            {/* WhatsApp & ICS Modal */}
            {whatsAppModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                    <div className={`rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh] ${isBlackAndWhite ? 'bg-slate-900 text-white border border-slate-700' : 'bg-white'}`}>
                        <div className={`p-4 border-b flex justify-between items-center shrink-0 ${isBlackAndWhite ? 'bg-slate-950 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
                            <h3 className="font-bold flex items-center gap-2"><Share2 className="w-5 h-5" /> Nöbet Paylaşımı</h3>
                            <button onClick={() => setWhatsAppModalOpen(false)} className="p-1.5 rounded-full hover:bg-black/10 transition-colors"><X className="w-5 h-5" /></button>
                        </div>
                        <div className={`p-6 overflow-y-auto custom-scrollbar ${isBlackAndWhite ? 'bg-slate-900' : 'bg-white'}`}>
                             <p className={`text-sm mb-4 ${isBlackAndWhite ? 'text-gray-300' : 'text-gray-600'}`}>
                                 Personel seçerek WhatsApp için nöbet listesi metnini kopyalayabilir veya takvim dosyası (ICS) indirebilirsiniz.
                             </p>
                             <div className="space-y-2">
                                 {staff.map(s => {
                                     const hasShifts = result.schedule.some(d => d.assignments.some(a => a.staffId === s.id));
                                     if (!hasShifts) return null;
                                     return (
                                         <div key={s.id} className={`flex items-center justify-between p-3 rounded-lg border ${isBlackAndWhite ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
                                             <div className="flex items-center gap-3">
                                                 <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isBlackAndWhite ? 'bg-indigo-900 text-indigo-200' : 'bg-indigo-100 text-indigo-700'}`}>{s.name.charAt(0)}</div>
                                                 <div>
                                                     <div className={`font-bold text-sm ${isBlackAndWhite ? 'text-white' : 'text-gray-900'}`}>{s.name}</div>
                                                     <div className={`text-xs ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>{s.group} Grubu</div>
                                                 </div>
                                             </div>
                                             <div className="flex gap-2">
                                                 <Button variant="secondary" onClick={() => copyWhatsAppMessage(s.id)} className={`h-8 text-xs px-3 ${isBlackAndWhite ? '!bg-slate-700 !border-slate-600 text-white hover:!bg-slate-600' : ''}`}>
                                                     <Clipboard className="w-3.5 h-3.5 mr-1" />
                                                 </Button>
                                                 <Button variant="secondary" onClick={() => generateICSFile(s.id)} className={`h-8 text-xs px-3 ${isBlackAndWhite ? '!bg-slate-700 !border-slate-600 text-white hover:!bg-slate-600' : ''}`}>
                                                     <CalendarIcon className="w-3.5 h-3.5 mr-1" />
                                                 </Button>
                                             </div>
                                         </div>
                                     );
                                 })}
                             </div>
                        </div>
                        <div className={`p-4 border-t shrink-0 flex justify-end ${isBlackAndWhite ? 'bg-slate-950 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
                             <Button onClick={() => setWhatsAppModalOpen(false)} className={isBlackAndWhite ? '!bg-indigo-600 !border-indigo-500' : ''}>Kapat</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
