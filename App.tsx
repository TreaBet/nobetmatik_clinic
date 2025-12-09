
import React, { useState } from 'react';
import DoctorApp from './modules/doctor/DoctorApp';
import NurseApp from './modules/nurse/NurseApp';
import { ShieldCheck, Heart } from 'lucide-react';
import { AppMode } from './types';

export default function App() {
  const [mode, setMode] = useState<AppMode | null>(null);

  if (mode === 'doctor') {
    return <DoctorApp onBack={() => setMode(null)} />;
  }

  if (mode === 'nurse') {
    return <NurseApp onBack={() => setMode(null)} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      {/* Background Gradient */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950 -z-10"></div>
      
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12 animate-fade-in">
           <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight mb-4 drop-shadow-xl">
             Nöbetmatik
           </h1>
           <p className="text-slate-400 text-lg md:text-xl font-light tracking-wide">
             Kurumsal Akıllı Nöbet Yönetim Sistemi
           </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12">
           {/* Doctor Module Card */}
           <button 
             onClick={() => setMode('doctor')}
             className="group relative bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-3xl p-8 hover:bg-slate-800/80 transition-all duration-300 hover:scale-[1.02] text-left hover:border-indigo-500/50 hover:shadow-2xl hover:shadow-indigo-500/10"
           >
             <div className="absolute top-6 right-6 p-3 bg-indigo-500/10 rounded-2xl group-hover:bg-indigo-600 transition-colors duration-300">
               <ShieldCheck className="w-8 h-8 text-indigo-400 group-hover:text-white transition-colors" />
             </div>
             <div className="mt-8">
               <h2 className="text-3xl font-bold text-white mb-2">Doktor</h2>
               <p className="text-slate-400 leading-relaxed font-medium">
                 Kıdem esaslı, servis öncelikli ve karmaşık nöbet kuralları için özelleştirilmiş modül.
               </p>
             </div>
             <div className="mt-8 flex items-center text-indigo-400 font-bold group-hover:translate-x-2 transition-transform">
               Giriş Yap &rarr;
             </div>
           </button>

           {/* Nurse Module Card */}
           <button 
             onClick={() => setMode('nurse')}
             className="group relative bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-3xl p-8 hover:bg-slate-800/80 transition-all duration-300 hover:scale-[1.02] text-left hover:border-rose-500/50 hover:shadow-2xl hover:shadow-rose-500/10"
           >
             <div className="absolute top-6 right-6 p-3 bg-rose-500/10 rounded-2xl group-hover:bg-rose-600 transition-colors duration-300">
               <Heart className="w-8 h-8 text-rose-400 group-hover:text-white transition-colors" />
             </div>
             <div className="mt-8">
               <h2 className="text-3xl font-bold text-white mb-2">Hemşire</h2>
               <p className="text-slate-400 leading-relaxed font-medium">
                 Birim bazlı, vardiya sistemine uygun ve esnek nöbet dağılımı için özelleştirilmiş modül.
               </p>
             </div>
             <div className="mt-8 flex items-center text-rose-400 font-bold group-hover:translate-x-2 transition-transform">
               Giriş Yap &rarr;
             </div>
           </button>
        </div>
        
        <div className="mt-16 text-center text-slate-600 text-sm">
          © 2025 Nöbetmatik Enterprise. Tüm hakları saklıdır.
        </div>
      </div>
    </div>
  );
}
