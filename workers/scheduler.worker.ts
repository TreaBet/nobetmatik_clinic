
import { Scheduler as NurseScheduler } from '../modules/nurse/scheduler';
import { Scheduler as DoctorScheduler } from '../modules/doctor/scheduler';
import { Staff, Service, SchedulerConfig, DaySchedule } from '../types';

interface WorkerMessage {
    mode: 'doctor' | 'nurse';
    staff: Staff[];
    services: Service[];
    config: SchedulerConfig;
    previousSchedule: DaySchedule[] | null;
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
    const { mode, staff, services, config, previousSchedule } = e.data;

    try {
        let result;
        if (mode === 'nurse') {
            const scheduler = new NurseScheduler(staff, services, config);
            // Nurse scheduler constructor logic is slightly different, it doesn't take previousSchedule in current implementation
            // If needed in future, update NurseScheduler to accept it.
            result = scheduler.generate();
        } else {
            const scheduler = new DoctorScheduler(staff, services, config, previousSchedule);
            result = scheduler.generate();
        }
        
        self.postMessage({ status: 'success', result });
    } catch (error: any) {
        self.postMessage({ status: 'error', message: error.message });
    }
};
