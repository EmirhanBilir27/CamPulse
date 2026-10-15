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

// Yönetici (Admin) Yetkisine Sahip E-Posta Listesi
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
    selectedDayIndex: 1,      // 1 = Pazartesi, 2 = Salı...
    activeTab: 'all',         // 'all' (Tüm Etkinlikler) veya 'my-events' (Etkinliklerim)
    events: [],               // Veritabanından çekilen ham etkinlikler
    joinedEvents: [],         // Kullanıcının katıldığı etkinlik ID'leri (LocalStorage)
    currentUser: null         // Aktif oturum sahibi kullanıcı
};

let currentModalEventId = null;


// ==========================================
// 3. BAŞLATMA VE OTURUM KONTROLÜ
// ==========================================
window.onload = async () => {
    // Oturum durumunu kontrol et
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    
    if (session && session.user) {
        APP_STATE.currentUser = session.user;
        showMainScreen(session.user);
    } else {
        document.getElementById('main-screen').style.display = 'none';
        document.getElementById('auth-screen').style.display = 'flex';
    }
};


// ==========================================
// 4. KİMLİK DOĞRULAMA (AUTH) FONKSİYONLARI
// ==========================================

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
        document.getElementById('password-input').value = '';
    }
}

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

    // Yönetici kontrolü
    const adminPanel = document.getElementById('admin-panel');
    if (ADMIN_EMAILS.includes(user.email)) {
        adminPanel.style.display = 'block';
    } else {
        adminPanel.style.display = 'none';
    }

    // Katılınan etkinlikleri yerel hafızadan yükle
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
        .order('created_at', { ascending: false });
    
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
    const dayIndex = Number(document.getElementById('addDayIndex').value);
    const startStr = document.getElementById('addStartTime').value;
    const endStr = document.getElementById('addEndTime').value;
    const description = document.getElementById('addDesc').value.trim() || 'Açıklama girilmemiş.';
    
    const startVal = timeToVal(startStr);
    const endVal = timeToVal(endStr);

    if (endVal <= startVal) {
        showToast('Hata: Bitiş saati başlangıç saatinden önce olamaz.', 'error');
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        return;
    }

    const { error } = await supabaseClient.from('events').insert([
        { 
            title: title, 
            description: `${club} | ${location} | ${startStr}-${endStr} | ${description}`,
            date: getNextDateForDay(dayIndex).toISOString()
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
        
        APP_STATE.selectedDayIndex = dayIndex;
        renderDays();
        fetchEvents();
    }
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
        // Takvim listesinden de çıkar
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
// 7. ARAYÜZ (UI) OLUŞTURUCULARI & RENDER
// ==========================================

function renderDays() {
    const container = document.getElementById('daysList');
    container.innerHTML = APP_STATE.days.map((day, idx) => {
        const dayNum = idx + 1;
        const active = dayNum === APP_STATE.selectedDayIndex;
        return `
            <button onclick="setDay(${dayNum})" class="flex-1 px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all ${
                active 
                ? 'bg-gradient-to-r from-indigo-500 to-cyan-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)] border border-indigo-400/30' 
                : 'bg-slate-800/90 text-slate-400 border border-slate-700/60 hover:border-slate-600 hover:text-slate-200'
            }">
                ${day}
            </button>
        `;
    }).join('');
}

function renderEvents() {
    const container = document.getElementById('eventsContainer');
    const query = (document.getElementById('searchInput').value || '').toLowerCase();
    
    let filtered = [];

    if (APP_STATE.activeTab === 'all') {
        filtered = APP_STATE.events.filter(ev => {
            const parsed = parseEventData(ev);
            const matchesDay = parsed.dayIndex === APP_STATE.selectedDayIndex;
            const matchesSearch = ev.title.toLowerCase().includes(query) || 
                                  parsed.pureDesc.toLowerCase().includes(query) ||
                                  parsed.clubName.toLowerCase().includes(query);
            return matchesDay && matchesSearch;
        });
    } else {
        // "Etkinliklerim" sekmesi: Sadece takvime katılanları listele
        filtered = APP_STATE.events.filter(ev => {
            const isJoined = APP_STATE.joinedEvents.includes(ev.id);
            const parsed = parseEventData(ev);
            const matchesSearch = ev.title.toLowerCase().includes(query) || 
                                  parsed.pureDesc.toLowerCase().includes(query) ||
                                  parsed.clubName.toLowerCase().includes(query);
            return isJoined && matchesSearch;
        });

        // Etkinliklerim sekmesinde gün sırasına göre diz
        filtered.sort((a, b) => {
            const pA = parseEventData(a);
            const pB = parseEventData(b);
            if (pA.dayIndex !== pB.dayIndex) return pA.dayIndex - pB.dayIndex;
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
        
        // ÇAKIŞMA KONTROLÜ: SADECE TAKVİME EKLENEN VE ÇAKIŞAN ETKİNLİKLERDE
        const hasConflict = isJoined && checkEventConflict(ev.id);

        const dayName = APP_STATE.days[parsed.dayIndex - 1] || 'Günü Belirtilmedi';

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
                
                <div class="flex items-start justify-between gap-3">
                    <div class="space-y-1.5">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="inline-block text-[10px] font-black uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-md border border-indigo-500/20">
                                ${escapeHtml(parsed.clubName)}
                            </span>
                            ${APP_STATE.activeTab === 'my-events' ? `
                                <span class="inline-block text-[10px] font-bold text-cyan-300 bg-cyan-500/10 px-2.5 py-0.5 rounded-md border border-cyan-500/20">
                                    <i class="fa-regular fa-calendar mr-1"></i>${dayName}
                                </span>
                            ` : ''}
                            ${hasConflict ? `
                                <span class="inline-flex items-center gap-1 text-[10px] font-black uppercase text-red-400 bg-red-500/20 px-2 py-0.5 rounded-md border border-red-500/40" title="Takviminizde aynı saatte katıldığınız başka bir etkinlik var!">
                                    <i class="fa-solid fa-triangle-exclamation text-red-500 animate-pulse"></i>
                                    Saat Çakışması!
                                </span>
                            ` : ''}
                        </div>
                        <h3 class="font-bold text-lg text-white leading-snug">${escapeHtml(ev.title)}</h3>
                    </div>
                    
                    ${isAdmin ? `
                        <button onclick="event.stopPropagation(); deleteEvent('${ev.id}', '${escapeHtml(ev.title)}')" class="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-colors border border-red-500/20">
                            <i class="fa-solid fa-trash-can text-sm"></i>
                        </button>
                    ` : ''}
                </div>

                <!-- İki Satırla Sınırlandırılmış Önizleme Metni -->
                <p class="text-sm text-slate-400 leading-relaxed line-clamp-2">${escapeHtml(parsed.pureDesc)}</p>

                <div class="flex items-center justify-between pt-3 border-t border-slate-700/50 text-xs">
                    <div class="flex items-center space-x-3 font-medium text-slate-300">
                        <span class="flex items-center gap-1.5"><i class="fa-regular fa-clock text-cyan-400"></i> ${escapeHtml(parsed.timeStr)}</span>
                        <span class="text-slate-600">•</span>
                        <span class="flex items-center gap-1.5"><i class="fa-solid fa-location-dot text-indigo-400"></i> ${escapeHtml(parsed.location)}</span>
                    </div>
                    
                    <div class="flex items-center gap-2">
                        <span class="text-[11px] font-semibold text-cyan-400 hover:underline flex items-center gap-1 hidden sm:inline-flex">
                            Detay <i class="fa-solid fa-chevron-right text-[9px]"></i>
                        </span>
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
// 8. ETKİNLİK DETAY MODALI
// ==========================================

function handleCardClick(event, eventId) {
    // Buton tıklamaları haricinde kartın genelini tıklayınca modal aç
    openEventModal(eventId);
}

function openEventModal(eventId) {
    const ev = APP_STATE.events.find(e => e.id === eventId);
    if (!ev) return;

    currentModalEventId = eventId;
    const parsed = parseEventData(ev);
    const isJoined = APP_STATE.joinedEvents.includes(ev.id);
    const hasConflict = isJoined && checkEventConflict(ev.id);
    const dayName = APP_STATE.days[parsed.dayIndex - 1] || 'Günü Belirtilmedi';

    document.getElementById('modalTitle').innerText = ev.title;
    document.getElementById('modalTime').innerText = `${dayName} | ${parsed.timeStr}`;
    document.getElementById('modalLocation').innerText = parsed.location;
    document.getElementById('modalDescription').innerText = parsed.pureDesc;

    // Rozetler
    const badgesContainer = document.getElementById('modalBadges');
    badgesContainer.innerHTML = `
        <span class="text-[11px] font-black uppercase text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-md border border-indigo-500/20">
            ${escapeHtml(parsed.clubName)}
        </span>
    `;

    // Çakışma Uyarısı Gösterimi
    const alertBox = document.getElementById('modalConflictAlert');
    if (hasConflict) {
        alertBox.classList.remove('hidden');
    } else {
        alertBox.classList.add('hidden');
    }

    // Aksiyon Butonu
    const actionContainer = document.getElementById('modalActionContainer');
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

// Modal arka planına tıklayınca kapatma
document.getElementById('eventDetailModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'eventDetailModal') {
        closeEventModal();
    }
});


// ==========================================
// 9. TAKVİM VE ÇAKIŞMA MANTIĞI
// ==========================================

function setDay(index) {
    APP_STATE.selectedDayIndex = index;
    renderDays();
    renderEvents();
}

function toggleJoin(eventId) {
    if (!APP_STATE.currentUser) return;

    const idx = APP_STATE.joinedEvents.indexOf(eventId);
    let newlyAdded = false;

    if (idx > -1) {
        APP_STATE.joinedEvents.splice(idx, 1);
        showToast('Etkinlik kişisel takviminizden çıkarıldı.', 'info');
    } else {
        APP_STATE.joinedEvents.push(eventId);
        newlyAdded = true;
    }
    
    saveJoinedEvents();
    updateJoinedBadge();

    // Sadece yeni eklendiyse ve saat çakışması varsa uyarı bildirimi ver
    if (newlyAdded) {
        if (checkEventConflict(eventId)) {
            showToast('Takvime eklendi, fakat başka bir etkinlikle saat çakışması var! ⚠️', 'warning');
        } else {
            showToast('Etkinlik kişisel takviminize eklendi!', 'success');
        }
    }

    renderEvents();

    // Eğer detay modalı açıksa, buton durumunu güncelle
    if (currentModalEventId === eventId) {
        openEventModal(eventId);
    }
}

// Sadece takvime katılım yapılmış etkinlikler arasında aynı gün ve çakışan saat kontrolü
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

        // Aynı gündeler mi?
        if (targetParsed.dayIndex === otherParsed.dayIndex) {
            // Saat aralıkları çakışıyor mu? (Start1 < End2 AND End1 > Start2)
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
    const saved = localStorage.getItem(`campulse_joined_${APP_STATE.currentUser.id}`);
    if (saved) {
        try { 
            APP_STATE.joinedEvents = JSON.parse(saved); 
        } catch (e) { 
            APP_STATE.joinedEvents = []; 
        }
    } else {
        APP_STATE.joinedEvents = [];
    }
    updateJoinedBadge();
}

function saveJoinedEvents() {
    if (!APP_STATE.currentUser) return;
    localStorage.setItem(`campulse_joined_${APP_STATE.currentUser.id}`, JSON.stringify(APP_STATE.joinedEvents));
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
    let dayIndex = evDate.getDay();
    if (dayIndex === 0) dayIndex = 7; // Pazar = 7

    let startVal = 0;
    let endVal = 0;

    if (timeStr.includes('-')) {
        const times = timeStr.split('-');
        if (times.length === 2) {
            startVal = timeToVal(times[0].trim());
            endVal = timeToVal(times[1].trim());
        }
    }

    return { clubName, location, timeStr, pureDesc, dayIndex, startVal, endVal };
}

function timeToVal(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    if (parts.length < 2) return 0;
    const h = Number(parts[0]) || 0;
    const m = Number(parts[1]) || 0;
    return h + (m / 60.0);
}

function getNextDateForDay(targetDayIndex) {
    const date = new Date();
    let currentDay = date.getDay();
    if (currentDay === 0) currentDay = 7;
    
    let daysToAdd = targetDayIndex - currentDay;
    if (daysToAdd < 0) daysToAdd += 7;
    
    date.setDate(date.getDate() + daysToAdd);
    date.setHours(12, 0, 0, 0); 
    return date;
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