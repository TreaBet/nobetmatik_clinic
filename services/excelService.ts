

import * as XLSX from 'xlsx';
import { ScheduleResult, Service, Staff, Group } from '../types';

// Mevcut Excel Dışa Aktarma
export const exportToExcel = (result: ScheduleResult, services: Service[], year: number, month: number, staffList: Staff[]) => {
  const wb = XLSX.utils.book_new();
  const monthName = new Date(year, month).toLocaleString('tr-TR', { month: 'long' });

  // 1. Main Schedule
  const headers = ['Gün', ...services.map(s => s.name)];
  const data: any[] = [];

  result.schedule.forEach(daySchedule => {
    const row: any = {
      'Gün': `${daySchedule.day} ${monthName}`
    };

    services.forEach(service => {
      const assignments = daySchedule.assignments.filter(a => a.serviceId === service.id);
      
      if (assignments.length > 0) {
          row[service.name] = assignments.map(a => a.staffName).join(', ');
      } else {
          row[service.name] = '-';
      }
    });

    data.push(row);
  });

  const ws = XLSX.utils.json_to_sheet(data, { header: headers });
  const wscols = headers.map(h => ({ wch: Math.max(h.length + 5, 20) }));
  ws['!cols'] = wscols;
  XLSX.utils.book_append_sheet(wb, ws, "Nöbet Listesi");

  // 2. Statistics
  const statsData = result.stats.map(s => ({
      'Personel ID': s.staffId,
      'Toplam Nöbet': s.totalShifts,
      'Servis Nöbeti': s.serviceShifts,
      'Acil Nöbeti': s.emergencyShifts,
      'Hafta Sonu': s.weekendShifts,
      'Cmt': s.saturdayShifts,
      'Paz': s.sundayShifts
  }));
  const wsStats = XLSX.utils.json_to_sheet(statsData);
  XLSX.utils.book_append_sheet(wb, wsStats, "İstatistikler");

  // 3. Staff Config Backup (For Re-import)
  const configData = staffList.map(s => ({
      'Ad Soyad': s.name,
      'Kıdem': s.role,
      'Grup': s.group,
      'Servis Hedef': s.quotaService,
      'Acil Hedef': s.quotaEmergency,
      'Haftasonu Limit': s.weekendLimit,
      'İzinler': s.offDays.join(','),
      'İstekler': s.requestedDays.join(',')
  }));
  const wsConfig = XLSX.utils.json_to_sheet(configData);
  XLSX.utils.book_append_sheet(wb, wsConfig, "Personel Listesi (Yedek)");

  // 4. Logs
  if (result.logs && result.logs.length > 0) {
      const logData = result.logs.map(l => ({ 'Hata Kaydı': l }));
      const wsLogs = XLSX.utils.json_to_sheet(logData);
      XLSX.utils.book_append_sheet(wb, wsLogs, "Hata Logları");
  }

  // Download
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
        },
        { 
            'Ad Soyad': 'Dr. İkinci Kişi', 
            'Kıdem': 2, 
            'Grup': 'B',
            'Servis Hedef': 4,
            'Acil Hedef': 3,
            'Haftasonu Limit': 2,
            'İzinler': '',
            'İstekler': ''
        }
    ];

    const ws = XLSX.utils.json_to_sheet(exampleData, { header: headers });
    // Auto-width for better visibility
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
                    // Helper to parse comma separated numbers
                    const parseList = (str: any) => {
                        if (typeof str === 'number') return [str];
                        if (!str) return [];
                        return str.toString().split(',').map((s: string) => parseInt(s.trim())).filter((n: number) => !isNaN(n));
                    };

                    return {
                        id: `imp_${Date.now()}_${index}`,
                        name: row['Ad Soyad'] || row['name'] || row['Name'] || 'İsimsiz',
                        role: parseInt(row['Kıdem'] || row['role'] || row['Role'] || '3'),
                        group: (row['Grup'] || row['group'] || row['Group'] || 'Genel') as Group,
                        
                        // Parse targets if they exist, otherwise default to 0
                        quotaService: parseInt(row['Servis Hedef'] || row['quotaService'] || row['Service Quota'] || '0'),
                        quotaEmergency: parseInt(row['Acil Hedef'] || row['quotaEmergency'] || row['Emergency Quota'] || '0'),
                        weekendLimit: parseInt(row['Haftasonu Limit'] || row['weekendLimit'] || row['Weekend Limit'] || '0'),
                        
                        // Parse days
                        offDays: parseList(row['İzinler'] || row['offDays'] || row['Off Days']),
                        requestedDays: parseList(row['İstekler'] || row['requestedDays'] || row['Requests'])
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