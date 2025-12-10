
import React, { useState, useMemo } from 'react';
import { ScheduleResult, Service, Staff, Group } from '../../../types';
import { Card, Button } from '../../../components/ui';
import { ICONS } from '../../../constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Share2, Filter, User, Download, Save, Edit3, X, Calendar as CalendarIcon, Clipboard, Link as LinkIcon } from 'lucide-react';

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
    
    // --- WhatsApp Modal State ---
    const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);

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

    const chartWidth = useMemo(() => {
        return Math.max(800, chartData.length * 60); // Dynamic width for scrolling
    }, [chartData]);

    // Button Helper
    const btnClass = `text-xs h-9 ${isBlackAndWhite ? '!bg-slate-800 !text-white !border-slate-700 hover:!bg-slate-700 hover:!text-white' : ''}`;

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
                    <Button variant="secondary" onClick={() => setWhatsAppModalOpen(true)} className={btnClass}>
                       <Share2 className="w-4 h-4 mr-1" /> Paylaş & Takvim
                    </Button>
                    {!isReadOnly && onShare && (
                        <Button variant="secondary" onClick={onShare} className={`text-xs h-9 ${isBlackAndWhite ? '!bg-indigo-900 !text-indigo-200 !border-indigo-800' : '!bg-indigo-50 !text-indigo-700 !border-indigo-200'}`}>
                            <LinkIcon className="w-4 h-4 mr-1" /> Link
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
                  <div className="w-full overflow-x-auto pb-4 custom-scrollbar">
                      <div style={{ width: `${chartWidth}px`, height: '300px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }} barGap={2}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isBlackAndWhite ? "#374151" : "#e5e7eb"} />
                            <XAxis dataKey="name" tick={{fontSize: 10, fill: isBlackAndWhite ? '#d1d5db' : '#4b5563'}} interval={0} angle={-45} textAnchor="end" height={80} />
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
                          return (
                            <tr key={day.day} className={day.isWeekend || isHoliday ? 'is-weekend' : ''}>
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
