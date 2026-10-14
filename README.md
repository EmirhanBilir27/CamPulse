# 🌊 CamPulse - Akıllı Kampüs Etkinlik & Kulüp Koordinasyon Sistemi

![CamPulse Banner](https://img.shields.io/badge/Status-Active-emerald?style=for-the-badge)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38BDF8?style=for-the-badge&logo=tailwind-css&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)

**CamPulse**, üniversite kampüslerindeki kulüp etkinliklerini, ders saatlerini ve sosyal faaliyetleri tek bir çatı altında toplayan; akıllı çakışma tespit motoruna sahip web tabanlı bir koordinasyon platformudur.

Öğrencilerin yoğun ders ve sosyal programları arasında yaşanan saat çakışmalarını önlemek, kulüp yöneticilerinin etkinlik planlamasını kolaylaştırmak amacıyla geliştirilmiştir.

---

## 🚀 Öne Çıkan Özellikler

- ⚡ **Akıllı Çakışma Tespit Motoru:** Takviminize eklediğiniz etkinliklerin saatleri birbiriyle örtüştüğünde sistem sizi anında uyarır.
- 🎓 **Çift Mod (Öğrenci & Yönetici):**
  - **Öğrenci Modu:** Etkinlik arama, haftalık takvime ekleme/çıkarma, detaylı bilgi inceleme.
  - **Yönetici Modu:** Yeni etkinlik/kurs tanımı oluşturma, lokasyon ve saat belirleme.
- 📅 **Haftalık Gün Şeridi & Kategori Filtreleme:** Pazartesi'den Pazar'a dinamik gün seçimi ve Yazılım, Kariyer, Sanat, Spor vb. kategorilere göre anlık filtreleme.
- 🔍 **Arama Barı:** Etkinlik adı, kulüp ismi veya amfi/derslik bilgisine göre anlık canlı arama.
- 🌙 **Modern Dark Mode Tasarımı:** Tailwind CSS ile hazırlanmış, göz yormayan, mobil uyumlu ve şık arayüz.
- 🔔 **Toast Bildirim Sistemi:** Ekleme, çıkarma ve bildirim adımlarında kullanıcıyı anlık bilgilendirme.

---

## 🛠️ Kullanılan Teknolojiler

| Teknoloji | Açıklama |
| :--- | :--- |
| **HTML5** | Anlamsal yapıyı oluşturan temel işaretleme dili |
| **Tailwind CSS (CDN)** | Hızlı, esnek ve modern UI bileşenleri için stil kütüphanesi |
| **JavaScript (ES6+)** | Çakışma algoritması, dinamik DOM yönetimi ve modal kontrolleri |
| **FontAwesome 6** | Arayüz ikonları |

---

## 📐 Akıllı Çakışma Tespit Mantığı

Sistem, öğrencinin takvimine eklediği etkinlikler arasında matematiksel olarak zaman çakışması olup olmadığını aşağıdaki algoritma ile kontrol eder:

```javascript
// Çakışma Kontrol Fonksiyonu Örneği
function getConflicts(targetEv) {
    let conflicts = [];
    events.forEach(ev => {
        if (ev.id === targetEv.id || ev.dayIndex !== targetEv.dayIndex || !ev.isJoined) return;

        // Matematiksel Örtüşme Şartı
        const overlaps = (targetEv.startVal < ev.endVal) && (targetEv.endVal > ev.startVal);
        if (overlaps) {
            conflicts.push(`${ev.clubName} (${ev.title})`);
        }
    });
    return conflicts;
}
```

---

## 📂 Proje Yapısı

Proje tek bir HTML dosyası içerisinde (Single-file) çalışacak şekilde optimize edilmiştir:

```text
campulse/
└── index.html          # HTML, CSS (Tailwind CDN) ve JavaScript mantığını içerir
```

---

## 💻 Kurulum ve Çalıştırma

Proje herhangi bir derleme (build) aşaması veya arka plan bağımlılığı (Node.js/npm) gerektirmez.

1. Depoyu bilgisayarınıza klonlayın veya indirin:
   ```bash
   git clone https://github.com/kullaniciadi/campulse.git
   ```
2. Proje dizinine gidin:
   ```bash
   cd campulse
   ```
3. `index.html` dosyasını favori tarayıcınızda çift tıklayarak açın veya VS Code **Live Server** eklentisi ile çalıştırın.

---

## 🎯 Kullanım Rehberi

1. **Günün Etkinliklerini İnceleyin:** Üst kısımdaki gün butonlarına tıklayarak haftanın istediğiniz gününe geçiş yapın.
2. **Kategoriye Göre Filtreleyin:** İlgilendiğiniz kategori butonuna basarak aramanızı daraltın.
3. **Takvime Etkinlik Ekleyin:** Kart üzerindeki **"Takvime Ekle"** butonuna basarak etkinliği kişisel programınıza ekleyin. Eğer aynı saatte başka bir etkinliğiniz varsa, kart kırmızı renkle uyarılacaktır.
4. **Etkinlik Ekleyin (Kulüp Yöneticileri):**
   - Sağ üstteki anahtardan **Yönetici** moduna geçin.
   - Açılan **"+ Etkinlik Yükle"** butonuna basarak formu doldurun ve yayına alın.

---

## 🤝 Katkıda Bulunma

1. Bu depoyu çatallayın (Fork).
2. Yeni özelliğinizi içeren bir dal (branch) oluşturun (`git checkout -b feature/YeniOzellik`).
3. Değişikliklerinizi işleyin (`git commit -m 'Yeni özellik eklendi'`).
4. Dalınıza gönderin (`git push origin feature/YeniOzellik`).
5. Bir **Pull Request (PR)** açın.

---

## 📄 Lisans

Bu proje [MIT Lisansı](LICENSE) altında lisanslanmıştır.