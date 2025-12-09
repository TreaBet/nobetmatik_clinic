import React, { useState, useMemo, useEffect } from 'react';
import { ScheduleResult, Service, Staff, DaySchedule } from '../../../types';
import { Card, Button } from '../../../components/ui';
import { ICONS } from '../../../constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Edit3, Save, Share2, Pencil, RotateCcw, LayoutGrid, Users, Link as LinkIcon } from 'lucide-react';

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

    // --- Manual Edit State (Staff View) ---
    const [editingStaffSlot, setEditingStaffSlot] = useState<{day: number, staffId: string} | null>(null);

    // --- History / Undo State ---
    const [history, setHistory] = useState<DaySchedule[][]>([]);

    // --- WhatsApp Modal State ---
    const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);

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
            isEmergency: existingIsEmergency
        };

        dayData.assignments[targetAssignmentIndex] = updatedAssignment as any;
        recalculateStats(newSchedule);
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

            {/* Schedule Table */}
            <Card className={`shadow-lg border-0 ${isBlackAndWhite ? 'bg-slate-900' : ''}`}>
                <div className="report-table-container overflow-x-auto">
                  <table className="report-table w-full">
                    <thead>
                      <tr>
                        <th className={`sticky-col w-20 md:w-24 shadow-sm z-30 text-center ${isBlackAndWhite ? 'bg-slate-950 text-white border-b border-slate-700' : 'bg-white text-gray-800'}`}>Gün</th>
                        {services.map(s => (
                          <th key={s.id} className={`min-w-[150px] md:min-w-[180px] ${isBlackAndWhite ? 'bg-slate-950 text-white border-b border-slate-700' : ''}`}>
                              <div className="truncate">{s.name}</div>
                              <div className="text-[10px] font-normal opacity-70 mt-0.5">Min: {s.minDailyCount}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.schedule.map((day, index) => {
                          const isHoliday = day.isHoliday;
                          // Zebra Striping Logic: Apply only if not weekend/holiday
                          const isZebra = !day.isWeekend && !isHoliday && index % 2 === 0;

                          return (
                            <tr key={day.day} className={`${day.isWeekend || isHoliday ? 'is-weekend' : ''} ${isZebra ? 'zebra-row' : ''}`}>
                              <td className={`sticky-col p-0 border-r ${isBlackAndWhite ? 'bg-slate-900 border-slate-700 text-slate-200' : 'border-gray-100'}`} style={{ height: '1px' }}>
                                <div className={`flex flex-col items-center justify-center h-full min-h-[50px] py-2 w-full ${isHoliday ? (isBlackAndWhite ? 'bg-red-900/20' : 'bg-red-50') : 'bg-inherit'}`}>
                                  <span className={`text-xl font-bold leading-none tracking-tight ${isHoliday ? 'text-red-500' : (isBlackAndWhite ? 'text-white' : 'text-gray-800')}`}>{day.day}</span>
                                  <span className={`text-[10px] uppercase font-bold tracking-wider mt-1 ${isHoliday ? 'text-red-400' : (day.isWeekend ? (isBlackAndWhite ? 'text-indigo-300' : 'text-indigo-600') : (isBlackAndWhite ? 'text-slate-500' : 'text-gray-400'))}`}>
                                    {new Date(year, month, day.day).toLocaleString('tr-TR', {weekday: 'short'})}
                                  </span>
                                </div>
                              </td>
                              {services.map(service => {
                                const assignments = day.assignments.filter(a => a.serviceId === service.id);
                                return (
                                  <td key={service.id} 
                                    className={`align-top h-full p-2 border-b ${isBlackAndWhite ? 'border-slate-700' : 'border-gray-100'} ${isHoliday ? (isBlackAndWhite ? 'bg-red-900/10' : 'bg-red-50/30') : ''}`}
                                    style={{ height: '1px' }}
                                  >
                                    <div className="flex flex-col gap-1.5 min-h-[40px] h-full justify-start">
                                        {assignments.length > 0 ? assignments.map((a, idx) => {
                                          let textClass = 'text-normal';
                                          if (a.staffId === 'EMPTY') textClass = 'text-empty';
                                          else if (a.isEmergency) textClass = 'text-emergency';
                                          
                                          const dotColor = a.isEmergency 
                                              ? 'bg-rose-500 shadow-sm' 
                                              : (isBlackAndWhite ? 'bg-indigo-400' : 'bg-indigo-600');

                                          return (
                                            <div 
                                              key={idx} 
                                              className={`slot-list-item ${textClass} ${isBlackAndWhite ? 'bg-slate-800' : 'bg-gray-50'} rounded px-2`}
                                            >
                                               <div className={`w-2 h-2 rounded-full shrink-0 ${a.staffId === 'EMPTY' ? 'hidden' : dotColor}`}></div>
                                               <span className="truncate block select-none text-xs">{a.staffName}</span>
                                            </div>
                                          );
                                        }) : (
                                          <span className={`text-center text-xs block py-2 border border-dashed rounded h-full flex items-center justify-center select-none opacity-40 ${isBlackAndWhite ? 'border-slate-700 text-slate-600' : 'border-gray-200 text-gray-300'}`}>-</span>
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

            {/* Logs */}
            {result.logs.length > 0 && (
                <Card className={isBlackAndWhite ? 'bg-slate-900 border-slate-700 border text-white' : 'bg-amber-50 border-amber-200 border'} id="log-section">
                    <div className={`p-4 border-b font-bold flex items-center gap-2 ${isBlackAndWhite ? 'border-slate-700' : 'border-amber-200 text-amber-800'}`}>
                        {ICONS.Alert} Sistem Logları ve Hatalar
                    </div>
                    <div className={`p-4 max-h-48 overflow-y-auto text-sm font-mono space-y-1.5 ${isBlackAndWhite ? 'text-gray-300' : 'text-amber-900'}`}>
                        {result.logs.map((log, i) => <div key={i} className="flex gap-2"><span>•</span><span>{log}</span></div>)}
                    </div>
                </Card>
            )}
        </div>
    );
};