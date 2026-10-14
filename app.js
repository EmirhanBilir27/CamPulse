/**
 * CamPulse - Akıllı Kampüs ve Kulüp Koordinasyon Sistemi
 * Core Application Logic & Supabase Integration
 */

// ==========================================
// 1. SUPABASE BAĞLANTISI VE YAPILANDIRMA
// ==========================================
const SUPABASE_URL = 'https://yrkugifzbfxfszitjztr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlya3VnaWZ6YmZ4ZnN6aXRqenRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5MDk2ODQsImV4cCI6MjEwNzQ4NTY4NH0.4iPf-dbN94DYb-PphCCTM-Tt7bvii4FEKfW8NN5WPPQ';

// Supabase istemcisini başlat
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Yönetici (Admin) Yetkisine Sahip E-Posta
// BUNU EKLE:
const ADMIN_EMAILS = [
    'emirhanbilir947@gmail.com', 
    'osamaalhajomar7@gmail.com',
    'feyzafatallah71@gmail.com'
];


// ==========================================
// 2. UYGULAMA DURUMU (STATE MANAGEMENT)
// ==========================================
const APP_STATE = {
    days: ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'],
    categories: ['Tümü', 'Yazılım & Teknoloji', 'Kariyer', 'Sanat & Müzik', 'Spor', 'Sosyal Sorumluluk'],
    selectedDayIndex: 1,      // Varsayılan: Pazartesi
    selectedCategory: 'Tümü', // Varsayılan: Tümü
    events: [],               // Veritabanından çekilecek ham etkinlikler
    joinedEvents: [],         // Kullanıcının katıldığı etkinlik ID'leri (LocalStorage'da tutulur)
    currentUser: null         // Aktif oturum sahibi kullanıcı
};


// ==========================================
// 3. BAŞLATMA VE OTURUM KONTROLÜ
// ==========================================
window.onload = async () => {
    // Katılınan etkinlikleri yerel hafızadan yükle
    loadJoinedEvents();
    
    // Oturum durumunu kontrol et
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    
    if (session && session.user) {
        // Oturum varsa ana ekranı yükle
        APP_STATE.currentUser = session.user;
        showMainScreen(session.user);
    } else {
        // Oturum yoksa giriş ekranını göster
        document.getElementById('main-screen').style.display = 'none';
        document.getElementById('auth-screen').style.display = 'flex';
    }
};


// ==========================================
// 4. KİMLİK DOĞRULAMA (AUTH) FONKSİYONLARI
// ==========================================

// Kayıt Ol
async function register() {
    const email = document.getElementById('email-input').value.trim();
    const password = document.getElementById('password-input').value.trim();
    
    if (!email || !password) {
        showAuthMessage("E-posta ve şifre alanları boş bırakılamaz.", "error");
        return;
    }

    setAuthLoading('register', true);
    
    const { data, error } = await supabaseClient.auth.signUp({ 
        email: email, 
        password: password 
    });
    
    setAuthLoading('register', false);

    if (error) {
        showAuthMessage(translateAuthError(error.message), "error");
    } else {
        showAuthMessage("Kayıt başarılı! Hesabınız oluşturuldu, giriş yapabilirsiniz.", "success");
        // Şifre kutusunu temizle
        document.getElementById('password-input').value = '';
    }
}

// Giriş Yap
async function login() {
    const email = document.getElementById('email-input').value.trim();
    const password = document.getElementById('password-input').value.trim();
    
    if (!email || !password) {
        showAuthMessage("Giriş yapmak için e-posta ve şifrenizi girin.", "error");
        return;
    }

    setAuthLoading('login', true);
    
    const { data, error } = await supabaseClient.auth.signInWithPassword({ 
        email: email, 
        password: password 
    });
    
    setAuthLoading('login', false);

    if (error) {
        showAuthMessage(translateAuthError(error.message), "error");
    } else {
        APP_STATE.currentUser = data.user;
        showMainScreen(data.user);
    }
}

// Çıkış Yap
async function logout() {
    await supabaseClient.auth.signOut();
    
    APP_STATE.currentUser = null;
    APP_STATE.events = [];
    
    // Ekranları değiştir
    document.getElementById('main-screen').style.display = 'none';
    document.getElementById('auth-screen').style.display = 'flex';
    
    // Formları temizle
    document.getElementById('password-input').value = '';
    document.getElementById('auth-message-box').classList.add('hidden');
    document.getElementById('admin-panel').style.display = 'none';
}


// ==========================================
// 5. ANA EKRAN VE YÖNETİCİ (ADMIN) YETKİLENDİRMESİ
// ==========================================
function showMainScreen(user) {
    if (!user) return;

    // Arayüz geçişi
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('main-screen').style.display = 'flex';
    
    // Kullanıcı bilgisini başlığa yaz
    document.getElementById('user-email-display').innerText = user.email;

    // GÜVENLİK KONTROLÜ: SADECE ADMIN E-POSTASI İSE PANELİ GÖSTER
    const adminPanel = document.getElementById('admin-panel');
    if (ADMIN_EMAILS.includes(user.email)) {
        adminPanel.style.display = 'block';
    } else {
        adminPanel.style.display = 'none';
    }

    // Arayüz filtrelerini oluştur ve verileri çek
    renderDays();
    renderCategories();
    fetchEvents();
}

function toggleAdminForm() {
    const form = document.getElementById('quickAddForm');
    if (form.style.display === 'none') {
        form.style.display = 'block';
    } else {
        form.style.display = 'none';
    }
}


// ==========================================
// 6. VERİTABANI (SUPABASE) İŞLEMLERİ
// ==========================================

// Etkinlikleri Veritabanından Çek
async function fetchEvents() {
    const loader = document.getElementById('loading-indicator');
    const container = document.getElementById('eventsContainer');
    
    loader.style.display = 'flex';
    container.innerHTML = ''; // Temizle

    const { data: events, error } = await supabaseClient
        .from('events')
        .select('*')
        .order('created_at', { ascending: false }); // En son eklenen en üstte
    
    loader.style.display = 'none';

    if (error) {
        console.error("Etkinlikler çekilemedi:", error);
        container.innerHTML = `
            <div class="text-center py-10 bg-red-950/20 rounded-3xl border border-red-900/50">
                <p class="text-red-400 font-bold">Veriler yüklenirken bir hata oluştu.</p>
                <p class="text-xs text-red-400/60 mt-2">${error.message}</p>
            </div>
        `;
        return;
    }

    // Verileri global duruma kaydet ve ekrana bas
    APP_STATE.events = events || [];
    renderEvents();
}

// Yönetici: Yeni Etkinlik Ekle
async function handleAddEvent(e) {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submit-event-btn');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Yükleniyor...';
    submitBtn.disabled = true;

    // Form verilerini al
    const title = document.getElementById('addTitle').value.trim();
    const club = document.getElementById('addClub').value.trim();
    const location = document.getElementById('addLocation').value.trim();
    const dayIndex = Number(document.getElementById('addDayIndex').value);
    const startStr = document.getElementById('addStartTime').value;
    const endStr = document.getElementById('addEndTime').value;
    const description = document.getElementById('addDesc').value.trim() || 'Açıklama girilmemiş.';
    
    // Rastgele kategori seçimi (Basitleştirilmiş form için formda kategori yoksa)
    const category = APP_STATE.categories[1]; // Yazılım & Teknoloji

    // Saatleri sayısal değere çevir (Çakışma hesabı için: 14:30 -> 14.5)
    const startVal = timeToVal(startStr);
    const endVal = timeToVal(endStr);

    if (endVal <= startVal) {
        showToast('Hata: Bitiş saati başlangıç saatinden önce olamaz.', 'error');
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        return;
    }

    // Supabase'e ekle (Tablonda eksik sütun varsa SQL'den eklemen gerekebilir. Mevcut SQL'ine göre title, description, date ekliyorum)
    const { error } = await supabaseClient.from('events').insert([
        { 
            title: title, 
            description: `${club} | ${location} | ${startStr}-${endStr} | ${description}`, // Şimdilik tüm detayı description'a gömüyoruz
            date: getNextDateForDay(dayIndex).toISOString() // Gerçek tarih hesaplayıcı
        }
    ]);

    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;

    if (error) {
        showToast("Yetki Hatası: Etkinlik eklenemedi! Sadece yönetici işlem yapabilir.", "error");
        console.error(error);
    } else {
        showToast('Etkinlik başarıyla yayınlandı!', 'success');
        document.getElementById('quickAddForm').reset();
        toggleAdminForm();
        
        // Sadece eklenen güne odaklan ve listeyi güncelle
        APP_STATE.selectedDayIndex = dayIndex;
        renderDays();
        fetchEvents();
    }
}

// Yönetici: Etkinlik Sil
async function deleteEvent(id, title) {
    if (!confirm(`"${title}" etkinliğini kalıcı olarak silmek istediğinize emin misiniz?`)) return;

    // UI'dan hemen gizle (Optimistic update)
    const card = document.getElementById(`event-card-${id}`);
    if (card) card.style.opacity = '0.5';

    const { error } = await supabaseClient.from('events').delete().eq('id', id);
    
    if (error) {
        if (card) card.style.opacity = '1';
        showToast("Silinemedi: Sadece yönetici etkinlik silebilir.", "error");
    } else {
        showToast('Etkinlik veritabanından silindi.', 'success');
        fetchEvents(); // Listeyi yenile
    }
}


// ==========================================
// 7. ARAYÜZ (UI) OLUŞTURUCULARI (RENDERERS)
// ==========================================

// Haftanın Günlerini Oluştur
function renderDays() {
    const container = document.getElementById('daysList');
    container.innerHTML = APP_STATE.days.map((day, idx) => {
        const dayNum = idx + 1;
        const active = dayNum === APP_STATE.selectedDayIndex;
        return `
            <button onclick="setDay(${dayNum})" class="px-5 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all ${
                active 
                ? 'bg-gradient-to-r from-indigo-500 to-cyan-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)] border border-indigo-400/30' 
                : 'bg-slate-800/90 text-slate-400 border border-slate-700/60 hover:border-slate-600 hover:text-slate-200'
            }">
                ${day}
            </button>
        `;
    }).join('');
}

// Kategorileri Oluştur
function renderCategories() {
    const container = document.getElementById('categoriesList');
    container.innerHTML = APP_STATE.categories.map(cat => {
        const active = cat === APP_STATE.selectedCategory;
        return `
            <button onclick="setCategory('${cat}')" class="px-4 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                active 
                ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/40 font-bold' 
                : 'bg-slate-900/80 text-slate-500 border border-slate-800 hover:text-slate-300'
            }">
                ${cat}
            </button>
        `;
    }).join('');
}

// Etkinlikleri Listele ve Filtrele
function renderEvents() {
    const container = document.getElementById('eventsContainer');
    const query = (document.getElementById('searchInput').value || '').toLowerCase();
    
    // Veritabanından gelen veriyi filtrele
    const filtered = APP_STATE.events.filter(ev => {
        // Tablondaki date sütunundan günü buluyoruz (Supabase'den gelen timestamp)
        const evDate = new Date(ev.date);
        let evDayIndex = evDate.getDay(); 
        if (evDayIndex === 0) evDayIndex = 7; // Pazar gününü 7 yap (JS'de normalde 0'dır)

        const matchesDay = evDayIndex === APP_STATE.selectedDayIndex;
        const matchesSearch = ev.title.toLowerCase().includes(query) || 
                              (ev.description && ev.description.toLowerCase().includes(query));
        
        return matchesDay && matchesSearch;
    });

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="text-center py-16 bg-slate-800/30 rounded-3xl border border-dashed border-slate-700/50">
                <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-800 mb-4 shadow-inner">
                    <i class="fa-regular fa-calendar-xmark text-2xl text-slate-500"></i>
                </div>
                <h3 class="text-slate-300 font-bold mb-1">Etkinlik Bulunamadı</h3>
                <p class="text-xs text-slate-500 max-w-xs mx-auto">Bu güne veya arama kriterine uygun bir etkinlik henüz planlanmamış.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(ev => {
        // SQL yapında açıklama sütununda birleştirdiğimiz verileri ayrıştırıyoruz
        // Format varsayımı: "Kulüp | Konum | 14:00-15:30 | Gerçek Açıklama"
        let clubName = "Kampüs Etkinliği";
        let location = "Belirtilmedi";
        let timeStr = "Saat Belirtilmedi";
        let pureDesc = ev.description;
        
        if (ev.description && ev.description.includes('|')) {
            const parts = ev.description.split('|');
            if (parts.length >= 4) {
                clubName = parts[0].trim();
                location = parts[1].trim();
                timeStr = parts[2].trim();
                pureDesc = parts.slice(3).join('|').trim();
            }
        }

        const isJoined = APP_STATE.joinedEvents.includes(ev.id);
        const isAdmin = APP_STATE.currentUser && ADMIN_EMAILS.includes(APP_STATE.currentUser.email);

        // Kart Şablonu
        return `
            <div id="event-card-${ev.id}" class="event-card rounded-3xl p-5 border ${isJoined ? 'border-emerald-500/50 bg-emerald-950/10' : 'border-slate-700/60'} space-y-4">
                
                <div class="flex items-start justify-between">
                    <div>
                        <span class="inline-block text-[10px] font-black uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded-md mb-2">
                            ${clubName}
                        </span>
                        <h3 class="font-bold text-lg text-white leading-tight">${ev.title}</h3>
                    </div>
                    
                    ${isAdmin ? `
                        <button onclick="deleteEvent('${ev.id}', '${ev.title}')" class="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-colors border border-red-500/20">
                            <i class="fa-solid fa-trash-can text-sm"></i>
                        </button>
                    ` : ''}
                </div>

                <p class="text-sm text-slate-400 leading-relaxed line-clamp-2">${pureDesc}</p>

                <div class="flex items-center justify-between pt-3 border-t border-slate-700/50">
                    <div class="flex items-center space-x-3 text-xs font-medium text-slate-300">
                        <span class="flex items-center gap-1.5"><i class="fa-regular fa-clock text-cyan-400"></i> ${timeStr}</span>
                        <span class="text-slate-600">•</span>
                        <span class="flex items-center gap-1.5"><i class="fa-solid fa-location-dot text-slate-500"></i> ${location}</span>
                    </div>
                    
                    <button onclick="toggleJoin('${ev.id}')" class="px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
                        isJoined 
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 group' 
                        : 'bg-slate-700/80 text-white hover:bg-indigo-600'
                    }">
                        <i class="fa-solid ${isJoined ? 'fa-check group-hover:hidden' : 'fa-plus'} mr-1"></i>
                        <i class="fa-solid fa-xmark hidden group-hover:inline-block mr-1"></i>
                        <span class="group-hover:hidden">${isJoined ? 'Katılıyorsun' : 'Katıl'}</span>
                        <span class="hidden group-hover:inline-block">Vazgeç</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}


// ==========================================
// 8. KULLANICI ETKİLEŞİMİ VE YARDIMCILAR
// ==========================================

// Gün Değiştirme
function setDay(index) {
    APP_STATE.selectedDayIndex = index;
    renderDays();
    renderEvents();
}

// Kategori Değiştirme
function setCategory(cat) {
    APP_STATE.selectedCategory = cat;
    renderCategories();
    renderEvents();
}

// Etkinliğe Katıl / Ayrıl (LocalStorage tabanlı bireysel takvim)
function toggleJoin(eventId) {
    const idx = APP_STATE.joinedEvents.indexOf(eventId);
    if (idx > -1) {
        APP_STATE.joinedEvents.splice(idx, 1); // Çıkar
        showToast('Etkinlik kişisel takviminden çıkarıldı.', 'info');
    } else {
        APP_STATE.joinedEvents.push(eventId); // Ekle
        showToast('Etkinlik kişisel takvimine eklendi!', 'success');
    }
    
    // Tarayıcı hafızasına kaydet
    localStorage.setItem(`campulse_joined_${APP_STATE.currentUser.id}`, JSON.stringify(APP_STATE.joinedEvents));
    
    // Arayüzü yenile
    renderEvents();
}

// Hafızadan katılım bilgilerini çek
function loadJoinedEvents() {
    if (!APP_STATE.currentUser) return;
    const saved = localStorage.getItem(`campulse_joined_${APP_STATE.currentUser.id}`);
    if (saved) {
        try { APP_STATE.joinedEvents = JSON.parse(saved); } 
        catch (e) { APP_STATE.joinedEvents = []; }
    }
}


// ==========================================
// 9. UI GERİ BİLDİRİM SİSTEMLERİ (TOAST & LOADERS)
// ==========================================

// Toast Mesajı Gösterici
function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toastMsg');
    const toastIcon = document.getElementById('toastIcon');

    toastMsg.innerText = msg;

    if (type === 'error') {
        toast.className = "fixed bottom-6 right-6 bg-red-600 text-white font-semibold text-sm px-4 py-3 rounded-xl shadow-[0_10px_40px_rgba(220,38,38,0.4)] transition-all duration-300 transform z-50 flex items-center space-x-2 max-w-sm";
        toastIcon.className = "fa-solid fa-triangle-exclamation text-base";
    } else if (type === 'info') {
        toast.className = "fixed bottom-6 right-6 bg-slate-700 text-white font-semibold text-sm px-4 py-3 rounded-xl shadow-2xl transition-all duration-300 transform z-50 flex items-center space-x-2 max-w-sm";
        toastIcon.className = "fa-solid fa-bell text-base text-cyan-400";
    } else {
        toast.className = "fixed bottom-6 right-6 bg-emerald-600 text-white font-semibold text-sm px-4 py-3 rounded-xl shadow-[0_10px_40px_rgba(5,150,105,0.4)] transition-all duration-300 transform z-50 flex items-center space-x-2 max-w-sm";
        toastIcon.className = "fa-solid fa-circle-check text-base";
    }

    toast.classList.remove('translate-y-24', 'opacity-0', 'pointer-events-none');
    
    // Mevcut zamanlayıcı varsa temizle (üst üste tıklamalar için)
    if(window.toastTimer) clearTimeout(window.toastTimer);
    
    window.toastTimer = setTimeout(() => {
        toast.classList.add('translate-y-24', 'opacity-0', 'pointer-events-none');
    }, 3000);
}

// Giriş/Kayıt Ekranı Uyarı Kutusu
function showAuthMessage(msg, type) {
    const box = document.getElementById('auth-message-box');
    const text = document.getElementById('auth-message-text');
    const icon = document.getElementById('auth-message-icon');
    
    box.classList.remove('hidden', 'bg-red-500/10', 'text-red-400', 'border-red-500/20', 'bg-green-500/10', 'text-emerald-400', 'border-green-500/20');
    
    if (type === 'error') {
        box.classList.add('bg-red-500/10', 'text-red-400', 'border', 'border-red-500/20');
        icon.className = 'fa-solid fa-circle-exclamation';
    } else {
        box.classList.add('bg-green-500/10', 'text-emerald-400', 'border', 'border-green-500/20');
        icon.className = 'fa-solid fa-check-circle';
    }
    
    text.innerText = msg;
}

// Buton Yükleniyor Animasyonu Kontrolü
function setAuthLoading(action, isLoading) {
    const btnText = document.getElementById(`${action}-text`);
    const loader = document.getElementById(`${action}-loader`);
    const btn = document.getElementById(`${action}-btn`);
    
    if (isLoading) {
        btnText.classList.add('hidden');
        loader.classList.remove('hidden');
        btn.disabled = true;
        btn.style.opacity = '0.7';
    } else {
        btnText.classList.remove('hidden');
        loader.classList.add('hidden');
        btn.disabled = false;
        btn.style.opacity = '1';
    }
}


// ==========================================
// 10. YARDIMCI FONKSİYONLAR (UTILS)
// ==========================================

// Supabase İngilizce Hatalarını Türkçeye Çevir
function translateAuthError(msg) {
    const lowerMsg = msg.toLowerCase();
    if (lowerMsg.includes('invalid login credentials')) return "E-posta veya şifre hatalı.";
    if (lowerMsg.includes('email not confirmed')) return "Lütfen e-posta adresinizi doğrulayın.";
    if (lowerMsg.includes('user already registered')) return "Bu e-posta adresi zaten kayıtlı.";
    if (lowerMsg.includes('password should be at least')) return "Şifreniz en az 6 karakter olmalıdır.";
    return msg;
}

// Saati ondalık sayıya çevirir (14:30 -> 14.5)
function timeToVal(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h + (m / 60.0);
}

// Seçilen gün indexine göre en yakın gelecekteki tam tarihi hesaplar (Supabase veritabanı için)
function getNextDateForDay(targetDayIndex) {
    const date = new Date();
    // JS'de pazar=0, bizde pazar=7. O yüzden ayarlama yapıyoruz
    let currentDay = date.getDay();
    if (currentDay === 0) currentDay = 7;
    
    let daysToAdd = targetDayIndex - currentDay;
    if (daysToAdd < 0) daysToAdd += 7; // Geçmiş günse haftaya ekle
    
    date.setDate(date.getDate() + daysToAdd);
    // Saat kısmını sıfırla ki aramalar stabil olsun
    date.setHours(12, 0, 0, 0); 
    return date;
}