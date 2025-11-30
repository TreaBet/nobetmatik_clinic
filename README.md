# Nöbetmatik v20 Enterprise Edition

**Nöbetmatik v20**, hastaneler ve sağlık kurumları için geliştirilmiş; kıdem, grup dengesi, nöbet sayısı hedefleri ve özel kısıtlamaları (off günleri, istekler) dikkate alarak **Monte Carlo Simülasyonu** ile en adil nöbet listesini oluşturan web tabanlı bir otomasyon sistemidir.

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![Tech](https://img.shields.io/badge/stack-React%20%7C%20TypeScript%20%7C%20Tailwind-indigo)
![License](https://img.shields.io/badge/license-MIT-green)

## 🚀 Özellikler

### 🧠 Akıllı Algoritma
- **Monte Carlo Simülasyonu:** Milyonlarca olasılığı deneyerek en düşük hata puanına sahip çizelgeyi seçer.
- **Adil Dağıtım:** Nöbet sayılarını (Acil/Servis) hedeflere en yakın şekilde dağıtır.
- **Grup Dengesi (A/B/C/D):** Aynı güne aynı ekipten yığılma olmasını engeller.
- **Günaşırı Koruması:** Personelin peş peşe veya çok sık aralıklarla nöbet tutmasını engeller (Opsiyonel).
- **Hafta Sonu Eşitleme:** Cumartesi ve Pazar nöbetlerini personel arasında dengeler.

### 🛠️ Gelişmiş Yönetim
- **Excel Entegrasyonu:** Personel listesini Excel'den toplu yükleme ve oluşan listeyi Excel formatında indirme.
- **Manuel Düzenleme Modu:** Otomatik oluşan listede kutucuklara tıklayarak uygun personelleri görebilir ve anlık değişim yapabilirsiniz.
- **Kıdem Bazlı Kurallar:** Servislere sadece belirli kıdemdeki (Örn: Kıdem 1, 2) personellerin yazılmasını sağlar.
- **Kalıcı Hafıza (Local Storage):** Verileriniz tarayıcıda saklanır, sayfayı yenileseniz bile kaybolmaz.

### 🎨 Modern Arayüz
- **Responsive Tasarım:** Tablet ve masaüstü uyumlu.
- **Gece/Gündüz Modu:** Yüksek kontrastlı (Siyah/Beyaz) mod ile yazıcı dostu çıktı alma imkanı.
- **İstatistik Grafikleri:** Hedeflenen ve gerçekleşen nöbet sayılarını görsel olarak karşılaştırma.

---

## 📦 Kurulum ve Çalıştırma

Proje modern web teknolojileri (Vite, React, TypeScript) ile geliştirilmiştir.

### Ön Gereksinimler
- Node.js (v18 veya üzeri önerilir)
- npm veya yarn

### 1. Yerel (Local) Kurulum

```bash
# Projeyi klonlayın (veya dosyaları indirin)
git clone https://github.com/kullaniciadi/nobetmatik-v20.git

# Proje dizinine girin
cd nobetmatik-v20

# Bağımlılıkları yükleyin
npm install

# Geliştirme sunucusunu başlatın
npm run dev
```
Tarayıcınızda `http://localhost:3000` (veya terminalde belirtilen port) adresine gidin.

### 2. Docker ile Çalıştırma

Projede `docker-compose.yml` hazırdır. Tek komutla ayağa kaldırabilirsiniz.

```bash
docker-compose up --build -d
```
Konteyner ayağa kalktıktan sonra `http://localhost` adresinden erişebilirsiniz.

---

## 📖 Kullanım Kılavuzu

Sistem 3 ana aşamadan oluşur:

### 1. Personel Yönetimi
- **Excel'den Yükle:** Taslak Excel dosyasını indirip doldurarak personelleri toplu yükleyebilirsiniz.
- **Manuel Ekle:** Tek tek isim, kıdem ve grup bilgisi girerek personel ekleyebilirsiniz.
- **Kıdem Ayarları:** "Kıdem Bazlı Toplu Ayarlar" panelinden, örneğin tüm "Kıdem 1" doktorları için aylık nöbet hedefini topluca güncelleyebilirsiniz.
- **İzin/İstek:** Tablodaki ilgili sütunlara personelin izinli olduğu (Off) veya nöbet istediği günleri virgülle ayırarak girin (Örn: 5, 12, 20).

### 2. Servis Kuralları
- Nöbet tutulacak noktaları (Acil, Servis, Yoğun Bakım vb.) tanımlayın.
- **Min/Max Kişi:** O gün o serviste en az ve en çok kaç kişi olacağını belirleyin.
- **Kıdem Kısıtlaması:** "Yazılabilir Kıdemler" alanından o nöbeti kimlerin tutabileceğini seçin.
- **Acil Durumu:** Eğer servis "Acil" olarak işaretlenirse, istatistiklerde "Acil Kotası"ndan düşer.

### 3. Çizelge Oluşturma
- Ay ve Yıl seçimi yapın.
- **"Listeyi Oluştur"** butonuna basın. Algoritma yaklaşık 1-2 saniye içinde en uygun listeyi oluşturacaktır.
- **Düzenleme:** Oluşan listede beğenmediğiniz bir yer varsa "Manuel Düzenle" butonuna basın, ilgili kutucuğa tıklayın ve o gün müsait olan başka bir personeli seçin.
- **Excel İndir:** Listeyi son haliyle bilgisayarınıza indirin.

---

## 🛠️ Teknoloji Yığını

- **Core:** React 18, TypeScript, Vite
- **UI:** Tailwind CSS, Lucide Icons
- **Data:** ExcelJS (Import/Export), Recharts (Grafikler)
- **State Management:** React Hooks + LocalStorage

## 📝 Lisans

Bu proje MIT lisansı ile lisanslanmıştır. Kurumsal ve kişisel kullanıma açıktır.
