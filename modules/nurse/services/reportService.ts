
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

  // --- 1. SAYFA: GENEL LİSTE (HEMŞİRE FORMATI) ---
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
          // Hemşirelerde Birim ve Oda bilgisi önemli olabilir
          const names = assignments.map(a => {
              if (a.staffId === 'EMPTY') return '!!! BOŞ !!!';
              const staff = staffList.find(s => s.id === a.staffId);
              return staff?.unit ? `${a.staffName} (${staff.unit})` : a.staffName;
          }).join('\n'); // Alt alta yazsın
          row[service.name] = names;
      } else {
          row[service.name] = '-';
      }
    });

    dataMain.push(row);
  });

  const wsMain = XLSX.utils.json_to_sheet(dataMain, { header: headersMain });
  
  // Hücre içi satır atlamayı etkinleştirmek için alignment ayarı gerekebilir (Pro sürümde)
  // Standart sürümde geniş kolonlar bırakıyoruz.
  wsMain['!cols'] = [
      { wch: 12 }, 
      { wch: 10 }, 
      ...services.map(s => ({ wch: 35 })) // Daha geniş sütunlar
  ];
  XLSX.utils.book_append_sheet(wb, wsMain, "Nöbet Çizelgesii");

  // --- 2. SAYFA: PERSONEL TAKİP ---
  const daysHeader = Array.from({length: daysInMonth}, (_, i) => (i + 1).toString());
  const headersPerson = ['Ad Soyad', 'Birim', 'Oda', 'Uzmanlık', 'Toplam', ...daysHeader];
  
  const dataPerson: any[] = [];
  // Birime göre sırala
  const sortedStaff = [...staffList].sort((a, b) => (a.unit || '').localeCompare(b.unit || '') || a.name.localeCompare(b.name));

  sortedStaff.forEach(person => {
      const stats = result.stats.find(s => s.staffId === person.id);
      const row: any = {
          'Ad Soyad': person.name,
          'Birim': person.unit || '-',
          'Oda': person.room || '-',
          'Uzmanlık': person.specialty || '-',
          'Toplam': stats?.totalShifts || 0
      };

      for (let d = 1; d <= daysInMonth; d++) {
          const daySchedule = result.schedule.find(s => s.day === d);
          const assignment = daySchedule?.assignments.find(a => a.staffId === person.id);
          
          if (assignment) {
              const service = services.find(s => s.id === assignment.serviceId);
              // Sadece servis baş harflerini koyalım yer kazanmak için
              row[d.toString()] = service ? service.name.substring(0, 3).toUpperCase() : 'X';
          } else {
              row[d.toString()] = '';
          }
      }
      dataPerson.push(row);
  });

  const wsPerson = XLSX.utils.json_to_sheet(dataPerson, { header: headersPerson });
  wsPerson['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 6 }, { wch: 12 }, { wch: 6 }, ...daysHeader.map(() => ({ wch: 4 }))];
  XLSX.utils.book_append_sheet(wb, wsPerson, "Personel Takip");

  // İndirme
  XLSX.writeFile(wb, `Hemsire_Nobet_Listesi_${monthName}_${year}.xlsx`);
};
