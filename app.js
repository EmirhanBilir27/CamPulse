/* CamPulse - Supabase istemci uygulaması. Yetki denetimleri veritabanında yapılır. */
'use strict';

const SUPABASE_URL = 'https://yrkugifzbfxfszitjztr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJIUzI1NiIsInJlZiI6Inlya3VnaWZ6YmZ4ZnN6aXRqenRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5MDk2ODQsImV4cCI6MjEwNzQ4NTY4NH0.4iPf-dbN94DYb-PphCCTM-Tt7bvii4FEKfW8NN5WPPQ';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

const APP_STATE = {
  calendarStartDate: new Date(), selectedDate: 'all', activeTab: 'all', events: [],
  joinedEvents: [], currentUser: null, currentRole: 'student', currentModalEventId: null,
  ratings: new Map(), busy: false
};
const $ = id => document.getElementById(id);
const ADMIN_EMAILS = [
  'emirhanbilir947@gmail.com','osamaalhajomar7@gmail.com','emircicek73@gmail.com',
  'abdulsametisan177@gmail.com','ma9034403@gmail.com','feyzafatallah71@gmail.com'
]; // SQL tarafındaki allowlist ile aynı olmalı; gerçek yetkiyi DB belirler.

function getLocalIsoDate(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}
function showToast(message, type='success') {
  const toast=$('toast'), msg=$('toastMsg'), icon=$('toastIcon'); if(!toast||!msg||!icon){console.log(message);return;}
  msg.textContent=message;
  const styles={success:['bg-emerald-600','fa-circle-check'],error:['bg-red-600','fa-triangle-exclamation'],warning:['bg-amber-600','fa-triangle-exclamation'],info:['bg-slate-700','fa-bell']};
  const [bg,ico]=styles[type]||styles.success;
  toast.className=`fixed bottom-6 right-6 ${bg} text-white font-semibold text-sm px-4 py-3 rounded-xl shadow-2xl transition-all duration-300 transform z-50 flex items-center space-x-2 max-w-sm`;
  icon.className=`fa-solid ${ico} text-base`; toast.classList.remove('translate-y-24','opacity-0','pointer-events-none');
  clearTimeout(window.campulseToastTimer); window.campulseToastTimer=setTimeout(()=>toast.classList.add('translate-y-24','opacity-0','pointer-events-none'),3500);
}
function showAuthMessage(message,type='error') {
  const box=$('auth-message-box'); if(!box)return;
  box.className='p-3 rounded-lg text-sm font-semibold flex items-center gap-2 border';
  const color=type==='error'?'bg-red-500/10 text-red-400 border-red-500/20':type==='warning'?'bg-amber-500/10 text-amber-400 border-amber-500/20':'bg-green-500/10 text-emerald-400 border-green-500/20';
  box.classList.add(...color.split(' ')); $('auth-message-text').textContent=message;
  $('auth-message-icon').className=`fa-solid ${type==='error'?'fa-circle-exclamation':type==='warning'?'fa-triangle-exclamation':'fa-check-circle'}`;
}
function translateAuthError(message='') {
  const m=message.toLowerCase();
  if(m.includes('invalid login credentials'))return 'E-posta veya şifre hatalı.';
  if(m.includes('email not confirmed'))return 'Lütfen önce e-posta adresinizi doğrulayın.';
  if(m.includes('user already registered'))return 'Bu e-posta adresi zaten kayıtlı.';
  if(m.includes('password should be at least'))return 'Şifreniz en az 6 karakter olmalıdır.';
  if(m.includes('rate limit'))return 'Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar deneyin.';
  return message || 'Beklenmeyen bir hata oluştu.';
}
function setAuthLoading(action,loading) {
  const btn=$(action+'-btn'), txt=$(action+'-text'), spinner=$(action+'-loader');
  if(btn)btn.disabled=loading; if(txt)txt.classList.toggle('hidden',loading); if(spinner)spinner.classList.toggle('hidden',!loading);
}

async function register() {
  const email=$('email-input').value.trim().toLowerCase(), password=$('password-input').value;
  if(!email||!password)return showAuthMessage('E-posta ve şifre alanları zorunludur.');
  if(password.length<6)return showAuthMessage('Şifreniz en az 6 karakter olmalıdır.');
  if(!$('kvkk-checkbox').checked)return showAuthMessage('Kayıt olmak için aydınlatma metnini ve sözleşmeyi kabul etmelisiniz.');
  setAuthLoading('register',true);
  try {
    const {data,error}=await supabaseClient.auth.signUp({email,password});
    if(error)throw error;
    $('password-input').value='';
    showAuthMessage(data.session?'Kayıt başarılı. Hesabınız açılıyor.':'Kayıt isteği alındı. E-posta doğrulaması açıksa gelen kutunuzu kontrol edin.','success');
    if(data.session)await enterApp(data.user);
  } catch(e){showAuthMessage(translateAuthError(e.message));} finally{setAuthLoading('register',false);}
}
async function login() {
  const email=$('email-input').value.trim().toLowerCase(), password=$('password-input').value;
  if(!email||!password)return showAuthMessage('Giriş için e-posta ve şifrenizi girin.');
  setAuthLoading('login',true);
  try {const {data,error}=await supabaseClient.auth.signInWithPassword({email,password});if(error)throw error;await enterApp(data.user);}
  catch(e){showAuthMessage(translateAuthError(e.message));} finally{setAuthLoading('login',false);}
}
async function resetPassword() {
  const email=$('email-input').value.trim().toLowerCase();
  if(!email)return showAuthMessage('Şifre sıfırlama bağlantısı için önce e-posta adresinizi yazın.','warning');
  try {const {error}=await supabaseClient.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+window.location.pathname});if(error)throw error;showAuthMessage('Şifre sıfırlama bağlantısı gönderildiyse e-posta kutunuzu kontrol edin.','success');}
  catch(e){showAuthMessage(translateAuthError(e.message));}
}
async function logout() {
  try {const {error}=await supabaseClient.auth.signOut();if(error)throw error;}
  catch(e){showToast('Çıkış yapılamadı: '+translateAuthError(e.message),'error');return;}
  APP_STATE.currentUser=null;APP_STATE.currentRole='student';APP_STATE.events=[];APP_STATE.joinedEvents=[];APP_STATE.ratings.clear();
  $('main-screen').style.display='none';$('auth-screen').style.display='flex';$('password-input').value='';$('admin-panel').style.display='none';
}
async function enterApp(user) {
  APP_STATE.currentUser=user;
  $('auth-screen').style.display='none';$('main-screen').style.display='flex';$('user-email-display').textContent=user.email||'';
  try {
    const {data,error}=await supabaseClient.from('profiles').select('role').eq('id',user.id).maybeSingle();
    if(error)throw error; APP_STATE.currentRole=data?.role==='admin'?'admin':'student';
  } catch(e) { console.error('Profil/rol okunamadı:',e); APP_STATE.currentRole='student'; showToast('Profil bilgisi alınamadı; yönetici işlemleri kapalı. SQL kurulumunu kontrol edin.','warning'); }
  $('admin-panel').style.display=APP_STATE.currentRole==='admin'?'block':'none';
  APP_STATE.calendarStartDate=new Date();APP_STATE.calendarStartDate.setHours(0,0,0,0);
  if($('addDate'))$('addDate').value=getLocalIsoDate(new Date());
  renderDays(); await Promise.all([loadJoinedEvents(),fetchEvents(),loadMyRatings()]);
}

window.addEventListener('DOMContentLoaded',async()=>{
  if(!$('auth-screen'))return;
  $('main-screen').style.display='none';
  const {data:{session},error}=await supabaseClient.auth.getSession();
  if(error)console.error(error);
  if(session?.user)await enterApp(session.user);else $('auth-screen').style.display='flex';
  supabaseClient.auth.onAuthStateChange((event,session)=>{
    if(event==='SIGNED_OUT'){APP_STATE.currentUser=null;$('main-screen').style.display='none';$('auth-screen').style.display='flex';}
    else if(event==='SIGNED_IN'&&session?.user&&APP_STATE.currentUser?.id!==session.user.id){setTimeout(()=>enterApp(session.user),0);}
  });
  const form=$('quickAddForm');if(form)form.addEventListener('submit',handleAddEvent);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeEventModal();closeKvkkModal();}});
});

async function fetchEvents() {
  const loader=$('loading-indicator'),container=$('eventsContainer'); if(loader)loader.style.display='flex';
  try {
    const {data,error}=await supabaseClient.from('events').select('*').order('date',{ascending:true}).order('start_time',{ascending:true});
    if(error)throw error;APP_STATE.events=data||[];
    const ids=new Set(APP_STATE.events.map(e=>e.id));APP_STATE.joinedEvents=APP_STATE.joinedEvents.filter(id=>ids.has(id));
    updateJoinedBadge();renderEvents();
  } catch(e) {console.error(e);if(container)container.innerHTML=`<div class="text-center py-10 rounded-3xl border border-red-900/50"><p class="text-red-400 font-bold">Etkinlikler yüklenemedi.</p><p class="text-xs text-red-400/70 mt-2">${escapeHtml(e.message)}</p></div>`;}
  finally{if(loader)loader.style.display='none';}
}
async function loadJoinedEvents() {
  if(!APP_STATE.currentUser)return;
  try {
    const {data,error}=await supabaseClient.from('event_participants').select('event_id').eq('user_id',APP_STATE.currentUser.id);
    if(error)throw error;APP_STATE.joinedEvents=(data||[]).map(x=>x.event_id);updateJoinedBadge();renderEvents();
  } catch(e) {console.error('Katılım listesi alınamadı:',e);APP_STATE.joinedEvents=[];showToast('Etkinlik takvimi yüklenemedi. SQL kurulumunu çalıştırın.','error');}
}
async function loadMyRatings() {
  if(!APP_STATE.currentUser)return;
  try {const {data,error}=await supabaseClient.from('event_ratings').select('event_id,rating').eq('user_id',APP_STATE.currentUser.id);if(error)throw error;APP_STATE.ratings=new Map((data||[]).map(x=>[x.event_id,x.rating]));}
  catch(e){console.warn('Puanlar yüklenemedi:',e);}
}
function toggleAdminForm(){const f=$('quickAddForm');if(f)f.style.display=getComputedStyle(f).display==='none'?'block':'none';}
function setActiveTab(tab) {
  APP_STATE.activeTab=tab;const all=$('tab-all'),mine=$('tab-my-events'),days=$('daysListContainer');
  const active='flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-cyan-500 text-white shadow-md';
  const inactive='flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 text-slate-400 hover:text-slate-200';
  all.className=tab==='all'?active:inactive;mine.className=tab==='my-events'?active:inactive;days.style.display=tab==='all'?'flex':'none';renderEvents();
}
function shiftCalendar(days){APP_STATE.calendarStartDate.setDate(APP_STATE.calendarStartDate.getDate()+days);renderDays();}
function renderDays(){
  const c=$('daysList');if(!c)return;let html=`<button onclick="setDateFilter('all')" class="flex-1 px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap shrink-0 ${APP_STATE.selectedDate==='all'?'bg-gradient-to-r from-indigo-500 to-cyan-500 text-white':'bg-slate-800 text-slate-400 border border-slate-700'}">Tümü</button>`;
  const days=['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'],months=['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
  for(let i=0;i<7;i++){const d=new Date(APP_STATE.calendarStartDate);d.setDate(d.getDate()+i);const iso=getLocalIsoDate(d),label=iso===getLocalIsoDate(new Date())?'Bugün':`${d.getDate()} ${months[d.getMonth()]} ${days[d.getDay()]}`;
    html+=`<button onclick="setDateFilter('${iso}')" class="flex-1 px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap shrink-0 ${iso===APP_STATE.selectedDate?'bg-gradient-to-r from-indigo-500 to-cyan-500 text-white':'bg-slate-800 text-slate-400 border border-slate-700'}">${label}</button>`;}
  c.innerHTML=html;
}
function setDateFilter(date){APP_STATE.selectedDate=date;renderDays();renderEvents();}
function parseEventData(ev){
  const date=String(ev.date||'').slice(0,10),start=String(ev.start_time||'').slice(0,5),end=String(ev.end_time||'').slice(0,5);
  const d=new Date(`${date}T12:00:00`),months=['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'],days=['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
  const formattedDate=Number.isNaN(d.getTime())?date:`${d.getDate()} ${months[d.getMonth()]} ${days[d.getDay()]}`;
  return {clubName:ev.club_name||'Kampüs Etkinliği',location:ev.location||'Belirtilmedi',pureDesc:ev.description||'Açıklama belirtilmedi.',startTime:start,endTime:end,timeStr:`${start}-${end}`,isoDateOnly:date,formattedDate,imageUrl:ev.image_url||null,participantsCount:Number(ev.participants_count)||0};
}
function renderEvents(){
  const container=$('eventsContainer');if(!container)return;const query=($('searchInput')?.value||'').trim().toLocaleLowerCase('tr');
  const filtered=APP_STATE.events.filter(ev=>{const p=parseEventData(ev),matchesDate=APP_STATE.activeTab!=='all'||APP_STATE.selectedDate==='all'||p.isoDateOnly===APP_STATE.selectedDate;
    const matchesSearch=[ev.title,p.pureDesc,p.clubName,p.location].some(x=>String(x||'').toLocaleLowerCase('tr').includes(query));return matchesDate&&matchesSearch&&(APP_STATE.activeTab!=='my-events'||APP_STATE.joinedEvents.includes(ev.id));});
  if(!filtered.length){container.innerHTML=`<div class="text-center py-16 bg-slate-800/30 rounded-3xl border border-dashed border-slate-700/50"><div class="text-slate-300 font-bold mb-1">${APP_STATE.activeTab==='my-events'?'Takviminizde etkinlik yok':'Etkinlik bulunamadı'}</div><p class="text-xs text-slate-500">Aramanızı veya tarih seçiminizi değiştirebilirsiniz.</p></div>`;return;}
  container.innerHTML=filtered.map(ev=>{const p=parseEventData(ev),joined=APP_STATE.joinedEvents.includes(ev.id),conflict=joined&&checkEventConflict(ev.id),admin=APP_STATE.currentRole==='admin';
    const image=p.imageUrl?`<div class="w-16 h-16 shrink-0 rounded-xl overflow-hidden bg-slate-800 border border-slate-700"><img src="${escapeHtml(p.imageUrl)}" class="w-full h-full object-cover" alt="Etkinlik afişi" loading="lazy"></div>`:'';
    return `<article onclick="openEventModal('${ev.id}')" class="event-card cursor-pointer rounded-3xl p-5 border ${conflict?'conflict-card bg-red-950/20':joined?'border-emerald-500/50 bg-emerald-950/10':'border-slate-700/60'} space-y-4"><div class="flex items-start justify-between gap-4"><div class="space-y-1.5 flex-1 min-w-0"><div class="flex items-center gap-2 flex-wrap"><span class="text-[10px] font-black uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-md">${escapeHtml(p.clubName)}</span>${APP_STATE.activeTab==='my-events'||APP_STATE.selectedDate==='all'?`<span class="text-[10px] font-bold text-cyan-300 bg-cyan-500/10 px-2.5 py-0.5 rounded-md">${escapeHtml(p.formattedDate)}</span>`:''}${conflict?'<span class="text-[10px] font-black text-red-400">⚠ Saat çakışması</span>':''}<span class="text-[10px] text-orange-300">${p.participantsCount} katılımcı</span></div><h3 class="font-bold text-lg text-white leading-snug">${escapeHtml(ev.title)}</h3></div>${image}${admin?`<button aria-label="Etkinliği sil" onclick="event.stopPropagation();deleteEvent('${ev.id}')" class="shrink-0 w-8 h-8 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20"><i class="fa-solid fa-trash-can"></i></button>`:''}</div><p class="text-sm text-slate-400 leading-relaxed line-clamp-2">${escapeHtml(p.pureDesc)}</p><div class="flex items-center justify-between gap-3 pt-3 border-t border-slate-700/50 text-xs"><div class="flex items-center gap-2 min-w-0 text-slate-300"><span><i class="fa-regular fa-clock text-cyan-400"></i> ${escapeHtml(p.timeStr)}</span><span>•</span><span class="truncate"><i class="fa-solid fa-location-dot text-indigo-400"></i> ${escapeHtml(p.location)}</span></div><button onclick="event.stopPropagation();toggleJoin('${ev.id}')" class="shrink-0 px-4 py-2 rounded-xl text-xs font-bold ${joined?'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30':'bg-slate-700 text-white hover:bg-indigo-600'}">${joined?'✓ Katılıyorsun':'＋ Katıl'}</button></div></article>`;
  }).join('');
}
function updateJoinedBadge(){if($('joinedCountBadge'))$('joinedCountBadge').textContent=APP_STATE.joinedEvents.length;}
function checkEventConflict(id){const a=APP_STATE.events.find(e=>e.id===id);if(!a)return false;const p=parseEventData(a),as=p.startTime,ae=p.endTime;if(!as||!ae)return false;return APP_STATE.joinedEvents.some(otherId=>{if(otherId===id)return false;const b=APP_STATE.events.find(e=>e.id===otherId);if(!b)return false;const q=parseEventData(b);return p.isoDateOnly===q.isoDateOnly&&as<q.endTime&&ae>q.startTime;});}

async function toggleJoin(eventId){
  if(!APP_STATE.currentUser)return showToast('Katılmak için giriş yapın.','warning');
  const joined=APP_STATE.joinedEvents.includes(eventId);
  try {
    if(joined){const {error}=await supabaseClient.from('event_participants').delete().eq('event_id',eventId).eq('user_id',APP_STATE.currentUser.id);if(error)throw error;APP_STATE.joinedEvents=APP_STATE.joinedEvents.filter(id=>id!==eventId);showToast('Etkinlik takviminizden çıkarıldı.','info');}
    else {const {error}=await supabaseClient.from('event_participants').insert({event_id:eventId,user_id:APP_STATE.currentUser.id});if(error){if(error.code==='23505')throw new Error('Bu etkinliğe zaten katılmışsınız.');throw error;}APP_STATE.joinedEvents.push(eventId);showToast(checkEventConflict(eventId)?'Etkinliğe katıldınız ancak saat çakışması var.':'Etkinlik takviminize eklendi.',checkEventConflict(eventId)?'warning':'success');}
    await fetchEvents();if(APP_STATE.currentModalEventId===eventId)openEventModal(eventId);
  } catch(e){showToast('Katılım işlemi yapılamadı: '+e.message,'error');await loadJoinedEvents();}
}
async function handleAddEvent(e){
  e.preventDefault();if(APP_STATE.currentRole!=='admin')return showToast('Bu işlem için yönetici yetkisi gerekiyor.','error');
  const btn=$('submit-event-btn'),old=btn.innerHTML;btn.disabled=true;btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Kaydediliyor...';let uploadedPath=null;
  try {
    const title=$('addTitle').value.trim(),club=$('addClub').value.trim(),location=$('addLocation').value.trim(),date=$('addDate').value,start=$('addStartTime').value,end=$('addEndTime').value,description=$('addDesc').value.trim(),file=$('addPoster').files?.[0];
    if(!title||!club||!location||!date||!start||!end)throw new Error('Zorunlu alanları doldurun.');if(end<=start)throw new Error('Bitiş saati başlangıç saatinden sonra olmalıdır.');
    let imageUrl=null;
    if(file){if(!file.type.startsWith('image/'))throw new Error('Afiş dosyası bir resim olmalıdır.');if(file.size>5*1024*1024)throw new Error('Afiş en fazla 5 MB olabilir.');const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');uploadedPath=`${crypto.randomUUID()}.${ext}`;
      const {error:uploadError}=await supabaseClient.storage.from('event-posters').upload(uploadedPath,file,{contentType:file.type,upsert:false});if(uploadError)throw uploadError;imageUrl=supabaseClient.storage.from('event-posters').getPublicUrl(uploadedPath).data.publicUrl;}
    const {error}=await supabaseClient.from('events').insert({title,club_name:club,location,date,start_time:start,end_time:end,description,image_url:imageUrl});if(error)throw error;
    showToast('Etkinlik başarıyla yayınlandı.','success');$('quickAddForm').reset();$('addDate').value=getLocalIsoDate(new Date());$('quickAddForm').style.display='none';await fetchEvents();
  } catch(err){console.error(err);if(uploadedPath)await supabaseClient.storage.from('event-posters').remove([uploadedPath]);showToast('Etkinlik eklenemedi: '+err.message,'error');}
  finally{btn.disabled=false;btn.innerHTML=old;}
}
async function deleteEvent(id){
  if(APP_STATE.currentRole!=='admin')return showToast('Yönetici yetkisi gerekli.','error');const ev=APP_STATE.events.find(x=>x.id===id);if(!ev||!confirm(`“${ev.title}” etkinliği silinsin mi?`))return;
  try{const {error}=await supabaseClient.from('events').delete().eq('id',id);if(error)throw error;if(APP_STATE.currentModalEventId===id)closeEventModal();showToast('Etkinlik silindi.','success');await Promise.all([fetchEvents(),loadJoinedEvents()]);}
  catch(e){showToast('Etkinlik silinemedi: '+e.message,'error');}
}
function openEventModal(id){
  const ev=APP_STATE.events.find(x=>x.id===id);if(!ev)return;APP_STATE.currentModalEventId=id;const p=parseEventData(ev),joined=APP_STATE.joinedEvents.includes(id),ended=new Date(`${p.isoDateOnly}T${p.endTime}:00`)<new Date();
  $('modalTitle').textContent=ev.title;$('modalTime').textContent=`${p.formattedDate} | ${p.timeStr}`;$('modalLocation').textContent=p.location;$('modalDescription').textContent=p.pureDesc;$('modalBadges').innerHTML=`<span class="text-[11px] font-black uppercase text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-md">${escapeHtml(p.clubName)}</span>`;
  $('modalConflictAlert').classList.toggle('hidden',!checkEventConflict(id));$('modalParticipantsCount').classList.toggle('hidden',p.participantsCount===0);$('pCountText').textContent=p.participantsCount;
  if(p.imageUrl){$('modalPoster').src=p.imageUrl;$('modalPosterContainer').classList.remove('hidden');$('modalHeaderSection').classList.add('-mt-8');}else{$('modalPoster').removeAttribute('src');$('modalPosterContainer').classList.add('hidden');$('modalHeaderSection').classList.remove('-mt-8');}
  const rating=$('modalRatingSection');rating.classList.toggle('hidden',!(ended&&joined));const current=APP_STATE.ratings.get(id)||0;$('starContainer').innerHTML=[1,2,3,4,5].map(n=>`<button aria-label="${n} yıldız" onclick="rateEvent('${id}',${n})" class="${n<=current?'text-amber-400':'text-slate-500'} hover:text-amber-300"><i class="fa-${n<=current?'solid':'regular'} fa-star"></i></button>`).join('');
  $('modalActionContainer').innerHTML=ended?'<span class="text-xs font-bold text-slate-500 bg-slate-800 px-4 py-2 rounded-xl">Etkinlik sona erdi</span>':`<button onclick="toggleJoin('${id}')" class="px-6 py-2.5 rounded-xl text-xs font-bold ${joined?'bg-red-500/20 text-red-400 border border-red-500/40':'bg-gradient-to-r from-indigo-500 to-cyan-500 text-white'}">${joined?'Takvimimden çıkar':'Takvime ekle'}</button>`;
  $('eventDetailModal').classList.remove('hidden');document.body.style.overflow='hidden';
}
function closeEventModal(){$('eventDetailModal')?.classList.add('hidden');document.body.style.overflow='';APP_STATE.currentModalEventId=null;}
async function rateEvent(eventId,rating){
  if(!APP_STATE.currentUser)return showToast('Puan vermek için giriş yapın.','warning');if(!APP_STATE.joinedEvents.includes(eventId))return showToast('Yalnızca katıldığınız etkinlikleri puanlayabilirsiniz.','warning');
  try{const {error}=await supabaseClient.from('event_ratings').upsert({event_id:eventId,user_id:APP_STATE.currentUser.id,rating},{onConflict:'event_id,user_id'});if(error)throw error;APP_STATE.ratings.set(eventId,rating);showToast('Puanınız kaydedildi.','success');openEventModal(eventId);}
  catch(e){showToast('Puan kaydedilemedi: '+e.message,'error');}
}
function downloadICS(){
  const ev=APP_STATE.events.find(x=>x.id===APP_STATE.currentModalEventId);if(!ev)return;const p=parseEventData(ev);if(!p.startTime||!p.endTime)return showToast('Etkinlik saati eksik.','error');
  const dt=(date,time)=>new Date(`${date}T${time}:00`).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  const esc=s=>String(s||'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
  const content=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//CamPulse//TR','CALSCALE:GREGORIAN','BEGIN:VEVENT',`UID:${ev.id}@campulse`,`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')}`,`DTSTART:${dt(p.isoDateOnly,p.startTime)}`,`DTEND:${dt(p.isoDateOnly,p.endTime)}`,`SUMMARY:${esc(ev.title)}`,`LOCATION:${esc(p.location)}`,`DESCRIPTION:${esc(p.pureDesc)}`,'END:VEVENT','END:VCALENDAR'].join('\r\n');
  const url=URL.createObjectURL(new Blob([content],{type:'text/calendar;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`${String(ev.title).replace(/[^a-z0-9-_]/gi,'_')}.ics`;a.click();URL.revokeObjectURL(url);showToast('Takvim dosyası indirildi.','success');
}
function openKvkkModal(e){e?.preventDefault();$('kvkkModal')?.classList.remove('hidden');}function closeKvkkModal(){$('kvkkModal')?.classList.add('hidden');}

// Basit pull-to-refresh; modal açıkken çalışmaz.
let touchY=0;document.addEventListener('touchstart',e=>{touchY=window.scrollY===0?e.touches[0].clientY:0;},{passive:true});
document.addEventListener('touchend',e=>{if(touchY&&window.scrollY===0&&e.changedTouches[0].clientY-touchY>120&&APP_STATE.currentUser&&!$('eventDetailModal').classList.contains('hidden'))return;if(touchY&&window.scrollY===0&&e.changedTouches[0].clientY-touchY>120&&APP_STATE.currentUser){fetchEvents();loadJoinedEvents();}touchY=0;},{passive:true});
