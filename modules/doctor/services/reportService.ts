
import * as XLSX from 'xlsx';
import { ScheduleResult, Service, Staff } from '../../../types';

const formatDate = (day: number, month: number, year: number): string => {
    const d = day.toString().padStart(2, '0');
    const m = (month + 1).toString().padStart(2, '0');
    return `${d}.${m}.${year}`;
};

export const exportToExcel = (result: ScheduleResult, services: Service[], year: number, month: number, staffList: Staff[]) => {
  const wb = XLSX.utils.book_new();
  const monthName = new Date(year, month).toLocaleString('tr-TR', { month: 'long' });
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // --- 1. SAYFA: GENEL LİSTE (DOKTOR FORMATI) ---
  const headersMain = ['Tarih', 'Gün', ...services.map(s => s.name)];
  const dataMain: any[] = [];

  result.schedule.forEach((daySchedule) => {
    const date = new Date(year, month, daySchedule.day);
    const dayName = date.toLocaleString('tr-TR', { weekday: 'short' });
    const isWeekend = daySchedule.isWeekend;

    const row: any = {
      'Tarih': formatDate(daySchedule.day, month, year),
      'Gün': isWeekend ? `${dayName} (HS)` : dayName
    };

    services.forEach(service => {
      const assignments = daySchedule.assignments.filter(a => a.serviceId === service.id);
      if (assignments.length > 0) {
          const names = assignments.map(a => a.staffId === 'EMPTY' ? '!!! BOŞ !!!' : `${a.staffName} (${a.group})`).join(', ');
          row[service.name] = names;
      } else {
          row[service.name] = '-';
      }
    });

    dataMain.push(row);
  });

  const wsMain = XLSX.utils.json_to_sheet(dataMain, { header: headersMain });
  
  // Stil verme (Basit genişlik ayarı)
  wsMain['!cols'] = [
      { wch: 12 }, 
      { wch: 10 }, 
      ...services.map(s => ({ wch: Math.max(s.name.length + 5, 25) })) 
  ];
  XLSX.utils.book_append_sheet(wb, wsMain, "Nöbet Listesi");

  // --- 2. SAYFA: KİŞİ BAZLI DAĞILIM ---
  const daysHeader = Array.from({length: daysInMonth}, (_, i) => (i + 1).toString());
  const headersPerson = ['Ad Soyad', 'Kıdem', 'Grup', 'Toplam', 'Puan', ...daysHeader];
  
  const dataPerson: any[] = [];
  const sortedStaff = [...staffList].sort((a, b) => a.role - b.role || a.group.localeCompare(b.group));

  sortedStaff.forEach(person => {
      const stats = result.stats.find(s => s.staffId === person.id);
      const row: any = {
          'Ad Soyad': person.name,
          'Kıdem': person.role,
          'Grup': person.group,
          'Toplam': stats?.totalShifts || 0,
          'Puan': stats ? (stats.weekendShifts * 1.5 + stats.totalShifts).toFixed(1) : 0
      };

      for (let d = 1; d <= daysInMonth; d++) {
          const daySchedule = result.schedule.find(s => s.day === d);
          const assignment = daySchedule?.assignments.find(a => a.staffId === person.id);
          
          if (assignment) {
              const service = services.find(s => s.id === assignment.serviceId);
              row[d.toString()] = service ? (service.name.length > 10 ? service.name.substring(0,10)+'..' : service.name) : 'X';
          } else {
              row[d.toString()] = '';
          }
      }
      dataPerson.push(row);
  });

  const wsPerson = XLSX.utils.json_to_sheet(dataPerson, { header: headersPerson });
  wsPerson['!cols'] = [{ wch: 20 }, { wch: 6 }, { wch: 6 }, { wch: 8 }, { wch: 6 }, ...daysHeader.map(() => ({ wch: 4 }))];
  XLSX.utils.book_append_sheet(wb, wsPerson, "Kişi Bazlı");

  // --- 3. SAYFA: İSTATİSTİKLER ---
  const statsData = result.stats.map(s => {
      const person = staffList.find(p => p.id === s.staffId);
      return {
          'Ad Soyad': person?.name,
          'Kıdem': person?.role,
          'Grup': person?.group,
          'Toplam': s.totalShifts,
          'Hafta Sonu': s.weekendShifts,
          'Acil': s.emergencyShifts,
          'Servis': s.serviceShifts,
          'Cumartesi': s.saturdayShifts,
          'Pazar': s.sundayShifts
      };
  });
  const wsStats = XLSX.utils.json_to_sheet(statsData);
  XLSX.utils.book_append_sheet(wb, wsStats, "İstatistikler");

  // İndirme
  XLSX.writeFile(wb, `Doktor_Nobet_Listesi_${monthName}_${year}.xlsx`);
};
