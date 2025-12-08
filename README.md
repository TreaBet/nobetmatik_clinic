# Nöbetmatik v20 Enterprise Edition

**Nöbetmatik v20**, sağlık kurumları için geliştirilmiş, yapay zeka destekli, adil ve optimum nöbet çizelgeleri oluşturan yeni nesil bir web uygulamasıdır. Karmaşık kısıtlamaları (kıdem, grup dengesi, izinler, yorgunluk düzeyi) yöneterek saniyeler içinde binlerce simülasyon yapar ve en ideal listeyi sunar.

![Status](https://img.shields.io/badge/Status-Stable-success) ![License](https://img.shields.io/badge/License-MIT-blue) ![Tech](https://img.shields.io/badge/Tech-React%20%7C%20TypeScript%20%7C%20Vite-indigo)

## 🚀 Özellikler

### 🧠 Akıllı Algoritmalar
*   **Monte Carlo Simülasyonu**: Binlerce olası senaryoyu test ederek matematiksel olarak en az sapmaya sahip sonucu bulur.
*   **Genetik Algoritma (Beta)**: Evrimsel hesaplama yöntemleriyle "imkansız" senaryolarda bile çözüm üretir.
*   **Yorgunluk Modeli**: Personelin stres seviyesini takip eder, üst üste zor nöbetleri engelleyerek tükenmişliği önler.
*   **Zor Gün Önceliği**: Hafta sonları ve tatiller gibi kritik günleri önceliklendirerek adil dağılım sağlar.

### 👥 Personel ve Servis Yönetimi
*   **Detaylı Profil**: Kıdem, Grup (A/B/C/D), nöbet hedefleri (Servis/Acil) ve özel kısıtlamalar.
*   **İzin ve İstek Yönetimi**: Personelin çalışamayacağı veya çalışmak istediği günleri kolayca işaretleyin.
*   **Excel Entegrasyonu**: Personel listesini Excel'den içe aktarın veya taslak oluşturun.
*   **Servis Kuralları**: Her servis için min/max kişi sayısı, zorunlu kıdemler ve grup tercihleri tanımlayın.

### 📊 Raporlama ve Paylaşım
*   **İnteraktif Çizelge**: Sürükle-bırak ile manuel düzenleme, anlık kural kontrolü.
*   **Gelişmiş İstatistikler**: Kişi bazlı hedef tutarlılık grafikleri ve adalet puanı hesaplaması.
*   **Dışa Aktarma**: Resmi formatta Excel raporları, kişisel takvim dosyaları (.ics) ve WhatsApp paylaşım metinleri.
*   **Salt Okunur Paylaşım**: Çizelgeyi link olarak personelle paylaşın.
*   **Yedekleme**: Tüm verileri JSON formatında yedekleyin ve geri yükleyin.

### 🎨 Modern Arayüz
*   **Karanlık Mod (Dark Mode)**: Göz yormayan, tam uyumlu karanlık tema.
*   **Responsive Tasarım**: Mobilden masaüstüne her cihazda sorunsuz çalışır.
*   **Görsel İpuçları**: Hafta sonu vurguları, zebra çizgili tablolar ve durum ikonları.

## 🛠️ Kurulum ve Çalıştırma

Bu proje React, TypeScript ve Vite ile geliştirilmiştir.

### Gereksinimler
*   Node.js (v18+)
*   npm veya yarn

### Yerel Geliştirme

```bash
# Bağımlılıkları yükleyin
npm install

# Geliştirme sunucusunu başlatın
npm run dev
```

Uygulama `http://localhost:3000` adresinde çalışacaktır.

### Docker ile Çalıştırma

```bash
docker-compose up -d --build
```

## 🏗️ Teknoloji Yığını

*   **Frontend**: React 18, TypeScript, Tailwind CSS
*   **Build Tool**: Vite
*   **Charts**: Recharts
*   **Data Processing**: XLSX (SheetJS)
*   **Icons**: Lucide React

## 📝 Lisans

Bu proje MIT lisansı ile lisanslanmıştır.