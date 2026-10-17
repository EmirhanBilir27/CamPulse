/**
 * CamPulse - Akıllı Kampüs ve Kulüp Koordinasyon Sistemi
 * Core Application Logic & Supabase Integration (Updated)
 */

// ==========================================
// 1. SUPABASE BAĞLANTISI VE YAPILANDIRMA
// ==========================================
const SUPABASE_URL = 'https://yrkugifzbfxfszitjztr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlya3VnaWZ6YmZ4ZnN6aXRqenRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5MDk2ODQsImV4cCI6MjEwNzQ4NTY4NH0.4iPf-dbN94DYb-PphCCTM-Tt7bvii4FEKfW8NN5WPPQ';

// Supabase istemcisini başlat
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Fallback Yönetici Listesi (Veritabanından Çekilemezse Kullanılacak)
let ADMIN_EMAILS = [
    'emirhanbilir947@gmail.com', 
    'osamaalhajomar7@gmail.com',
    'emircicek73@gmail.com',
    'abdulsametisan177@gmail.com',
    'ma9034403@gmail.com',
    'admin@gmail.com',
    'feyzafatallah71@gmail.com'
];


// ==========================================
// 2. UYGULAMA DURUMU (STATE MANAGEMENT)
// ==========================================
const APP_STATE = {
    calendarStartDate: new Date(), // Yıllık takvimin başlangıç tarihi (oklarla değişir)
    selectedDate: 'all',      // 'all' veya 'YYYY-MM-DD'
    activeTab: 'all',         // 'all' (Tüm Etkinlikler) veya 'my-events' (Etkinliklerim)
    events: [],               // Veritabanından çekilen ham etkinlikler
    joinedEvents: [],         // Kullanıcının katıldığı etkinlik ID'leri (Bulut Senkronize)
    currentUser: null         // Aktif oturum sahibi kullanıcı
};

let currentModalEventId = null;

// ==========================================
// PULL TO REFRESH (ANDROID / PWA) MANTIĞI
// ==========================================
let touchstartY = 0;
document.addEventListener('touchstart', e => { 
    touchstartY = e.touches[0].clientY; 
}, {passive: true});

document.addEventListener('touchend', e => {
    const touchendY = e.changedTouches[0].clientY;
    // Eğer sayfa en üstteyse ve aşağı doğru yeterince kaydırıldıysa
    if (window.scrollY === 0 && (touchendY - touchstartY) > 120 && APP_STATE.currentUser) {
        const ptr = document.getElementById('ptr-indicator');
        const icon = document.getElementById('ptr-icon');
        ptr.style.transform = 'translateY(80px)';
        icon.classList.add('fa-spin');
        
        fetchEvents().then(() => {
            setTimeout(() => {
                ptr.style.transform = 'translateY(0)';
                icon.classList.remove('fa-spin');
                showToast("Akış yenilendi.", "info");
            }, 500);
        });
    }
}, {passive: true});


// ==========================================
// 3. BAŞLATMA VE OTURUM KONTROLÜ
// ==========================================
window.onload = async () => {
    APP_STATE.calendarStartDate.setHours(0,0,0,0); // Saati sıfırla

    // Bugünün tarihini form inputuna varsayılan ata
    const todayStr = getLocalIsoDate(new Date());
    if (document.getElementById('addDate')) {
        document.getElementById('addDate').value = todayStr;
    }

    // Gerçek zamanlı oturum senkronizasyonu
    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
            APP_STATE.currentUser = session.user;
            loadJoinedEvents(); // Başka cihazda değiştiyse hemen yansır
        }
    });

    const { data: { session }, error } = await supabaseClient.auth.getSession();
    
    if (session && session.user) {
        APP_STATE.currentUser = session.user;
        await fetchAdmins(); // Dinamik Admin yetkilerini çek
        showMainScreen(session.user);
    } else {
        document.getElementById('main-screen').style.display = 'none';
        document.getElementById('auth-screen').style.display = 'flex';
    }
};

async function fetchAdmins() {
    // Veritabanında bir 'roles' veya 'profiles' tablosu olduğu varsayımıyla çalışır.
    // Eğer tablo yoksa kod çökmez, hardcoded fallback listesini (ADMIN_EMAILS) kullanmaya devam eder.
    try {
        const { data, error } = await supabaseClient.from('profiles').select('email').eq('role', 'admin');
        if (!error && data && data.length > 0) {
            ADMIN_EMAILS = data.map(admin => admin.email);
        }
    } catch (e) {
        console.log("Dinamik admin tablosu bulunamadı, varsayılan liste kullanılıyor.");
    }
}


// ==========================================
// 4. KİMLİK DOĞRULAMA (AUTH) FONKSİYONLARI
// ==========================================

async function register() {
    const email = document.getElementById('email-input').value.trim();
    const password = document.getElementById('password-input').value.trim();
    const kvkkChecked = document.getElementById('kvkk-checkbox').checked;
    
    if (!email || !password) {
        showAuthMessage("E-posta ve şifre alanları boş bırakılamaz.", "error");
        return;
    }

    if (!kvkkChecked) {
        showAuthMessage("Kayıt olmak için KVKK ve Kullanıcı Sözleşmesi'ni kabul etmelisiniz.", "error");
        return;
    }

    setAuthLoading('register', true);
    
    const { data, error } = await supabaseClient.auth.signUp({ 
        email: email, 
        password: password,
        options: {
            data: {
                joinedEvents: [] 
            }
        }
    });
    
    setAuthLoading('register', false);

    if (error) {
        showAuthMessage(translateAuthError(error.message), "error");
    } else {
        showAuthMessage("Kayıt başarılı! Hesabınız oluşturuldu, giriş yapabilirsiniz.", "success");
        document.getElementById('password-input').value = '';
    }
}

// app.js dosyası
async function login() {
    const email = document.getElementById('email-input').value.trim();
    const password = document.getElementById('password-input').value.trim();
    const kvkkChecked = document.getElementById('kvkk-checkbox').checked; // KVKK checkbox durumunu al
    
    if (!email || !password) {
        showAuthMessage("Giriş yapmak için e-posta ve şifrenizi girin.", "error");
        return;
    }

    // KVKK onay kontrolünü ekleyin
    if (!kvkkChecked) {
        showAuthMessage("Giriş yapmak için KVKK ve Kullanıcı Sözleşmesi'ni kabul etmelisiniz.", "error");
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
        await fetchAdmins();
        showMainScreen(data.user);
    }
}

async function resetPassword() {
    const email = document.getElementById('email-input').value.trim();
    if (!email) {
        showAuthMessage("Şifre sıfırlama linki göndermek için e-posta adresinizi yazın.", "warning");
        return;
    }

    const { data, error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.href,
    });

    if (error) {
        showAuthMessage(translateAuthError(error.message), "error");
    } else {
        showAuthMessage("Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.", "success");
    }
}

async function logout() {
    await supabaseClient.auth.signOut();
    
    APP_STATE.currentUser = null;
    APP_STATE.events = [];
    APP_STATE.joinedEvents = [];
    
    document.getElementById('main-screen').style.display = 'none';
    document.getElementById('auth-screen').style.display = 'flex';
    
    document.getElementById('password-input').value = '';
    document.getElementById('auth-message-box').classList.add('hidden');
    document.getElementById('admin-panel').style.display = 'none';
}


// ==========================================
// 5. ANA EKRAN VE ARAYÜZ YÖNETİMİ
// ==========================================
function showMainScreen(user) {
    if (!user) return;

    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('main-screen').style.display = 'flex';
    
    document.getElementById('user-email-display').innerText = user.email;

    const adminPanel = document.getElementById('admin-panel');
    if (ADMIN_EMAILS.includes(user.email)) {
        adminPanel.style.display = 'block';
    } else {
        adminPanel.style.display = 'none';
    }

    loadJoinedEvents();
    renderDays();
    fetchEvents();
}

function toggleAdminForm() {
    const form = document.getElementById('quickAddForm');
    form.style.display = (form.style.display === 'none') ? 'block' : 'none';
}

function setActiveTab(tab) {
    APP_STATE.activeTab = tab;
    
    const tabAll = document.getElementById('tab-all');
    const tabMy = document.getElementById('tab-my-events');
    const daysContainer = document.getElementById('daysListContainer');

    if (tab === 'all') {
        tabAll.className = "flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-cyan-500 text-white shadow-md";
        tabMy.className = "flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 text-slate-400 hover:text-slate-200";
        daysContainer.style.display = 'flex';
    } else {
        tabMy.className = "flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-cyan-500 text-white shadow-md";
        tabAll.className = "flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 text-slate-400 hover:text-slate-200";
        daysContainer.style.display = 'none';
    }

    renderEvents();
}


// ==========================================
// 6. VERİTABANI İŞLEMLERİ
// ==========================================

async function fetchEvents() {
    const loader = document.getElementById('loading-indicator');
    const container = document.getElementById('eventsContainer');
    
    loader.style.display = 'flex';
    container.innerHTML = '';

    const { data: events, error } = await supabaseClient
        .from('events')
        .select('*')
        .order('date', { ascending: true }); // Tarihe göre sırala
    
    loader.style.display = 'none';

    if (error) {
        console.error("Etkinlikler çekilemedi:", error);
        container.innerHTML = `
            <div class="text-center py-10 bg-red-950/20 rounded-3xl border border-red-900/50">
                <p class="text-red-400 font-bold">Veriler yüklenirken bir hata oluştu.</p>
                <p class="text-xs text-red-400/60 mt-2">${escapeHtml(error.message)}</p>
            </div>
        `;
        return;
    }

    APP_STATE.events = events || [];
    updateJoinedBadge();
    renderEvents();
}

async function handleAddEvent(e) {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submit-event-btn');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Yükleniyor...';
    submitBtn.disabled = true;

    const title = document.getElementById('addTitle').value.trim();
    const club = document.getElementById('addClub').value.trim();
    const location = document.getElementById('addLocation').value.trim();
    const dateStr = document.getElementById('addDate').value;
    const startStr = document.getElementById('addStartTime').value;
    const endStr = document.getElementById('addEndTime').value;
    const description = document.getElementById('addDesc').value.trim() || 'Açıklama girilmemiş.';
    const fileInput = document.getElementById('addPoster');
    
    const startVal = timeToVal(startStr);
    const endVal = timeToVal(endStr);

    if (endVal <= startVal) {
        showToast('Hata: Bitiş saati başlangıç saatinden önce olamaz.', 'error');
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        return;
    }

    let uploadedImageUrl = null;

    // Afiş Storage Yükleme
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        // Hata yakalama: Eğer "event-posters" adında bir storage bucket'i yoksa kod çökmez, resimsiz ekler.
        try {
            const { data: uploadData, error: uploadError } = await supabaseClient.storage
                .from('event-posters')
                .upload(fileName, file);
                
            if (!uploadError && uploadData) {
                const { data: { publicUrl } } = supabaseClient.storage.from('event-posters').getPublicUrl(fileName);
                uploadedImageUrl = publicUrl;
            } else {
                console.warn("Afiş yüklenemedi (Bucket oluşturulmamış olabilir).", uploadError);
            }
        } catch(err) {
            console.warn("Storage ayarları eksik.", err);
        }
    }

    // Hem eski pipe-formatı desteklemek için desciption birleştiriyoruz, hem de yeni kolonlara hazırlık yapıyoruz.
    const fullDesc = `${club} | ${location} | ${startStr}-${endStr} | ${description}`;
    const isoDate = new Date(dateStr).toISOString();

    const eventPayload = { 
        title: title, 
        description: fullDesc,
        date: isoDate
    };

    // Eğer Supabase'de image_url kolonu varsa onu doldurur (Yoksa hata fırlatmaz, sessizce yok sayar)
    if (uploadedImageUrl) {
        eventPayload.image_url = uploadedImageUrl;
    }
    eventPayload.participants_count = 0; // Başlangıçta sıfır

    const { error } = await supabaseClient.from('events').insert([eventPayload]);

    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;

    if (error) {
        // Eğer participants_count veya image_url kolonu DB'de henüz yoksa insert patlayabilir.
        // Fallback: Eski tablo yapısıyla tekrar dene.
        console.warn("Yeni kolonlarla ekleme başarısız, eski formata dönülüyor...", error);
        const fallbackPayload = { title: title, description: fullDesc, date: isoDate };
        const { error: fallbackError } = await supabaseClient.from('events').insert([fallbackPayload]);
        
        if (fallbackError) {
            showToast("Yetki Hatası: Etkinlik eklenemedi! Sadece yönetici işlem yapabilir.", "error");
        } else {
            successAdd(dateStr);
        }
    } else {
        successAdd(dateStr);
    }
}

function successAdd(dateStr) {
    showToast('Etkinlik başarıyla yayınlandı!', 'success');
    document.getElementById('quickAddForm').reset();
    document.getElementById('addDate').value = getLocalIsoDate(new Date()); // tarihi bugüne sıfırla
    toggleAdminForm();
    
    APP_STATE.selectedDate = dateStr; 
    // Eklenen etkinliğin tarihini görünür kılmak için başlangıç tarihini güncelle
    APP_STATE.calendarStartDate = new Date(dateStr);
    renderDays();
    fetchEvents();
}

async function deleteEvent(id, title) {
    if (!confirm(`"${title}" etkinliğini kalıcı olarak silmek istediğinize emin misiniz?`)) return;

    const card = document.getElementById(`event-card-${id}`);
    if (card) card.style.opacity = '0.5';

    const { error } = await supabaseClient.from('events').delete().eq('id', id);
    
    if (error) {
        if (card) card.style.opacity = '1';
        showToast("Silinemedi: Sadece yönetici etkinlik silebilir.", "error");
    } else {
        const idx = APP_STATE.joinedEvents.indexOf(id);
        if (idx > -1) {
            APP_STATE.joinedEvents.splice(idx, 1);
            saveJoinedEvents();
        }
        showToast('Etkinlik veritabanından silindi.', 'success');
        fetchEvents();
    }
}


// ==========================================
// 7. ARAYÜZ (UI) OLUŞTURUCULARI & RENDER (Yıllık Takvim Entegresi)
// ==========================================

function shiftCalendar(days) {
    const newDate = new Date(APP_STATE.calendarStartDate);
    newDate.setDate(newDate.getDate() + days);
    APP_STATE.calendarStartDate = newDate;
    renderDays();
}

function renderDays() {
    const container = document.getElementById('daysList');
    
    let html = '';
    
    const isAllActive = APP_STATE.selectedDate === 'all';
    html += `
        <button onclick="setDateFilter('all')" class="flex-1 px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
            isAllActive 
            ? 'bg-gradient-to-r from-indigo-500 to-cyan-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)] border border-indigo-400/30' 
            : 'bg-slate-800/90 text-slate-400 border border-slate-700/60 hover:border-slate-600 hover:text-slate-200'
        }">
            Tümü
        </button>
    `;

    // Seçili takvim tarihinden itibaren 7 gün renderla
    const dayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
    const monthNames = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

    for (let i = 0; i < 7; i++) {
        const current = new Date(APP_STATE.calendarStartDate);
        current.setDate(current.getDate() + i);
        
        const dateString = getLocalIsoDate(current); // YYYY-MM-DD
        const active = dateString === APP_STATE.selectedDate;
        
        const dayName = dayNames[current.getDay()];
        const dayNum = current.getDate();
        const monthName = monthNames[current.getMonth()];
        
        let label = `${dayNum} ${monthName} ${dayName}`;
        if (dateString === getLocalIsoDate(new Date())) label = "Bugün";

        html += `
            <button onclick="setDateFilter('${dateString}')" class="flex-1 px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                active 
                ? 'bg-gradient-to-r from-indigo-500 to-cyan-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)] border border-indigo-400/30' 
                : 'bg-slate-800/90 text-slate-400 border border-slate-700/60 hover:border-slate-600 hover:text-slate-200'
            }">
                ${label}
            </button>
        `;
    }

    container.innerHTML = html;
}

function setDateFilter(dateStr) {
    APP_STATE.selectedDate = dateStr;
    renderDays();
    renderEvents();
}

function renderEvents() {
    const container = document.getElementById('eventsContainer');
    const query = (document.getElementById('searchInput').value || '').toLowerCase();
    
    let filtered = [];

    if (APP_STATE.activeTab === 'all') {
        filtered = APP_STATE.events.filter(ev => {
            const parsed = parseEventData(ev);
            const matchesDate = APP_STATE.selectedDate === 'all' ? true : parsed.isoDateOnly === APP_STATE.selectedDate;
            const matchesSearch = ev.title.toLowerCase().includes(query) || 
                                  parsed.pureDesc.toLowerCase().includes(query) ||
                                  parsed.clubName.toLowerCase().includes(query);
            return matchesDate && matchesSearch;
        });

        // Tarih ve saate göre sırala
        filtered.sort((a, b) => {
            const pA = parseEventData(a);
            const pB = parseEventData(b);
            if (pA.isoDateOnly !== pB.isoDateOnly) return new Date(a.date) - new Date(b.date);
            return pA.startVal - pB.startVal;
        });

    } else {
        filtered = APP_STATE.events.filter(ev => {
            const isJoined = APP_STATE.joinedEvents.includes(ev.id);
            const parsed = parseEventData(ev);
            const matchesSearch = ev.title.toLowerCase().includes(query) || 
                                  parsed.pureDesc.toLowerCase().includes(query) ||
                                  parsed.clubName.toLowerCase().includes(query);
            return isJoined && matchesSearch;
        });

        filtered.sort((a, b) => {
            const pA = parseEventData(a);
            const pB = parseEventData(b);
            if (pA.isoDateOnly !== pB.isoDateOnly) return new Date(a.date) - new Date(b.date);
            return pA.startVal - pB.startVal;
        });
    }

    if (filtered.length === 0) {
        const isMyTab = APP_STATE.activeTab === 'my-events';
        container.innerHTML = `
            <div class="text-center py-16 bg-slate-800/30 rounded-3xl border border-dashed border-slate-700/50">
                <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-800 mb-4 shadow-inner">
                    <i class="fa-regular ${isMyTab ? 'fa-bookmark' : 'fa-calendar-xmark'} text-2xl text-slate-500"></i>
                </div>
                <h3 class="text-slate-300 font-bold mb-1">${isMyTab ? 'Takviminizde Etkinlik Yok' : 'Etkinlik Bulunamadı'}</h3>
                <p class="text-xs text-slate-500 max-w-xs mx-auto">
                    ${isMyTab 
                        ? 'Henüz hiçbir etkinliğe katılmadınız. "Tüm Etkinlikler" sekmesinden ilgilendiğiniz ders veya kulüpleri takviminize ekleyebilirsiniz.' 
                        : 'Bu güne veya arama kriterine uygun bir etkinlik henüz planlanmamış.'}
                </p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(ev => {
        const parsed = parseEventData(ev);
        const isJoined = APP_STATE.joinedEvents.includes(ev.id);
        const isAdmin = APP_STATE.currentUser && ADMIN_EMAILS.includes(APP_STATE.currentUser.email);
        
        const hasConflict = isJoined && checkEventConflict(ev.id);
        const showDayBadge = APP_STATE.activeTab === 'my-events' || APP_STATE.selectedDate === 'all';
        const participantCountText = parsed.participantsCount > 0 ? `<i class="fa-solid fa-fire text-orange-500 mr-1"></i> ${parsed.participantsCount} Katılımcı` : '';

        // Eğer afiş varsa, küçük bir thumbnail gösterelim
        const thumbnailHtml = parsed.imageUrl ? `
            <div class="w-16 h-16 shrink-0 rounded-xl overflow-hidden bg-slate-800 border border-slate-700">
                <img src="${parsed.imageUrl}" class="w-full h-full object-cover" alt="Afiş">
            </div>
        ` : '';

        return `
            <div id="event-card-${ev.id}" 
                 onclick="handleCardClick(event, '${ev.id}')"
                 class="event-card cursor-pointer rounded-3xl p-5 border transition-all ${
                    hasConflict 
                    ? 'conflict-card bg-red-950/20' 
                    : isJoined 
                        ? 'border-emerald-500/50 bg-emerald-950/10' 
                        : 'border-slate-700/60'
                 } space-y-4">
                
                <div class="flex items-start justify-between gap-4">
                    <div class="space-y-1.5 flex-1">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="inline-block text-[10px] font-black uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-md border border-indigo-500/20">
                                ${escapeHtml(parsed.clubName)}
                            </span>
                            ${showDayBadge ? `
                                <span class="inline-block text-[10px] font-bold text-cyan-300 bg-cyan-500/10 px-2.5 py-0.5 rounded-md border border-cyan-500/20">
                                    <i class="fa-regular fa-calendar mr-1"></i>${parsed.formattedDate}
                                </span>
                            ` : ''}
                            ${hasConflict ? `
                                <span class="inline-flex items-center gap-1 text-[10px] font-black uppercase text-red-400 bg-red-500/20 px-2 py-0.5 rounded-md border border-red-500/40" title="Takviminizde aynı saatte katıldığınız başka bir etkinlik var!">
                                    <i class="fa-solid fa-triangle-exclamation text-red-500 animate-pulse"></i>
                                    Saat Çakışması!
                                </span>
                            ` : ''}
                            ${participantCountText ? `
                                <span class="inline-block text-[10px] font-bold text-orange-300 bg-orange-500/10 px-2.5 py-0.5 rounded-md border border-orange-500/20">
                                    ${participantCountText}
                                </span>
                            ` : ''}
                        </div>
                        <h3 class="font-bold text-lg text-white leading-snug">${escapeHtml(ev.title)}</h3>
                    </div>
                    
                    ${thumbnailHtml}

                    ${isAdmin ? `
                        <button onclick="event.stopPropagation(); deleteEvent('${ev.id}', '${escapeHtml(ev.title)}')" class="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-colors border border-red-500/20">
                            <i class="fa-solid fa-trash-can text-sm"></i>
                        </button>
                    ` : ''}
                </div>

                <p class="text-sm text-slate-400 leading-relaxed line-clamp-2">${escapeHtml(parsed.pureDesc)}</p>

                <div class="flex items-center justify-between pt-3 border-t border-slate-700/50 text-xs">
                    <div class="flex items-center space-x-3 font-medium text-slate-300">
                        <span class="flex items-center gap-1.5"><i class="fa-regular fa-clock text-cyan-400"></i> ${escapeHtml(parsed.timeStr)}</span>
                        <span class="text-slate-600">•</span>
                        <span class="flex items-center gap-1.5 truncate max-w-[120px]"><i class="fa-solid fa-location-dot text-indigo-400"></i> ${escapeHtml(parsed.location)}</span>
                    </div>
                    
                    <div class="flex items-center gap-2">
                        <button onclick="event.stopPropagation(); toggleJoin('${ev.id}')" class="px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
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
            </div>
        `;
    }).join('');
}


// ==========================================
// 8. ETKİNLİK DETAY MODALI VE RATING
// ==========================================

function handleCardClick(event, eventId) {
    openEventModal(eventId);
}

function openEventModal(eventId) {
    const ev = APP_STATE.events.find(e => e.id === eventId);
    if (!ev) return;

    currentModalEventId = eventId;
    const parsed = parseEventData(ev);
    const isJoined = APP_STATE.joinedEvents.includes(ev.id);
    const hasConflict = isJoined && checkEventConflict(ev.id);

    // Afiş Yönetimi
    const posterContainer = document.getElementById('modalPosterContainer');
    const posterImg = document.getElementById('modalPoster');
    const headerSection = document.getElementById('modalHeaderSection');
    
    if (parsed.imageUrl) {
        posterImg.src = parsed.imageUrl;
        posterContainer.classList.remove('hidden');
        headerSection.classList.add('-mt-8'); // Resim üzerine bindirme efekti
    } else {
        posterImg.src = '';
        posterContainer.classList.add('hidden');
        headerSection.classList.remove('-mt-8');
    }

    document.getElementById('modalTitle').innerText = ev.title;
    document.getElementById('modalTime').innerText = `${parsed.formattedDate} | ${parsed.timeStr}`;
    document.getElementById('modalLocation').innerText = parsed.location;
    document.getElementById('modalDescription').innerText = parsed.pureDesc;

    // Katılımcı Sayısı
    const pCountElem = document.getElementById('modalParticipantsCount');
    if (parsed.participantsCount > 0) {
        document.getElementById('pCountText').innerText = parsed.participantsCount;
        pCountElem.classList.remove('hidden');
    } else {
        pCountElem.classList.add('hidden');
    }

    const badgesContainer = document.getElementById('modalBadges');
    badgesContainer.innerHTML = `
        <span class="text-[11px] font-black uppercase text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-md border border-indigo-500/20">
            ${escapeHtml(parsed.clubName)}
        </span>
    `;

    const alertBox = document.getElementById('modalConflictAlert');
    if (hasConflict) {
        alertBox.classList.remove('hidden');
    } else {
        alertBox.classList.add('hidden');
    }

    // Geçmiş Etkinlik Rating Kontrolü
    const ratingSection = document.getElementById('modalRatingSection');
    const starContainer = document.getElementById('starContainer');
    
    // Etkinliğin bitiş zamanı geçti mi? (Tarih + endVal saat)
    const eventEndDate = new Date(ev.date);
    eventEndDate.setHours(Math.floor(parsed.endVal), (parsed.endVal % 1) * 60, 0, 0);
    
    if (new Date() > eventEndDate && isJoined) {
        ratingSection.classList.remove('hidden');
        // Kullanıcı daha önce oy verdi mi diye lokal kontrol yapılabilir, basitleştirmek için statik 5 yıldız çiziyoruz
        let starsHtml = '';
        for (let i = 1; i <= 5; i++) {
            starsHtml += `<i class="fa-regular fa-star cursor-pointer hover:text-amber-400 text-slate-500 transition-colors" onclick="rateEvent('${ev.id}', ${i}, this)"></i>`;
        }
        starContainer.innerHTML = starsHtml;
    } else {
        ratingSection.classList.add('hidden');
    }

    const actionContainer = document.getElementById('modalActionContainer');
    // Eğer etkinlik bitmişse, Katıl butonuna gerek yok
    if (new Date() > eventEndDate) {
        actionContainer.innerHTML = `<span class="text-xs font-bold text-slate-500 bg-slate-800 px-4 py-2 rounded-xl">Etkinlik Sona Erdi</span>`;
    } else {
        actionContainer.innerHTML = `
            <button id="modalJoinBtn" onclick="toggleJoin('${ev.id}')" class="px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg ${
                isJoined 
                ? 'bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-600 hover:text-white' 
                : 'bg-gradient-to-r from-indigo-500 to-cyan-500 text-white hover:from-indigo-400 hover:to-cyan-400'
            }">
                <i class="fa-solid ${isJoined ? 'fa-xmark' : 'fa-plus'} mr-1.5"></i>
                ${isJoined ? 'Takvimimden Çıkar' : 'Takvime Ekle'}
            </button>
        `;
    }

    const modal = document.getElementById('eventDetailModal');
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeEventModal() {
    const modal = document.getElementById('eventDetailModal');
    modal.classList.add('hidden');
    document.body.style.overflow = 'auto';
    currentModalEventId = null;
}

// Rating gönderme (Veritabanında `event_ratings` tablosu gerektirir, yoksa sadece görsel efekt)
async function rateEvent(eventId, rating, element) {
    const stars = element.parentElement.children;
    for (let i = 0; i < 5; i++) {
        stars[i].className = i < rating 
            ? "fa-solid fa-star text-amber-400 cursor-pointer transition-all scale-110" 
            : "fa-regular fa-star text-slate-500 cursor-pointer transition-all";
    }
    showToast(`Etkinliğe ${rating} yıldız verdiniz!`, 'success');

    // DB kaydı (Hata verirse yoksayılır)
    try {
        await supabaseClient.from('event_ratings').insert([
            { event_id: eventId, user_id: APP_STATE.currentUser.id, rating: rating }
        ]);
    } catch(e) {}
}


// ==========================================
// 9. TAKVİM (ICS) VE ÇAKIŞMA MANTIĞI
// ==========================================

async function toggleJoin(eventId) {
    if (!APP_STATE.currentUser) return;

    const idx = APP_STATE.joinedEvents.indexOf(eventId);
    let newlyAdded = false;
    let incrementVal = 0;

    if (idx > -1) {
        APP_STATE.joinedEvents.splice(idx, 1);
        incrementVal = -1;
        showToast('Etkinlik kişisel takviminizden çıkarıldı.', 'info');
    } else {
        APP_STATE.joinedEvents.push(eventId);
        incrementVal = 1;
        newlyAdded = true;
    }
    
    saveJoinedEvents(); // User Metadata ile Buluta kaydet!
    updateJoinedBadge();

    // Katılımcı sayısını veritabanında güncelle (Tablo yapısında kolon yoksa hata vermeden geçilir)
    try {
        const ev = APP_STATE.events.find(e => e.id === eventId);
        if (ev && ev.participants_count !== undefined) {
            const newCount = Math.max(0, ev.participants_count + incrementVal);
            ev.participants_count = newCount; // Lokal UI için
            await supabaseClient.from('events').update({ participants_count: newCount }).eq('id', eventId);
        }
    } catch(e) {}

    if (newlyAdded) {
        if (checkEventConflict(eventId)) {
            showToast('Takvime eklendi, fakat başka bir etkinlikle saat çakışması var! ⚠️', 'warning');
        } else {
            showToast('Etkinlik kişisel takviminize eklendi!', 'success');
        }
    }

    renderEvents();

    if (currentModalEventId === eventId) {
        openEventModal(eventId); // Arayüzü yenile
    }
}

function checkEventConflict(targetEventId) {
    if (!APP_STATE.joinedEvents.includes(targetEventId)) return false;
    const targetEv = APP_STATE.events.find(e => e.id === targetEventId);
    if (!targetEv) return false;

    const targetParsed = parseEventData(targetEv);

    for (const otherId of APP_STATE.joinedEvents) {
        if (otherId === targetEventId) continue;
        const otherEv = APP_STATE.events.find(e => e.id === otherId);
        if (!otherEv) continue;

        const otherParsed = parseEventData(otherEv);

        // Artık gün sırasına göre değil, tam tarihe göre karşılaştırıyoruz
        if (targetParsed.isoDateOnly === otherParsed.isoDateOnly) {
            if (targetParsed.startVal < otherParsed.endVal && targetParsed.endVal > otherParsed.startVal) {
                return true;
            }
        }
    }
    return false;
}

function updateJoinedBadge() {
    const badge = document.getElementById('joinedCountBadge');
    if (badge) {
        badge.innerText = APP_STATE.joinedEvents.length;
    }
}

function loadJoinedEvents() {
    if (!APP_STATE.currentUser) return;
    
    const metadata = APP_STATE.currentUser.user_metadata;
    if (metadata && metadata.joinedEvents && Array.isArray(metadata.joinedEvents)) {
        APP_STATE.joinedEvents = metadata.joinedEvents;
        localStorage.setItem(`campulse_joined_${APP_STATE.currentUser.id}`, JSON.stringify(APP_STATE.joinedEvents));
    } else {
        const saved = localStorage.getItem(`campulse_joined_${APP_STATE.currentUser.id}`);
        if (saved) {
            try { 
                APP_STATE.joinedEvents = JSON.parse(saved); 
                saveJoinedEvents();
            } catch (e) { 
                APP_STATE.joinedEvents = []; 
            }
        } else {
            APP_STATE.joinedEvents = [];
        }
    }
    updateJoinedBadge();
    // Buluttan yeni geldi, UI'yi yenile
    if(document.getElementById('eventsContainer')) renderEvents();
}

async function saveJoinedEvents() {
    if (!APP_STATE.currentUser) return;
    
    localStorage.setItem(`campulse_joined_${APP_STATE.currentUser.id}`, JSON.stringify(APP_STATE.joinedEvents));
    
    const { data, error } = await supabaseClient.auth.updateUser({
        data: { joinedEvents: APP_STATE.joinedEvents }
    });

    if (!error && data?.user) {
        APP_STATE.currentUser = data.user; 
    } else {
        console.error("Takvim bulut ile eşitlenirken bir hata oluştu:", error);
    }
}

// ICS (Google / Apple Takvim) İndirme
function downloadICS() {
    if (!currentModalEventId) return;
    const ev = APP_STATE.events.find(e => e.id === currentModalEventId);
    if (!ev) return;
    
    const parsed = parseEventData(ev);
    
    // Tarih ve saat formatlama (YYYYMMDDTHHMMSSZ)
    const eventDate = new Date(ev.date);
    const startH = Math.floor(parsed.startVal);
    const startM = Math.round((parsed.startVal % 1) * 60);
    const endH = Math.floor(parsed.endVal);
    const endM = Math.round((parsed.endVal % 1) * 60);
    
    const startDate = new Date(eventDate);
    startDate.setHours(startH, startM, 0);
    
    const endDate = new Date(eventDate);
    endDate.setHours(endH, endM, 0);

    const formatICSDate = (date) => {
        return date.toISOString().replace(/-|:|\.\d+/g, '');
    };

    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
CALSCALE:GREGORIAN
BEGIN:VEVENT
SUMMARY:${ev.title}
DTSTART:${formatICSDate(startDate)}
DTEND:${formatICSDate(endDate)}
LOCATION:${parsed.location}
DESCRIPTION:${parsed.pureDesc}
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', `${ev.title.replace(/\s+/g, '_')}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast("Etkinlik takvime indirme işlemi başlatıldı.", "info");
}


// ==========================================
// 10. YARDIMCI VE BİLDİRİM FONKSİYONLARI
// ==========================================

function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toastMsg');
    const toastIcon = document.getElementById('toastIcon');

    toastMsg.innerText = msg;

    if (type === 'error') {
        toast.className = "fixed bottom-6 right-6 bg-red-600 text-white font-semibold text-sm px-4 py-3 rounded-xl shadow-[0_10px_40px_rgba(220,38,38,0.4)] transition-all duration-300 transform z-50 flex items-center space-x-2 max-w-sm";
        toastIcon.className = "fa-solid fa-triangle-exclamation text-base";
    } else if (type === 'warning') {
        toast.className = "fixed bottom-6 right-6 bg-amber-600 text-white font-semibold text-sm px-4 py-3 rounded-xl shadow-[0_10px_40px_rgba(217,119,6,0.4)] transition-all duration-300 transform z-50 flex items-center space-x-2 max-w-sm";
        toastIcon.className = "fa-solid fa-triangle-exclamation text-base";
    } else if (type === 'info') {
        toast.className = "fixed bottom-6 right-6 bg-slate-700 text-white font-semibold text-sm px-4 py-3 rounded-xl shadow-2xl transition-all duration-300 transform z-50 flex items-center space-x-2 max-w-sm";
        toastIcon.className = "fa-solid fa-bell text-base text-cyan-400";
    } else {
        toast.className = "fixed bottom-6 right-6 bg-emerald-600 text-white font-semibold text-sm px-4 py-3 rounded-xl shadow-[0_10px_40px_rgba(5,150,105,0.4)] transition-all duration-300 transform z-50 flex items-center space-x-2 max-w-sm";
        toastIcon.className = "fa-solid fa-circle-check text-base";
    }

    toast.classList.remove('translate-y-24', 'opacity-0', 'pointer-events-none');
    
    if (window.toastTimer) clearTimeout(window.toastTimer);
    
    window.toastTimer = setTimeout(() => {
        toast.classList.add('translate-y-24', 'opacity-0', 'pointer-events-none');
    }, 3500);
}

function showAuthMessage(msg, type) {
    const box = document.getElementById('auth-message-box');
    const text = document.getElementById('auth-message-text');
    const icon = document.getElementById('auth-message-icon');
    
    box.classList.remove('hidden', 'bg-red-500/10', 'text-red-400', 'border-red-500/20', 'bg-green-500/10', 'text-emerald-400', 'border-green-500/20', 'bg-amber-500/10', 'text-amber-400', 'border-amber-500/20');
    
    if (type === 'error') {
        box.classList.add('bg-red-500/10', 'text-red-400', 'border', 'border-red-500/20');
        icon.className = 'fa-solid fa-circle-exclamation';
    } else if (type === 'warning') {
        box.classList.add('bg-amber-500/10', 'text-amber-400', 'border', 'border-amber-500/20');
        icon.className = 'fa-solid fa-triangle-exclamation';
    } else {
        box.classList.add('bg-green-500/10', 'text-emerald-400', 'border', 'border-green-500/20');
        icon.className = 'fa-solid fa-check-circle';
    }
    
    text.innerText = msg;
}

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

// Mevcut dataların kırılmaması için hem eski pipe formatını, hem de yeni DB kolonlarını destekler.
function parseEventData(ev) {
    let clubName = "Kampüs Etkinliği";
    let location = "Belirtilmedi";
    let timeStr = "Saat Belirtilmedi";
    let pureDesc = ev.description || "Açıklama belirtilmedi.";
    
    if (ev.description && ev.description.includes('|')) {
        const parts = ev.description.split('|');
        if (parts.length >= 4) {
            clubName = parts[0].trim();
            location = parts[1].trim();
            timeStr = parts[2].trim();
            pureDesc = parts.slice(3).join('|').trim();
        }
    }

    const evDate = new Date(ev.date);
    const isoDateOnly = getLocalIsoDate(evDate); // YYYY-MM-DD
    
    const dayNames = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
    let dIndex = evDate.getDay() - 1;
    if (dIndex < 0) dIndex = 6;
    const formattedDate = `${evDate.getDate()} ${['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'][evDate.getMonth()]} ${dayNames[dIndex]}`;

    let startVal = 0;
    let endVal = 0;

    if (timeStr.includes('-')) {
        const times = timeStr.split('-');
        if (times.length === 2) {
            startVal = timeToVal(times[0].trim());
            endVal = timeToVal(times[1].trim());
        }
    }

    return { 
        clubName, location, timeStr, pureDesc, 
        isoDateOnly, formattedDate,
        startVal, endVal,
        imageUrl: ev.image_url || null,
        participantsCount: ev.participants_count || 0
    };
}

function timeToVal(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    if (parts.length < 2) return 0;
    const h = Number(parts[0]) || 0;
    const m = Number(parts[1]) || 0;
    return h + (m / 60.0);
}

// UTC sorunu yaşamamak için lokasyona göre YYYY-MM-DD string döndürür
function getLocalIsoDate(date) {
    const offset = date.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(date - offset)).toISOString().split('T')[0];
    return localISOTime;
}

function translateAuthError(msg) {
    const lowerMsg = msg.toLowerCase();
    if (lowerMsg.includes('invalid login credentials')) return "E-posta veya şifre hatalı.";
    if (lowerMsg.includes('email not confirmed')) return "Lütfen e-posta adresinizi doğrulayın.";
    if (lowerMsg.includes('user already registered')) return "Bu e-posta adresi zaten kayıtlı.";
    if (lowerMsg.includes('password should be at least')) return "Şifreniz en az 6 karakter olmalıdır.";
    return msg;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
// ==========================================
// 11. YASAL VE BİLGİLENDİRME MODALI YÖNETİMİ
// ==========================================

function openInfoModal(targetTab = 'kvkk') {
    const modal = document.getElementById('infoModal');
    if (!modal) return;

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Arka plan kaymasını engelle
    switchInfoTab(targetTab);
}

function closeInfoModal() {
    const modal = document.getElementById('infoModal');
    if (!modal) return;

    modal.classList.add('hidden');
    document.body.style.overflow = 'auto';
}

function switchInfoTab(tabName) {
    const tabs = ['kvkk', 'privacy', 'terms', 'support', 'about'];
    
    tabs.forEach(t => {
        const btn = document.getElementById(`info-tab-${t}`);
        const content = document.getElementById(`info-content-${t}`);
        
        if (t === tabName) {
            if (btn) {
                btn.className = "flex-1 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all bg-gradient-to-r from-indigo-500 to-cyan-500 text-white shadow-md";
            }
            if (content) {
                content.classList.remove('hidden');
            }
        } else {
            if (btn) {
                btn.className = "flex-1 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all text-slate-400 hover:text-slate-200";
            }
            if (content) {
                content.classList.add('hidden');
            }
        }
    });
}