
import React, { useEffect, useState } from 'react';
import { DBService } from '../services/db';
import { Card, Button } from './ui';
import { ICONS } from '../constants';
import { Trash2, Upload, ArrowRight } from 'lucide-react';
import { AppMode } from '../types';

interface HistoryManagerProps {
    onLoad: (year: number, month: number) => void;
    isBlackAndWhite: boolean;
    mode: AppMode;
}

export const HistoryManager: React.FC<HistoryManagerProps> = ({ onLoad, isBlackAndWhite, mode }) => {
    const [historyList, setHistoryList] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchHistory = async () => {
        setLoading(true);
        const data = await DBService.getHistory(mode);
        setHistoryList(data);
        setLoading(false);
    };

    useEffect(() => {
        fetchHistory();
    }, [mode]);

    const handleDelete = async (year: number, month: number) => {
        if (window.confirm(`${year} - ${month + 1}. Ay kaydını silmek istediğinize emin misiniz?`)) {
            await DBService.deleteHistory(mode, year, month);
            fetchHistory();
        }
    };

    const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Yükleniyor...</div>;
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className={`flex justify-between items-end p-6 rounded-xl border shadow-sm transition-colors ${isBlackAndWhite ? '!bg-slate-900 !border-slate-800' : 'bg-white border-gray-200'}`}>
              <div>
                <h2 className={`text-2xl font-bold ${isBlackAndWhite ? 'text-white' : 'text-gray-900'}`}>Geçmiş Çizelgeler</h2>
                <p className={`mt-1 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>
                    Arşivlenen ayları buradan yönetebilirsiniz. Silinen veriler geri getirilemez.
                </p>
              </div>
              <Button variant="secondary" onClick={fetchHistory} className={`text-xs ${isBlackAndWhite ? '!bg-slate-800 text-white !border-slate-700' : ''}`}>
                 Yenile
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {historyList.length === 0 && (
                    <div className="col-span-full text-center py-10 opacity-50">
                        <div className="flex justify-center mb-2">{ICONS.Calendar}</div>
                        <p>Henüz arşivlenmiş bir çizelge bulunmuyor.</p>
                    </div>
                )}
                
                {historyList.map((item, index) => (
                    <Card key={`${item.year}-${item.month}`} className={`p-5 border-l-4 hover-lift transition-all ${isBlackAndWhite ? '!bg-slate-900 !border-slate-800 border-l-gray-500' : 'border-l-gray-400'}`}>
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className={`text-xl font-bold ${isBlackAndWhite ? 'text-white' : 'text-gray-800'}`}>
                                    {monthNames[item.month]} {item.year}
                                </h3>
                                <div className={`text-xs mt-1 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>
                                    {new Date(item.createdAt).toLocaleString('tr-TR')}
                                </div>
                            </div>
                            <div className={`p-2 rounded-lg font-bold text-lg ${isBlackAndWhite ? 'bg-slate-800 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                                {item.year}
                            </div>
                        </div>

                        <div className={`text-sm mb-6 p-3 rounded-lg ${isBlackAndWhite ? 'bg-slate-800 text-gray-300' : 'bg-gray-50 text-gray-600'}`}>
                            <div className="flex justify-between mb-1">
                                <span>Toplam Nöbet:</span>
                                <span className="font-bold">
                                    {item.stats ? item.stats.reduce((acc: number, s: any) => acc + s.totalShifts, 0) : '?'}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span>Personel Sayısı:</span>
                                <span className="font-bold">{item.stats?.length || '?'}</span>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <Button 
                                onClick={() => onLoad(item.year, item.month)} 
                                className={`flex-1 text-xs ${isBlackAndWhite ? '!bg-indigo-600 !border-indigo-500' : ''}`}
                            >
                                <Upload className="w-3.5 h-3.5 mr-2" /> Yükle & Düzenle
                            </Button>
                            <Button 
                                variant="danger" 
                                onClick={() => handleDelete(item.year, item.month)}
                                className="px-3"
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
};
