
import * as XLSX from 'xlsx';
import { ScheduleResult, Service, Staff, Group } from '../types';

// Helper to format date as dd.mm.yyyy
const formatDate = (day: number, month: number, year: number): string => {
    const d = day.toString().padStart(2, '0');
    const m = (month + 1).toString().padStart(2, '0');
    return `${d}.${m}.${year}`;
};

// Mevcut Excel Dışa Aktarma
export const exportToExcel = (result: ScheduleResult, services: Service[], year: number, month: number, staffList: Staff[]) => {
  const wb = XLSX.utils.book_new();
  const monthName = new Date(year, month).toLocaleString('tr-TR', { month: 'long' });
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // --- 1. SAYFA: GENEL LİSTE (SERVİS BAZLI) ---
  const headersMain = ['Tarih', 'Gün', ...services.map(s => s.name)];
  const dataMain: any[] = [];
  const rowStyles: any[] = []; // Store styles if library supports it

  result.schedule.forEach((daySchedule, index) => {
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
          const names = assignments.map(a => a.staffId === 'EMPTY' ? '!!! BOŞ !!!' : a.staffName).join(', ');
          row[service.name] = names;
      } else {
          row[service.name] = '-';
      }
    });

    dataMain.push(row);
  });

  const wsMain = XLSX.utils.json_to_sheet(dataMain, { header: headersMain });

  // Apply basic styles if supported (Attempting color for weekends)
  // Note: Standard 'xlsx' (SheetJS CE) does not export styles to file. 
  // This code structure is prepared for 'xlsx-js-style' or Pro versions.
  if (result.schedule) {
      for (let i = 0; i < result.schedule.length; i++) {
          const day = result.schedule[i];
          if (day.isWeekend) {
              const rowIndex = i + 1; // +1 for header
              // Loop through columns to apply style
              for (let col = 0; col < headersMain.length; col++) {
                  const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: col });
                  if (!wsMain[cellRef]) continue;
                  
                  // Add Style Object
                  wsMain[cellRef].s = {
                      fill: {
                          patternType: "solid",
                          fgColor: { rgb: "FFE699" } // Light Orange/Yellow for weekend
                      },
                      font: {
                          bold: true
                      }
                  };
              }
          }
      }
  }

  // Sütun genişlikleri
  wsMain['!cols'] = [
      { wch: 12 }, // Tarih
      { wch: 10 }, // Gün
      ...services.map(s => ({ wch: Math.max(s.name.length + 5, 20) })) // Servis isimleri
  ];
  XLSX.utils.book_append_sheet(wb, wsMain, "Genel Liste");


  // --- 2. SAYFA: PERSONEL BAZLI LİSTE (MATRİS) ---
  const daysHeader = Array.from({length: daysInMonth}, (_, i) => (i + 1).toString());
  const headersPerson = ['Ad Soyad', 'Kıdem', 'Grup', 'Toplam', ...daysHeader];
  
  const dataPerson: any[] = [];
  const sortedStaff = [...staffList].sort((a, b) => a.role - b.role || a.group.localeCompare(b.group));

  sortedStaff.forEach(person => {
      const stats = result.stats.find(s => s.staffId === person.id);
      const row: any = {
          'Ad Soyad': person.name,
          'Kıdem': person.role,
          'Grup': person.group,
          'Toplam': stats?.totalShifts || 0
      };

      for (let d = 1; d <= daysInMonth; d++) {
          const daySchedule = result.schedule.find(s => s.day === d);
          const assignment = daySchedule?.assignments.find(a => a.staffId === person.id);
          
          if (assignment) {
              const service = services.find(s => s.id === assignment.serviceId);
              row[d.toString()] = service ? service.name : '?';
          } else {
              row[d.toString()] = '';
          }
      }
      dataPerson.push(row);
  });

  const wsPerson = XLSX.utils.json_to_sheet(dataPerson, { header: headersPerson });
  
  // Highlight Weekends in Person View columns
  // Note: Only works if library supports styles
  for(let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const isWknd = date.getDay() === 0 || date.getDay() === 6;
      if(isWknd) {
         // Column index offset by 4 (Ad, Kıdem, Grup, Toplam)
         const colIdx = d + 3; 
         // Apply to all rows
         for(let r = 0; r <= dataPerson.length; r++) {
             const cellRef = XLSX.utils.encode_cell({c: colIdx, r: r});
             if(!wsPerson[cellRef]) continue;
             if(!wsPerson[cellRef].s) wsPerson[cellRef].s = {};
             wsPerson[cellRef].s.fill = { fgColor: { rgb: "E6E6E6" } }; // Light Gray
         }
      }
  }

  const personCols = [
      { wch: 25 }, // İsim
      { wch: 6 },  // Kıdem
      { wch: 6 },  // Grup
      { wch: 8 },  // Toplam
      ...daysHeader.map(() => ({ wch: 5 })) // Günler - Daraltıldı
  ];
  wsPerson['!cols'] = personCols;
  XLSX.utils.book_append_sheet(wb, wsPerson, "Personel Bazlı");


  // --- 3. SAYFA: İSTATİSTİKLER ---
  const statsData = result.stats.map(s => {
      const person = staffList.find(p => p.id === s.staffId);
      return {
          'Ad Soyad': person?.name || 'Bilinmiyor',
          'Kıdem': person?.role,
          'Grup': person?.group,
          'Toplam Nöbet': s.totalShifts,
          'Servis Nöbeti': s.serviceShifts,
          'Acil Nöbeti': s.emergencyShifts,
          'Hafta Sonu Toplam': s.weekendShifts,
          'Cumartesi': s.saturdayShifts,
          'Pazar': s.sundayShifts,
          'Hedef (Srv)': person?.quotaService,
          'Hedef (Acil)': person?.quotaEmergency
      };
  });
  
  const wsStats = XLSX.utils.json_to_sheet(statsData);
  wsStats['!cols'] = [{wch: 25}, {wch: 8}, {wch: 8}, {wch: 12}, {wch: 12}, {wch: 12}, {wch: 15}, {wch: 10}, {wch: 10}, {wch: 10}, {wch: 10}];
  XLSX.utils.book_append_sheet(wb, wsStats, "İstatistikler");


  // --- 4. SAYFA: HAM LİSTE (DB FORMAT) ---
  const flatData: any[] = [];
  result.schedule.forEach(day => {
      day.assignments.forEach(assign => {
          if (assign.staffId === 'EMPTY') return;
          const service = services.find(s => s.id === assign.serviceId);
          flatData.push({
              'Tarih': formatDate(day.day, month, year),
              'Gün': day.day,
              'Ay': month + 1,
              'Yıl': year,
              'Haftasonu': day.isWeekend ? 'Evet' : 'Hayır',
              'Personel': assign.staffName,
              'Kıdem': assign.role,
              'Grup': assign.group,
              'Servis': service?.name,
              'Tür': assign.isEmergency ? 'Acil' : 'Servis'
          });
      });
  });

  const wsFlat = XLSX.utils.json_to_sheet(flatData);
  XLSX.utils.book_append_sheet(wb, wsFlat, "Ham Liste");


  // --- 5. SAYFA: YEDEK (CONFIG) ---
  const configData = staffList.map(s => ({
      'Ad Soyad': s.name,
      'Kıdem': s.role,
      'Grup': s.group,
      'Servis Hedef': s.quotaService,
      'Acil Hedef': s.quotaEmergency,
      'Haftasonu Limit': s.weekendLimit,
      'İzinler': s.offDays.join(','),
      'İstekler': s.requestedDays.join(','),
      'Aktif': s.isActive === false ? 'Hayır' : 'Evet'
  }));
  const wsConfig = XLSX.utils.json_to_sheet(configData);
  XLSX.utils.book_append_sheet(wb, wsConfig, "Yedek (Personel)");

  // --- 6. SAYFA: LOGLAR ---
  if (result.logs && result.logs.length > 0) {
      const logData = result.logs.map(l => ({ 'Hata Kaydı': l }));
      const wsLogs = XLSX.utils.json_to_sheet(logData);
      wsLogs['!cols'] = [{ wch: 100 }];
      XLSX.utils.book_append_sheet(wb, wsLogs, "Sistem Logları");
  }

  // İndirme İşlemi
  XLSX.writeFile(wb, `Nobet_Listesi_${monthName}_${year}.xlsx`);
};

// Taslak Excel Oluşturma
export const generateTemplate = () => {
    const wb = XLSX.utils.book_new();
    const headers = ['Ad Soyad', 'Kıdem', 'Grup', 'Servis Hedef', 'Acil Hedef', 'Haftasonu Limit', 'İzinler', 'İstekler'];
    const exampleData = [
        { 
            'Ad Soyad': 'Dr. Örnek Kişi', 
            'Kıdem': 1, 
            'Grup': 'A', 
            'Servis Hedef': 5, 
            'Acil Hedef': 2, 
            'Haftasonu Limit': 2,
            'İzinler': '1,2,3',
            'İstekler': '15,20'
        }
    ];

    const ws = XLSX.utils.json_to_sheet(exampleData, { header: headers });
    ws['!cols'] = [{wch:20}, {wch:8}, {wch:8}, {wch:12}, {wch:12}, {wch:15}, {wch:15}, {wch:15}];
    
    XLSX.utils.book_append_sheet(wb, ws, "Personel Listesi");
    XLSX.writeFile(wb, "Personel_Yukleme_Taslagi.xlsx");
};

// Excel'den Personel Okuma
export const readStaffFromExcel = async (file: File): Promise<Staff[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const wb = XLSX.read(data, { type: 'binary' });
                const sheetName = wb.SheetNames[0];
                const worksheet = wb.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet);

                const staffList: Staff[] = json.map((row: any, index) => {
                    const parseList = (str: any) => {
                        if (typeof str === 'number') return [str];
                        if (!str) return [];
                        return str.toString().split(',').map((s: string) => parseInt(s.trim())).filter((n: number) => !isNaN(n));
                    };

                    let isActive = true;
                    if (row['Aktif'] || row['Active']) {
                         const val = (row['Aktif'] || row['Active']).toString().toLowerCase().trim();
                         if (val === 'hayır' || val === 'false' || val === '0' || val === 'pasif') isActive = false;
                    }

                    return {
                        id: `imp_${Date.now()}_${index}`,
                        name: row['Ad Soyad'] || row['name'] || row['Name'] || 'İsimsiz',
                        role: parseInt(row['Kıdem'] || row['role'] || row['Role'] || '3'),
                        group: (row['Grup'] || row['group'] || row['Group'] || 'Genel') as Group,
                        quotaService: parseInt(row['Servis Hedef'] || row['quotaService'] || row['Service Quota'] || '0'),
                        quotaEmergency: parseInt(row['Acil Hedef'] || row['quotaEmergency'] || row['Emergency Quota'] || '0'),
                        weekendLimit: parseInt(row['Haftasonu Limit'] || row['weekendLimit'] || row['Weekend Limit'] || '0'),
                        offDays: parseList(row['İzinler'] || row['offDays'] || row['Off Days']),
                        requestedDays: parseList(row['İstekler'] || row['requestedDays'] || row['Requests']),
                        isActive: isActive
                    };
                });

                resolve(staffList);
            } catch (error) {
                reject(error);
            }
        };
        reader.readAsBinaryString(file);
    });
};
