// --- Tailwind Configuration ---
tailwind.config = {
    theme: {
        extend: {
            colors: {
                cyber: { dark: '#020408', panel: '#0f172a', blue: '#3b82f6', purple: '#8b5cf6', green: '#10b981', red: '#ef4444', gold: '#f59e0b' },
            },
            backgroundImage: {
                'hero-pattern': "url('https://img.freepik.com/free-vector/dark-hexagonal-background-with-gradient-color_79603-1409.jpg')"
            },
            animation: {
                'slide-down': 'slideDown 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                'fade-out': 'fadeOut 0.5s ease-in forwards',
            },
            keyframes: {
                slideDown: {
                    '0%': { transform: 'translateY(-150%) scale(0.9)', opacity: '0' },
                    '100%': { transform: 'translateY(0) scale(1)', opacity: '1' },
                },
                fadeOut: {
                    '0%': { opacity: '1', transform: 'scale(1)' },
                    '100%': { opacity: '0', transform: 'scale(0.95)' },
                }
            }
        }
    }
}

// --- App Configuration & Logic ---
const SB_URL = 'https://hhbarpamxnystjccvfum.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhoYmFycGFteG55c3RqY2N2ZnVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxMjk1NTksImV4cCI6MjA4MTcwNTU1OX0.QJ6cE08RmVJ_r693TCAKmBL9bGCj6MwXHV2U9gNlDoU';
const sb = supabase.createClient(SB_URL, SB_KEY);

// State Management
let state = {
    user: localStorage.getItem('eleague_user') || '',
    room: localStorage.getItem('eleague_room') || '',
    isAdmin: false,
    teams: [],
    matches: [],
    maxPlayers: 10,
    selectedLeague: '',
    selectedClub: '',
    activeRound: 1,
    roomActiveRound: 1
};

// Database of Teams
const DB = {
    "الدوري الإنجليزي": ["Man City", "Liverpool", "Arsenal", "Man Utd", "Chelsea", "Tottenham", "Newcastle", "Aston Villa"],
    "الدوري الإسباني": ["Real Madrid", "Barcelona", "Atletico", "Sevilla", "Valencia", "Real Sociedad"],
    "الدوري السعودي": ["Al Hilal", "Al Nassr", "Al Ittihad", "Al Ahli", "Al Shabab", "Al Ettifaq"],
    "الدوري الإيطالي": ["Inter", "Juventus", "Milan", "Napoli", "Roma", "Lazio"],
    "الدوري الألماني": ["Bayern", "Dortmund", "Leverkusen", "Leipzig"],
    "الدوري الفرنسي": ["PSG", "Marseille", "Monaco", "Lyon"]
};

// --- Initialization ---
window.onload = async () => {
    if(state.user && state.room) {
        document.getElementById('autoLoginOverlay').classList.remove('hidden');
        await handleJoin(true);
    }
};

// --- Notification System ---
function showToast(title, msg, type = 'info') {
    const icons = {
        success: '<i class="fas fa-check-circle text-cyber-green text-xl"></i>',
        info: '<i class="fas fa-info-circle text-cyber-blue text-xl"></i>',
        alert: '<i class="fas fa-exclamation-triangle text-red-500 text-xl"></i>',
        gold: '<i class="fas fa-trophy text-yellow-500 text-xl"></i>'
    };

    const toast = document.createElement('div');
    toast.className = 'ios-toast animate-slide-down';
    toast.innerHTML = `
        <div class="flex items-center gap-3">
            ${icons[type]}
            <div class="flex flex-col text-right">
                <span class="text-xs font-bold text-white">${title}</span>
                <span class="text-[10px] text-gray-400 leading-tight">${msg}</span>
            </div>
        </div>
    `;
    
    const container = document.getElementById('toastContainer');
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.5s ease-in forwards';
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

// --- Core Functions ---

async function handleCreate() {
    const name = document.getElementById('adminName').value.trim();
    if(!name) return showMsg("يرجى إدخال اسم المنظم");
    
    setLoading('create', true);
    const code = Math.random().toString(36).substring(2, 6).toUpperCase();
    const maxP = parseInt(document.getElementById('maxPlayers').value);

    const { error } = await sb.from('rooms').insert([{ 
        room_code: code, 
        owner_name: name, 
        max_players: maxP,
        active_round: 1 
    }]);

    if(error) { showMsg(error.message); setLoading('create', false); return; }
    
    saveSession(name, code);
    enterApp(code, true, 1, maxP);
}

async function handleJoin(isAuto = false) {
    const code = isAuto ? state.room : document.getElementById('joinCode').value.trim().toUpperCase();
    const name = isAuto ? state.user : document.getElementById('joinName').value.trim();
    
    if(!code || !name) {
        if(!isAuto) showMsg("الرجاء إكمال جميع البيانات");
        document.getElementById('autoLoginOverlay').classList.add('hidden');
        return;
    }

    if(!isAuto) setLoading('join', true);
    
    const { data: roomData } = await sb.from('rooms').select('*').eq('room_code', code).single();

    if(!roomData) { 
        if(!isAuto) showMsg("الغرفة غير صحيحة"); 
        setLoading('join', false);
        document.getElementById('autoLoginOverlay').classList.add('hidden');
        if(isAuto) logout(); 
        return; 
    }

    if(!isAuto) {
        const { count } = await sb.from('teams').select('*', { count: 'exact', head: true }).eq('room_code', code);
        if(count >= roomData.max_players) {
            showMsg("عذراً، الغرفة ممتلئة");
            setLoading('join', false);
            return;
        }
        
        const { data: existingUser } = await sb
            .from('teams')
            .select('name')
            .eq('room_code', code)
            .ilike('name', name)
            .maybeSingle();

        if(existingUser) {
            showMsg("الاسم مستخدم بالفعل، اختر اسماً آخر");
            setLoading('join', false);
            return;
        }
    }

    saveSession(name, code);
    enterApp(code, roomData.owner_name === name, roomData.active_round || 1, roomData.max_players);
    document.getElementById('autoLoginOverlay').classList.add('hidden');
}

async function enterApp(code, admin, serverRound, maxP) {
    state.room = code;
    state.isAdmin = admin;
    state.roomActiveRound = serverRound;
    state.activeRound = serverRound;
    state.maxPlayers = maxP;

    document.getElementById('lobbyScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'flex';
    document.getElementById('roomCodeDisp').innerText = code;
    document.getElementById('userNameDisp').innerText = state.user.substring(0, 12);
    
    if(admin) {
        document.getElementById('adminBadge').classList.remove('hidden');
        document.getElementById('adminControls').classList.remove('hidden');
        document.getElementById('adminRoundDisp').innerText = serverRound;
    }
    
    await refreshAll();
    listenRealtime();
}

async function refreshAll() {
    const { data: teams } = await sb.from('teams').select('*').eq('room_code', state.room);
    state.teams = teams || [];
    document.getElementById('playersCountBadge').innerText = `${state.teams.length}/${state.maxPlayers}`;

    const { data: matches } = await sb.from('matches').select('*').eq('room_code', state.room).order('id');
    state.matches = matches || [];

    const { data: roomData } = await sb.from('rooms').select('active_round, max_players').eq('room_code', state.room).single();
    if(roomData) {
        state.roomActiveRound = roomData.active_round || 1;
        state.maxPlayers = roomData.max_players;
        document.getElementById('playersCountBadge').innerText = `${state.teams.length}/${state.maxPlayers}`;

        if(state.isAdmin) document.getElementById('adminRoundDisp').innerText = state.roomActiveRound;
        if (!state.isAdmin && state.activeRound > state.roomActiveRound) {
            state.activeRound = state.roomActiveRound;
        }
    }

    renderTeams();
    renderMatches();
    renderTable();
}

// --- Rendering ---
function renderTeams() {
    document.getElementById('teamsGrid').innerHTML = state.teams.map(t => `
        <div class="glass p-4 rounded-2xl flex items-center justify-between border border-white/5 hover:border-cyber-blue/30 transition-all group">
            <div class="flex items-center gap-4">
                    <div class="w-10 h-10 rounded-full bg-gradient-to-br from-gray-800 to-black flex items-center justify-center border border-white/10 group-hover:border-cyber-blue/50 transition-colors">
                    <i class="fas fa-shield-alt text-gray-400 group-hover:text-cyber-blue"></i>
                    </div>
                    <div>
                    <h4 class="font-bold text-white text-sm">${t.club}</h4>
                    <p class="text-[10px] text-gray-500 font-mono mt-0.5 uppercase tracking-wide">${t.name}</p>
                    </div>
            </div>
            ${t.name === state.user ? '<div class="w-2 h-2 rounded-full bg-cyber-green shadow-[0_0_10px_#10b981]"></div>' : ''}
        </div>
    `).join('');
}

function renderMatches() {
    const matchesList = document.getElementById('matchesList');
    const roundsTab = document.getElementById('roundsTab');

    if(state.matches.length === 0) {
        matchesList.innerHTML = `<div class="flex flex-col items-center justify-center py-20 text-gray-600 glass rounded-3xl"><i class="fas fa-calendar-times text-3xl mb-3 opacity-20"></i><span class="text-xs">لم يتم إعداد الجدول بعد</span></div>`;
        roundsTab.innerHTML = '';
        return;
    }

    const allRounds = [...new Set(state.matches.map(m => m.round_index))].sort((a,b)=>a-b);
    
    roundsTab.innerHTML = allRounds.map(r => {
        const isActive = state.activeRound === r;
        const isLocked = !state.isAdmin && r > state.roomActiveRound;
        
        return `
            <button 
                ${isLocked ? '' : `onclick="setRound(${r})"`} 
                class="px-5 py-2 rounded-full text-[10px] font-bold transition-all whitespace-nowrap border ${isActive ? 'bg-white text-black border-white' : (isLocked ? 'round-locked bg-white/5 border-white/5 text-gray-600' : 'bg-transparent text-gray-400 border-white/10 hover:border-white/30')}">
                جولة ${r} ${isLocked ? '<i class="fas fa-lock ml-1"></i>' : ''}
            </button>
        `;
    }).join('');

    const roundMatches = state.matches.filter(m => m.round_index === state.activeRound);
    
    matchesList.innerHTML = roundMatches.map(m => {
        const isPending = m.status === 'pending';
        const isFin = m.is_finished;
        const myTeam = state.teams.find(t => t.name === state.user);
        const myClub = myTeam ? myTeam.club : null;
        const isMyMatch = (m.home_team === myClub || m.away_team === myClub);

        let statusColor = isFin ? 'text-gray-400' : 'text-cyber-blue';
        if(isPending) statusColor = 'text-yellow-500 animate-pulse';

        return `
            <div onclick="openScoreModal(${m.id})" class="glass p-4 rounded-2xl flex items-center justify-between cursor-pointer border-t border-white/5 hover:bg-white/5 transition-all relative overflow-hidden group">
                ${isMyMatch ? '<div class="absolute left-0 top-0 bottom-0 w-1 bg-cyber-blue"></div>' : ''}
                
                <div class="w-[35%] text-right">
                    <div class="font-black text-sm text-white truncate group-hover:text-cyber-blue transition-colors">${m.home_team}</div>
                    <div class="text-[9px] text-gray-500 truncate">${getPlayerName(m.home_team)}</div>
                </div>
                
                <div class="flex flex-col items-center justify-center w-[30%] bg-black/20 rounded-lg py-2 mx-2">
                    <div class="font-mono font-black text-lg leading-none ${statusColor}">
                        ${(isFin || isPending) ? `${m.home_score}-${m.away_score}` : 'VS'}
                    </div>
                    ${isPending ? '<span class="text-[7px] text-yellow-500 font-bold uppercase mt-1">Review</span>' : ''}
                </div>

                <div class="w-[35%] text-left">
                    <div class="font-black text-sm text-white truncate group-hover:text-cyber-blue transition-colors">${m.away_team}</div>
                    <div class="text-[9px] text-gray-500 truncate">${getPlayerName(m.away_team)}</div>
                </div>
            </div>
        `;
    }).join('');
}

function renderTable() {
    let stats = {};
    state.teams.forEach(t => stats[t.club] = { name: t.club, player: t.name, played:0, gd:0, pts:0 });

    state.matches.filter(m => m.is_finished).forEach(m => {
        const h = stats[m.home_team], a = stats[m.away_team];
        if(!h || !a) return;
        h.played++; a.played++;
        h.gd += (m.home_score - m.away_score);
        a.gd += (m.away_score - m.home_score);
        if(m.home_score > m.away_score) h.pts += 3;
        else if(m.home_score < m.away_score) a.pts += 3;
        else { h.pts++; a.pts++; }
    });

    const sorted = Object.values(stats).sort((a,b) => b.pts - a.pts || b.gd - a.gd);
    document.getElementById('standingsBody').innerHTML = sorted.map((s, i) => `
        <tr class="hover:bg-white/5 transition-colors">
            <td class="p-4 text-xs text-gray-500 font-mono">${i+1}</td>
            <td class="p-4 text-right">
                <div class="font-bold text-sm text-white">${s.name}</div>
            </td>
            <td class="p-4 text-xs text-gray-400">${s.played}</td>
            <td class="p-4 text-xs font-mono dir-ltr ${s.gd > 0 ? 'text-green-500' : (s.gd < 0 ? 'text-red-500' : 'text-gray-500')}">${s.gd > 0 ? '+'+s.gd : s.gd}</td>
            <td class="p-4 font-black text-white text-base">${s.pts}</td>
        </tr>
    `).join('');
}

// --- Image Export Logic ---
async function downloadRoundImage() {
    if(state.matches.length === 0) return showToast("خطأ", "لا توجد مباريات", "alert");

    showToast("جارِ المعالجة", "يتم إنشاء الصورة الاحترافية...", "info");

    document.getElementById('exportRoomCode').innerText = state.room;
    document.getElementById('exportRoundNum').innerText = `ROUND ${state.activeRound}`;
    
    const roundMatches = state.matches.filter(m => m.round_index === state.activeRound);
    const exportList = document.getElementById('exportMatchesList');
    
    exportList.innerHTML = roundMatches.map(m => {
        const homeP = getPlayerName(m.home_team);
        const awayP = getPlayerName(m.away_team);
        const score = m.is_finished ? `${m.home_score} - ${m.away_score}` : 'VS';
        
        return `
            <div class="bg-white/5 p-6 rounded-3xl border border-white/10 flex items-center justify-between">
                <div class="w-[40%] text-right">
                    <h3 class="text-2xl font-black text-white">${m.home_team}</h3>
                    <p class="text-lg text-gray-400 mt-1 font-bold uppercase tracking-wider">${homeP}</p>
                </div>
                <div class="w-[20%] text-center">
                    <div class="text-4xl font-mono font-black text-cyber-blue bg-black/30 rounded-xl py-3">${score}</div>
                </div>
                <div class="w-[40%] text-left">
                    <h3 class="text-2xl font-black text-white">${m.away_team}</h3>
                    <p class="text-lg text-gray-400 mt-1 font-bold uppercase tracking-wider">${awayP}</p>
                </div>
            </div>
        `;
    }).join('');

    const element = document.getElementById("exportContainer");
    
    try {
        const canvas = await html2canvas(element, {
            useCORS: true,
            scale: 1,
            backgroundColor: '#020408'
        });

        const link = document.createElement('a');
        link.download = `E-LEAGUE-Round-${state.activeRound}.png`;
        link.href = canvas.toDataURL();
        link.click();
        
        showToast("تم", "تم تحميل صورة الجولة بنجاح", "success");
    } catch (err) {
        console.error(err);
        showToast("خطأ", "فشل إنشاء الصورة", "alert");
    }
}

// --- Actions ---

function openClubModal() {
    if(state.teams.find(t => t.name === state.user)) return showToast("تنبيه", "أنت مسجل بالفعل في البطولة", "alert");
    document.getElementById('clubModal').classList.remove('hidden');
    renderLeagues();
}

function renderLeagues() {
    document.getElementById('leagueList').innerHTML = Object.keys(DB).map(l => `
        <button onclick="selectLeague('${l}')" class="w-full text-right p-3 rounded-lg text-xs font-bold transition-all ${state.selectedLeague === l ? 'bg-white text-black' : 'text-gray-400 hover:text-white hover:bg-white/5'}">${l}</button>
    `).join('');
}

function selectLeague(l) {
    state.selectedLeague = l;
    renderLeagues();
    const taken = state.teams.map(t => t.club);
    document.getElementById('clubGrid').innerHTML = DB[l].map(c => `
        <div onclick="selectClub('${c}')" class="club-card bg-black/40 p-3 rounded-xl flex flex-col items-center gap-2 border border-white/5 ${state.selectedClub === c ? 'selected ring-2 ring-cyber-blue' : ''} ${taken.includes(c) ? 'opacity-30 pointer-events-none grayscale' : ''}">
            <div class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"><i class="fas fa-shield-alt text-gray-400"></i></div>
            <span class="text-[10px] font-bold text-center text-gray-300 leading-tight">${c}</span>
        </div>
    `).join('');
}

function selectClub(c) {
    state.selectedClub = c;
    document.getElementById('selectionInfo').innerText = `${c}`;
    const btnConfirm = document.getElementById('btnConfirm');
    btnConfirm.disabled = false;
    btnConfirm.classList.remove('opacity-50', 'cursor-not-allowed');
    selectLeague(state.selectedLeague);
}

async function confirmClubSelection() {
    const { count } = await sb.from('teams').select('*', { count: 'exact', head: true }).eq('room_code', state.room);
    if(count >= state.maxPlayers) {
        showToast("خطأ", "الغرفة امتلأت الآن!", "alert");
        closeClubModal();
        return;
    }

    const { error } = await sb.from('teams').insert([{
        room_code: state.room,
        name: state.user,
        club: state.selectedClub,
        league: state.selectedLeague
    }]);
    
    if(error) showMsg(error.message);
    else closeClubModal();
}

function openScoreModal(id) {
    const m = state.matches.find(x => x.id === id);
    if(!m) return;
    
    const scoreModal = document.getElementById('scoreModal');
    const homeS = document.getElementById('homeS');
    const awayS = document.getElementById('awayS');
    const scoreActions = document.getElementById('scoreActions');

    scoreModal.classList.remove('hidden');
    document.getElementById('homeN').innerText = m.home_team;
    document.getElementById('awayN').innerText = m.away_team;
    homeS.value = m.home_score !== null ? m.home_score : 0;
    awayS.value = m.away_score !== null ? m.away_score : 0;

    let html = '';
    const isPending = m.status === 'pending';
    const myTeam = state.teams.find(t => t.name === state.user);
    const myClub = myTeam ? myTeam.club : null;
    const isMyMatch = (m.home_team === myClub || m.away_team === myClub);

    if(state.isAdmin) {
        document.getElementById('reviewBadge').classList.toggle('hidden', !isPending);
        html = `
            <button onclick="adminSetResult(${id})" class="w-full bg-white text-black font-black py-3 rounded-xl shadow-lg hover:scale-[1.02] transition-transform text-sm">اعتماد النتيجة</button>
            ${isPending ? `<button onclick="verifyResult(${id}, false)" class="w-full bg-red-500/10 text-red-500 font-bold py-2 rounded-xl text-xs border border-red-500/20">رفض</button>` : ''}
        `;
        homeS.disabled = false;
        awayS.disabled = false;
    } else {
        document.getElementById('reviewBadge').classList.add('hidden');
        if (!isMyMatch) {
            html = `<div class="bg-white/5 text-gray-500 p-3 rounded-xl text-xs font-bold text-center">للمشاهدة فقط</div>`;
            homeS.disabled = true; awayS.disabled = true;
        } else if(isPending) {
            html = `<div class="bg-yellow-500/10 text-yellow-500 p-3 rounded-xl text-xs font-bold text-center animate-pulse">بانتظار الموافقة...</div>`;
            homeS.disabled = true; awayS.disabled = true;
        } else if(m.is_finished) {
            html = `<div class="bg-green-500/10 text-green-500 p-3 rounded-xl text-xs font-bold text-center">انتهت المباراة</div>`;
            homeS.disabled = true; awayS.disabled = true;
        } else {
            html = `<button onclick="requestResult(${id})" class="w-full bg-cyber-blue text-white font-bold py-3 rounded-xl shadow-lg shadow-cyber-blue/20 text-sm">إرسال النتيجة</button>`;
            homeS.disabled = false; awayS.disabled = false;
        }
    }
    scoreActions.innerHTML = html;
}

// --- Admin Logic ---
async function adminSetResult(id) {
    const h = parseInt(document.getElementById('homeS').value), a = parseInt(document.getElementById('awayS').value);
    if(isNaN(h) || isNaN(a)) return;
    await sb.from('matches').update({ home_score: h, away_score: a, is_finished: true, status: 'approved' }).eq('id', id);
    closeScoreModal();
}

async function requestResult(id) {
    const { error } = await sb.from('matches').update({
        home_score: parseInt(document.getElementById('homeS').value),
        away_score: parseInt(document.getElementById('awayS').value),
        status: 'pending'
    }).eq('id', id);
    if(!error) showToast("نجاح", "تم إرسال النتيجة للمراجعة", "success");
    closeScoreModal();
}

async function verifyResult(id, accept) {
    const update = accept ? { is_finished: true, status: 'approved' } : { home_score: null, away_score: null, status: 'rejected', is_finished: false };
    await sb.from('matches').update(update).eq('id', id);
    closeScoreModal();
}

async function generateSchedule() {
    if(state.teams.length < 4) return showToast("خطأ", "العدد غير كافٍ (4 فرق على الأقل)", "alert");
    if(!confirm("سيتم حذف النتائج الحالية وبدء دوري جديد!")) return;
    
    await sb.from('matches').delete().eq('room_code', state.room);
    const clubs = state.teams.map(x => x.club).sort(() => Math.random() - 0.5);
    const matches = [];
    const n = clubs.length;
    
    await sb.from('rooms').update({ active_round: 1 }).eq('room_code', state.room);
    
    for (let r = 0; r < n - 1; r++) {
        for (let i = 0; i < n / 2; i++) {
            matches.push({ room_code: state.room, round_index: r + 1, home_team: clubs[i], away_team: clubs[n - 1 - i], status: null });
        }
        clubs.splice(1, 0, clubs.pop());
    }
    await sb.from('matches').insert(matches);
    showToast("تم", "تم إنشاء جدول المباريات", "success");
}

async function updateRoomRound(d) {
    const newR = state.roomActiveRound + d;
    if(newR < 1) return;
    const max = Math.max(...state.matches.map(m => m.round_index), 1);
    if(newR > max) return showToast("تنبيه", "لا توجد جولات أخرى", "info");

    await sb.from('rooms').update({ active_round: newR }).eq('room_code', state.room);
}

// --- Helpers ---
function listenRealtime() {
    sb.channel('updates')
    .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        refreshAll();
    })
    .subscribe();
}

function switchTab(t) {
    document.getElementById('joinForm').classList.toggle('hidden', t !== 'join');
    document.getElementById('createForm').classList.toggle('hidden', t !== 'create');
    document.getElementById('tabJoin').className = t === 'join' ? 'flex-1 py-3 rounded-xl font-bold transition-all bg-white text-black shadow-lg scale-105' : 'flex-1 py-3 rounded-xl font-bold transition-all text-gray-400 hover:text-white';
    document.getElementById('tabCreate').className = t === 'create' ? 'flex-1 py-3 rounded-xl font-bold transition-all bg-white text-black shadow-lg scale-105' : 'flex-1 py-3 rounded-xl font-bold transition-all text-gray-400 hover:text-white';
}

function showSection(s) {
    document.querySelectorAll('section').forEach(sec => sec.classList.add('hidden'));
    document.getElementById(`sec-${s}`).classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(b => {
        b.classList.remove('bg-cyber-blue', 'text-white', 'shadow-lg');
        b.classList.add('bg-white/5', 'text-gray-400');
    });
    document.getElementById(`btn-${s}`).classList.add('bg-cyber-blue', 'text-white', 'shadow-lg');
}

function getPlayerName(c) { return state.teams.find(t => t.club === c)?.name || ''; }
function showMsg(t) { const msg = document.getElementById('msg'); msg.innerText = t; msg.classList.remove('hidden'); setTimeout(() => msg.classList.add('hidden'), 3000); }
function setLoading(f, s) { document.getElementById(`${f}Loading`).classList.toggle('hidden', !s); document.getElementById(`${f}Txt`).innerText = s ? '' : (f === 'join' ? 'دخول' : 'إنشاء'); }
function saveSession(u, r) { localStorage.setItem('eleague_user', u); localStorage.setItem('eleague_room', r); state.user = u; state.room = r; }
function logout() { localStorage.clear(); location.reload(); }
function closeClubModal() { document.getElementById('clubModal').classList.add('hidden'); }
function closeScoreModal() { document.getElementById('scoreModal').classList.add('hidden'); }
function setRound(r) { state.activeRound = r; renderMatches(); }
function copyCode() { navigator.clipboard.writeText(state.room); showToast("نسخ", "تم نسخ كود الغرفة", "info"); }
