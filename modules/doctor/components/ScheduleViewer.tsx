
import React, { useState, useMemo } from 'react';
import { ScheduleResult, Service, Staff, Group } from '../../../types';
import { Card, Button } from '../../../components/ui';
import { ICONS } from '../../../constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Share2, Filter, User, Download, Save, Edit3, X } from 'lucide-react';

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

export const ScheduleViewer: React.FC<ScheduleViewerProps> = ({ 
    result, setResult, services, staff, year, month, isBlackAndWhite, handleDownload, isReadOnly, onShare 
}) => {
    // --- Filtering State ---
    const [filterName, setFilterName] = useState("");
    const [filterGroup, setFilterGroup] = useState<Group | 'Hepsi'>('Hepsi');
    const [isEditing, setIsEditing] = useState(false);

    // --- Stats Logic ---
    const chartData = useMemo(() => {
        if (!staff || !result) return [];
        return result.stats.map(s => {
          const p = staff.find(st => st.id === s.staffId);
          return {
            name: p?.name || '?',
            group: p?.group,
            targetService: p?.quotaService || 0,
            actualService: s.serviceShifts,
            targetEmergency: p?.quotaEmergency || 0,
            actualEmergency: s.emergencyShifts
          };
        }).sort((a, b) => (a.group || '').localeCompare(b.group || ''));
      }, [result, staff]);

    // Button Helper
    const btnClass = `text-xs h-9 ${isBlackAndWhite ? '!bg-slate-800 !text-white !border-slate-700 hover:!bg-slate-700 hover:!text-white' : ''}`;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Scorecards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className={`p-4 border-l-4 shadow-sm ${isBlackAndWhite ? 'bg-slate-900 border-slate-700 border-l-emerald-500 text-white' : 'border-l-emerald-500'}`}>
                     <div className="text-xs font-bold uppercase opacity-60 mb-1">Toplam Atama</div>
                     <div className="text-3xl font-bold">{result.schedule.reduce((acc, day) => acc + day.assignments.filter(a => a.staffId !== 'EMPTY').length, 0)}</div>
                  </Card>
                  <Card className={`p-4 border-l-4 shadow-sm ${isBlackAndWhite ? 'bg-slate-900 border-slate-700 border-l-rose-500 text-white' : 'border-l-rose-500'}`}>
                     <div className="text-xs font-bold uppercase opacity-60 mb-1">Boş Kalan</div>
                     <div className={`text-3xl font-bold ${result.unfilledSlots > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{result.unfilledSlots}</div>
                  </Card>
            </div>

            {/* Actions Bar */}
            <div className={`flex flex-col sm:flex-row justify-between items-center p-3 rounded-xl border shadow-sm gap-3 ${isBlackAndWhite ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'}`}>
                 <div className="flex gap-2 w-full sm:w-auto">
                    <Button variant="secondary" onClick={handleDownload} className={btnClass}>
                       {ICONS.Excel} Excel
                    </Button>
                    {!isReadOnly && onShare && (
                        <Button variant="secondary" onClick={onShare} className={btnClass}>
                            <Share2 className="w-4 h-4 mr-1" /> Paylaş
                        </Button>
                    )}
                 </div>
                 
                 {/* Doctor Specific Filter: Group */}
                 <div className="flex gap-2 items-center w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-48">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input 
                            type="text" placeholder="Doktor Ara..." value={filterName} onChange={(e) => setFilterName(e.target.value)}
                            className={`w-full h-9 pl-9 pr-3 rounded-lg text-sm border outline-none ${isBlackAndWhite ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-50'}`}
                        />
                    </div>
                    <select 
                        value={filterGroup} onChange={(e) => setFilterGroup(e.target.value as Group | 'Hepsi')}
                        className={`h-9 px-3 rounded-lg text-sm border outline-none ${isBlackAndWhite ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-50'}`}
                    >
                        <option value="Hepsi">Tüm Gruplar</option>
                        <option value="A">A Grubu</option>
                        <option value="B">B Grubu</option>
                        <option value="C">C Grubu</option>
                        <option value="D">D Grubu</option>
                    </select>
                 </div>
            </div>

            {/* Doctor Specific Chart: Service vs Emergency Targets */}
            <Card className={`p-4 md:p-6 shadow-md overflow-hidden ${isBlackAndWhite ? 'bg-slate-900 border-slate-700 text-white' : ''}`}>
                  <h3 className="font-bold text-lg mb-4">Hedef Tutarlılığı (Acil vs Servis)</h3>
                  <div style={{ width: '100%', height: '300px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }} barGap={2}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isBlackAndWhite ? "#374151" : "#e5e7eb"} />
                        <XAxis dataKey="name" tick={{fontSize: 10, fill: isBlackAndWhite ? '#d1d5db' : '#4b5563'}} interval={0} angle={-45} textAnchor="end" />
                        <YAxis tick={{ fill: isBlackAndWhite ? '#d1d5db' : '#4b5563', fontSize: 12 }} />
                        <Tooltip contentStyle={{ backgroundColor: isBlackAndWhite ? '#1e293b' : 'white', color: isBlackAndWhite ? 'white' : 'black' }} />
                        <Legend verticalAlign="top" />
                        <Bar dataKey="targetService" name="Hedef (Srv)" stackId="a" fill="#818cf8" />
                        <Bar dataKey="actualService" name="Gerçek (Srv)" stackId="b" fill="#4f46e5" />
                        <Bar dataKey="targetEmergency" name="Hedef (Acil)" stackId="a" fill="#fca5a5" />
                        <Bar dataKey="actualEmergency" name="Gerçek (Acil)" stackId="b" fill="#e11d48" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
            </Card>

            {/* Schedule Table */}
            <Card className={`shadow-lg border-0 ${isBlackAndWhite ? 'bg-slate-900' : ''}`}>
                <div className="report-table-container overflow-x-auto">
                  <table className="report-table w-full">
                    <thead>
                      <tr>
                        <th className={`sticky-col w-20 ${isBlackAndWhite ? 'bg-slate-950 text-white' : 'bg-white'}`}>Gün</th>
                        {services.map(s => (
                          <th key={s.id} className={`min-w-[140px] ${isBlackAndWhite ? 'bg-slate-950 text-white' : ''}`}>
                              <div className="truncate">{s.name}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.schedule.map((day, index) => {
                          const isHoliday = day.isHoliday;
                          return (
                            <tr key={day.day} className={day.isWeekend || isHoliday ? 'is-weekend' : ''}>
                              <td className={`sticky-col text-center font-bold p-2 border-r ${isHoliday ? 'text-red-500' : ''}`}>
                                <div>{day.day}</div>
                                <div className="text-[10px] opacity-70">{new Date(year, month, day.day).toLocaleString('tr-TR', {weekday:'short'})}</div>
                              </td>
                              {services.map(service => {
                                const assignments = day.assignments.filter(a => a.serviceId === service.id);
                                return (
                                  <td key={service.id} className="p-2 border-b align-top">
                                    <div className="flex flex-col gap-1">
                                        {assignments.map((a, idx) => {
                                          // FILTERING
                                          if (filterName && !a.staffName.toLowerCase().includes(filterName.toLowerCase())) return null;
                                          if (filterGroup !== 'Hepsi' && a.group !== filterGroup) return null;

                                          return (
                                            <div key={idx} className={`text-xs p-1 rounded flex items-center gap-1 ${a.staffId==='EMPTY' ? 'bg-red-100 text-red-600' : (isBlackAndWhite ? 'bg-slate-800 text-slate-200' : 'bg-indigo-50 text-indigo-700')}`}>
                                                {a.staffId !== 'EMPTY' && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>}
                                                <span className="truncate">{a.staffName}</span>
                                            </div>
                                          );
                                        })}
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
        </div>
    );
};
