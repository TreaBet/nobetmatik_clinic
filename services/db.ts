
import { Staff, Service, ScheduleResult, AppMode } from '../types';

const getStorageKeys = (mode: AppMode) => ({
    STAFF: `${mode}_staff`,
    SERVICES: `${mode}_services`,
    CONFIG: `${mode}_config`,
    HISTORY: `${mode}_history`
});

export const DBService = {
    
    // --- STAFF METHODS ---
    async saveStaff(mode: AppMode, staffList: Staff[]) {
        localStorage.setItem(getStorageKeys(mode).STAFF, JSON.stringify(staffList));
    },

    async getStaff(mode: AppMode): Promise<Staff[] | null> {
        const data = localStorage.getItem(getStorageKeys(mode).STAFF);
        return data ? JSON.parse(data) : null;
    },

    // --- SERVICE METHODS ---
    async saveServices(mode: AppMode, services: Service[]) {
        localStorage.setItem(getStorageKeys(mode).SERVICES, JSON.stringify(services));
    },

    async getServices(mode: AppMode): Promise<Service[] | null> {
        const data = localStorage.getItem(getStorageKeys(mode).SERVICES);
        return data ? JSON.parse(data) : null;
    },

    // --- CONFIG METHODS ---
    async saveConfig(mode: AppMode, config: any) {
        localStorage.setItem(getStorageKeys(mode).CONFIG, JSON.stringify(config));
    },

    async getConfig(mode: AppMode): Promise<any> {
        const data = localStorage.getItem(getStorageKeys(mode).CONFIG);
        return data ? JSON.parse(data) : null;
    },

    // --- HISTORY / ARCHIVE METHODS ---
    async archiveSchedule(mode: AppMode, year: number, month: number, result: ScheduleResult) {
        const keys = getStorageKeys(mode);
        const historyData = localStorage.getItem(keys.HISTORY);
        let history = historyData ? JSON.parse(historyData) : [];
        
        const newEntry = {
            year,
            month,
            schedule: result.schedule,
            stats: result.stats,
            createdAt: new Date().toISOString()
        };

        // Check if exists and replace, or push
        const index = history.findIndex((h: any) => h.year === year && h.month === month);
        if (index >= 0) {
            history[index] = newEntry;
        } else {
            history.push(newEntry);
        }

        localStorage.setItem(keys.HISTORY, JSON.stringify(history));
    },

    async getHistory(mode: AppMode): Promise<any[]> {
        const data = localStorage.getItem(getStorageKeys(mode).HISTORY);
        return data ? JSON.parse(data).sort((a: any, b: any) => {
             // Sort descending by date
             if (b.year !== a.year) return b.year - a.year;
             return b.month - a.month;
        }) : [];
    },

    async deleteHistory(mode: AppMode, year: number, month: number) {
        const keys = getStorageKeys(mode);
        const data = localStorage.getItem(keys.HISTORY);
        if (!data) return;
        let history = JSON.parse(data);
        history = history.filter((h: any) => !(h.year === year && h.month === month));
        localStorage.setItem(keys.HISTORY, JSON.stringify(history));
    },

    async getPreviousMonthSchedule(mode: AppMode, currentYear: number, currentMonth: number) {
        let prevYear = currentYear;
        let prevMonth = currentMonth - 1;
        if (prevMonth < 0) {
            prevMonth = 11;
            prevYear--;
        }

        const data = localStorage.getItem(getStorageKeys(mode).HISTORY);
        if (!data) return null;
        
        const history = JSON.parse(data);
        const entry = history.find((h: any) => h.year === prevYear && h.month === prevMonth);
        return entry ? entry.schedule : null;
    }
};
