
import { Staff, Service, RoleConfig, UnitConstraint, Preset } from '../types';

export interface AppData {
    version: string;
    timestamp: string;
    staff: Staff[];
    services: Service[];
    roleConfigs: Record<number, RoleConfig>;
    config: {
        month: number;
        year: number;
        randomizeDays: boolean;
        preventEveryOther: boolean;
        holidays?: number[];
        useFatigueModel?: boolean;
        useGeneticAlgorithm?: boolean;
        // Nurse Specific Configs
        dailyTotalTarget?: number;
    };
    // Nurse Specific Extra Data
    unitConstraints?: UnitConstraint[];
    customUnits?: string[];
    customSpecialties?: string[];
    presets?: Preset[];
}

export const exportToJSON = (
    staff: Staff[],
    services: Service[],
    roleConfigs: Record<number, RoleConfig>,
    config: { 
        month: number; 
        year: number; 
        randomizeDays: boolean; 
        preventEveryOther: boolean;
        holidays?: number[];
        useFatigueModel?: boolean;
        useGeneticAlgorithm?: boolean;
        dailyTotalTarget?: number;
    },
    extraData?: {
        unitConstraints?: UnitConstraint[];
        customUnits?: string[];
        customSpecialties?: string[];
        presets?: Preset[];
    }
) => {
    const data: AppData = {
        version: "2.1",
        timestamp: new Date().toISOString(),
        staff,
        services,
        roleConfigs,
        config,
        unitConstraints: extraData?.unitConstraints,
        customUnits: extraData?.customUnits,
        customSpecialties: extraData?.customSpecialties,
        presets: extraData?.presets
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Nobetmatik_Yedek_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

export const importFromJSON = async (file: File): Promise<AppData> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target?.result as string);
                if (!json.staff || !json.services) {
                    reject(new Error("Geçersiz yedek dosyası formatı."));
                }
                resolve(json);
            } catch (error) {
                reject(error);
            }
        };
        reader.readAsText(file);
    });
};
