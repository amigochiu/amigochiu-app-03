/* Data */
const LANGUAGES = [
    { code: 'zh-TW', name: '繁體中文', voiceCode: 'zh-TW' },
    { code: 'en-US', name: 'English', voiceCode: 'en-US' },
    { code: 'ja-JP', name: '日本語', voiceCode: 'ja-JP' },
    { code: 'ko-KR', name: '한국어', voiceCode: 'ko-KR' },
    { code: 'es-ES', name: 'Español', voiceCode: 'es-ES' },
    { code: 'fr-FR', name: 'Français', voiceCode: 'fr-FR' },
    { code: 'de-DE', name: 'Deutsch', voiceCode: 'de-DE' },
    { code: 'th-TH', name: 'ไทย', voiceCode: 'th-TH' },
    { code: 'vi-VN', name: 'Tiếng Việt', voiceCode: 'vi-VN' },
];

const UI_STRINGS = {
    'zh-TW': '點擊麥克風開始說話...',
    'en-US': 'Tap mic to start speaking...',
    'ja-JP': 'マイクをタップして話す...',
    'ko-KR': '마이크를 탭하여 말하기...',
    'es-ES': 'Toca el micrófono para hablar...',
    'fr-FR': 'Appuyez sur le micro pour parler...',
    'de-DE': 'Mikrofon tippen zum Sprechen...',
    'th-TH': 'แตะไมโครโฟนเพื่อพูด...',
    'vi-VN': 'Nhấn vào mic để nói...'
};

const LISTEN_STRINGS = {
    'zh-TW': '正在聆聽中...',
    'en-US': 'Listening...',
    'ja-JP': '聞いています...',
    'ko-KR': '듣고 있어요...',
    'es-ES': 'Escuchando...',
    'fr-FR': 'Écoute...',
    'de-DE': 'Zuhören...',
    'th-TH': 'กำลังฟัง...',
    'vi-VN': 'Đang nghe...'
};

const WAITING_STRINGS = {
    'zh-TW': '等待對方開始說話...',
    'en-US': 'Waiting for speaker...',
    'ja-JP': '相手の話を待っています...',
    'ko-KR': '상대방의 말을 기다리는 중...',
    'es-ES': 'Esperando al orador...',
    'fr-FR': 'En attente de l\'orateur...',
    'de-DE': 'Warten auf Sprecher...',
    'th-TH': 'รอผู้พูด...',
    'vi-VN': 'Đang chờ người nói...'
};

const THEMES = [
    { id: 'candy', name: '夢幻糖果', colorA: '#ec4899', colorB: '#8b5cf6' },
    { id: 'summer', name: '夏日暖陽', colorA: '#f59e0b', colorB: '#ea580c' },
    { id: 'ocean', name: '蔚藍海洋', colorA: '#06b6d4', colorB: '#3b82f6' },
    { id: 'forest', name: '靜謐森林', colorA: '#10b981', colorB: '#059669' },
];

/* State */
let state = {
    sourceLang: 'zh-TW', // A
    targetLang: 'ja-JP', // B
    isListening: false,
    theme: 'candy', // Changed default theme to candy
    activeSide: 'source', // 'source' or 'target'
    isMuted: false, // Default Not Muted
    isSpeaking: false, // TTS playing status
    lastFinalText: '', // Debounce text
    lastFinalTime: 0 // Debounce time
};

const els = {};
let recognition = null;
let isRestarting = false;

// Helper functions moved to top
function showToast(msg) {
    if (!els['toast']) return;
    els['toast'].textContent = msg;
    els['toast'].classList.remove('hidden');
    setTimeout(() => els['toast'].classList.add('hidden'), 3000);
}

/* Init */
document.addEventListener('DOMContentLoaded', () => {
    const getEl = (id) => document.getElementById(id);
    const elementsId = [
        'source-lang', 'target-lang', 'theme-btn', 'theme-menu', 'theme-list',
        'bar-mic-btn', 'swap-btn', 'clear-btn', 'top-clear-btn',
        'source-chat', 'target-chat', 'source-lang-label', 'target-lang-label',
        'card-source', 'card-target', 'toast', 'mute-btn'
    ];
    elementsId.forEach(id => els[id] = getEl(id));

    initLanguages();
    initThemes();
    bindEvents();

    // Initial Render
    renderPlaceholder(els['source-chat'], state.sourceLang, false);
    renderPlaceholder(els['target-chat'], state.targetLang, false);

    if (window.lucide) lucide.createIcons();
    setupSpeechRecognition();
    updateUI();
});

function initLanguages() {
    const createOptions = (select) => {
        LANGUAGES.forEach(lang => {
            const opt = document.createElement('option');
            opt.value = lang.code;
            opt.textContent = lang.name;
            select.appendChild(opt);
        });
    };
    createOptions(els['source-lang']);
    createOptions(els['target-lang']);

    els['source-lang'].value = state.sourceLang;
    els['target-lang'].value = state.targetLang;
}

function initThemes() {
    els['theme-list'].innerHTML = '';
    THEMES.forEach(t => {
        const btn = document.createElement('div');
        btn.className = 'theme-option';
        btn.innerHTML = `
            <div style="display:flex; gap:4px;">
                <div class="theme-dot" style="background: ${t.colorA}"></div>
                <div class="theme-dot" style="background: ${t.colorB}"></div>
            </div>
            <span>${t.name}</span>
        `;
        btn.onclick = () => setTheme(t.id);
        els['theme-list'].appendChild(btn);
    });
}

function bindEvents() {
    els['source-lang'].onchange = (e) => {
        state.sourceLang = e.target.value;
        restartListening();
        updateUI();
    };

    els['target-lang'].onchange = (e) => {
        state.targetLang = e.target.value;
        restartListening();
        updateUI();
    };

    // Swap Btn Click Handler
    els['swap-btn'].onclick = () => {
        if (state.isListening) {
            // Direction Toggle Mode
            switchActiveSide(state.activeSide === 'source' ? 'target' : 'source');
        } else {
            // Language Swap Mode
            [state.sourceLang, state.targetLang] = [state.targetLang, state.sourceLang];
            els['source-lang'].value = state.sourceLang;
            els['target-lang'].value = state.targetLang;
            updateUI();
        }
    };

    els['theme-btn'].onclick = (e) => {
        e.stopPropagation();
        els['theme-menu'].classList.toggle('hidden');
    };

    document.body.onclick = () => els['theme-menu']?.classList.add('hidden');

    els['bar-mic-btn'].onclick = toggleListening;

    // Clear buttons
    els['clear-btn'].onclick = clearAll;

    // Mute Button Toggle
    els['mute-btn'].onclick = () => {
        state.isMuted = !state.isMuted;
        const iconName = state.isMuted ? 'volume-x' : 'volume-2';
        els['mute-btn'].innerHTML = `<i data-lucide="${iconName}" size="14"></i>`;
        if (window.lucide) lucide.createIcons();
        showToast(state.isMuted ? '語音播放已關閉' : '語音播放已開啟');
    };
}

function clearAll() {
    els['source-chat'].innerHTML = '';
    els['target-chat'].innerHTML = '';
    renderPlaceholder(els['source-chat'], state.sourceLang, state.isListening, state.activeSide === 'source');
    renderPlaceholder(els['target-chat'], state.targetLang, state.isListening, state.activeSide === 'target');
}

function setTheme(id) {
    document.body.className = `theme-${id}`;
    state.theme = id;
    initThemes();
}

function getLangName(code) {
    return LANGUAGES.find(l => l.code === code)?.name || code;
}

function getUIText(lang, isListening, isActive) {
    if (isListening) {
        return isActive ? (LISTEN_STRINGS[lang] || LISTEN_STRINGS['en-US']) : (WAITING_STRINGS[lang] || WAITING_STRINGS['en-US']);
    }
    return UI_STRINGS[lang] || UI_STRINGS['en-US'];
}

function renderPlaceholder(container, lang, isListening, isActive) {
    if (!container) return;
    const iconName = isListening ? (isActive ? 'mic' : 'mic-off') : 'mic-off';
    // Logic: 
    // Idle: mic-off (or user preference)
    // Listening + Active: mic
    // Listening + Waiting: mic-off (or loader?) -> User said "Waiting...", let's keep mic-off or distinct icon. 
    // Let's stick to mic-off for waiting to indicate "Not your turn" or just idle icon. Use 'loader' if available? Lucide has 'loader-2'.
    // User requested text change mostly. Let's keep icon simple for now. 
    // Actually, Waiting could use 'ear' or 'user' or just 'mic-off'. Let's use 'mic-off' for consistency with "not recording me".

    container.innerHTML = `
        <div class="empty-placeholder">
            <i data-lucide="${iconName}" size="64" class="placeholder-icon"></i>
            <div>${getUIText(lang, isListening, isActive)}</div>
        </div>
    `;
    if (window.lucide) lucide.createIcons();
}

/* Helper to update placeholder if it exists */
/* Helper to update placeholder if it exists */
function updatePlaceholder(container, lang, isListening, isActive) {
    if (!container) return;

    // Priority: If bubbles exist, ensure NO placeholder is shown
    if (container.querySelector('.msg-bubble')) {
        const ph = container.querySelector('.empty-placeholder');
        if (ph) ph.remove();
        return;
    }

    const ph = container.querySelector('.empty-placeholder');
    if (ph) {
        // Re-render completely to update icon and text
        renderPlaceholder(container, lang, isListening, isActive);
    } else if (container.children.length === 0) {
        // If empty, render
        renderPlaceholder(container, lang, isListening, isActive);
    }
}

function updateUI() {
    els['source-lang-label'].textContent = getLangName(state.sourceLang);
    els['target-lang-label'].textContent = getLangName(state.targetLang);

    // Update Active Classes & Arrow Button
    const swapBtn = els['swap-btn'];

    if (state.isListening) {
        els['bar-mic-btn'].classList.add('active');
        swapBtn.classList.add('active'); // Add pulse effect

        // Set Arrow Icon based on active side
        if (state.activeSide === 'source') {
            // Listening Bottom (Source) -> Show Up Arrow (Translate to Top)
            swapBtn.innerHTML = '<i data-lucide="arrow-up" size="24"></i>';
            els['card-source'].classList.add('listening-active');
            els['card-target'].classList.remove('listening-active');
        } else {
            // Listening Top (Target) -> Show Down Arrow (Translate to Bottom)
            swapBtn.innerHTML = '<i data-lucide="arrow-down" size="24"></i>';
            els['card-source'].classList.remove('listening-active');
            els['card-target'].classList.add('listening-active');
        }
    } else {
        // Idle State -> Show Swap Icon
        els['bar-mic-btn'].classList.remove('active');
        swapBtn.classList.remove('active'); // Remove pulse effect
        swapBtn.innerHTML = '<i data-lucide="arrow-up-down" size="20"></i>';
        els['card-source'].classList.remove('listening-active');
        els['card-target'].classList.remove('listening-active');
    }

    // Update Placeholders
    // state.activeSide is the side we are LISTENING to.
    updatePlaceholder(els['source-chat'], state.sourceLang, state.isListening, state.activeSide === 'source');
    updatePlaceholder(els['target-chat'], state.targetLang, state.isListening, state.activeSide === 'target');

    if (window.lucide) lucide.createIcons();
}

function switchActiveSide(side) {
    if (!state.isListening) return;
    if (state.activeSide === side) return;

    state.activeSide = side;
    restartListening();
    updateUI();
}

/* --- SPEECH RECOGNITION (SINGLE INSTANCE) --- */
function setupSpeechRecognition() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        showToast('瀏覽器不支援語音辨識');
        return;
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
        state.isListening = true;
        updateUI();
    };

    recognition.onend = () => {
        // Prevent restart if stopped due to TTS speaking
        if (state.isSpeaking) return;

        if (state.isListening && !isRestarting) {
            try { recognition.start(); } catch (e) { }
        } else if (!state.isListening) {
            updateUI();
        }
    };

    recognition.onresult = (event) => {
        let final = '';
        let interim = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) final += event.results[i][0].transcript;
            else interim += event.results[i][0].transcript;
        }

        if (final) {
            const now = Date.now();
            // Debounce: Ignore if same text within 2 seconds
            if (final === state.lastFinalText && (now - state.lastFinalTime < 2000)) {
                return;
            }
            state.lastFinalText = final;
            state.lastFinalTime = now;

            handleFinalSpeech(final);
            removeInterimBubble();
        } else if (interim) {
            updateInterimBubble(interim);
        }
    };

    recognition.onerror = (e) => {
        if (e.error === 'not-allowed') {
            state.isListening = false;
            updateUI();
            showToast('請允許麥克風權限');
        }
    };
}

function toggleListening() {
    if (!recognition) return;

    if (state.isListening) {
        state.isListening = false;
        recognition.stop();
    } else {
        state.isListening = true;
        state.activeSide = 'source'; // Reset to default (Me/Bottom/Up Arrow)
        recognition.lang = state.sourceLang;
        try { recognition.start(); } catch (e) { }
    }
    updateUI();
}

function restartListening() {
    if (state.isListening) {
        isRestarting = true;
        recognition.stop();
        setTimeout(() => {
            // Set lang based on active side
            recognition.lang = state.activeSide === 'source' ? state.sourceLang : state.targetLang;
            try { recognition.start(); } catch (e) { }
            isRestarting = false;
        }, 100);
    }
}

/* --- LOGIC HANDLER --- */
function handleFinalSpeech(text) {
    // Remove placeholders if valid speech
    const sPh = els['source-chat'].querySelector('.empty-placeholder');
    if (sPh) sPh.remove();
    const tPh = els['target-chat'].querySelector('.empty-placeholder');
    if (tPh) tPh.remove();

    const side = state.activeSide;

    if (side === 'source') {
        // I spoke (A) -> Translating to B
        // Bottom (A View): Right, Color A
        addBubble(els['source-chat'], text, 'text-a align-right');

        // Translate A -> B
        doTranslate(text, state.sourceLang, state.targetLang).then(trans => {
            // Top (B View): Right (My speech translated), Color B
            addBubble(els['target-chat'], trans, 'text-b align-right');
            handleSpeak(trans, state.targetLang);
        });

    } else {
        // They spoke (B) -> Translating to A
        // Top (B View): Left (Their speech), Color B
        addBubble(els['target-chat'], text, 'text-b align-left');

        // Translate B -> A
        doTranslate(text, state.targetLang, state.sourceLang).then(trans => {
            // Bottom (A View): Left (Their speech translated), Color A
            addBubble(els['source-chat'], trans, 'text-a align-left');
            handleSpeak(trans, state.sourceLang);
        });
    }
}

/* --- BUBBLES --- */
function addBubble(container, text, classes) {
    if (!container || !text) return;

    // Priority: Remove placeholder logic
    const ph = container.querySelector('.empty-placeholder');
    if (ph) ph.remove();

    // Check history limit (Max 5)
    // Filter out placeholders and temp bubbles if any, though temp should be removed by now.
    // We only count actual .msg-bubble.
    const bubbles = container.querySelectorAll('.msg-bubble:not(.temp)');
    if (bubbles.length >= 5) {
        // Remove the oldest (first one)
        bubbles[0].remove();
    }

    const bubble = document.createElement('div');
    bubble.className = `msg-bubble ${classes}`;
    bubble.textContent = text;
    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
}

function updateInterimBubble(text) {
    // Show interim in the active container
    const container = state.activeSide === 'source' ? els['source-chat'] : els['target-chat'];

    // Remove placeholder
    const ph = container.querySelector('.empty-placeholder');
    if (ph) ph.remove();

    let bubble = document.getElementById('temp-bubble');
    if (!bubble) {
        bubble = document.createElement('div');
        bubble.id = 'temp-bubble';
        // Align based on side (Source=Right, Target=Left)
        const align = state.activeSide === 'source' ? 'align-right' : 'align-left';
        const color = state.activeSide === 'source' ? 'text-a' : 'text-b';
        bubble.className = `msg-bubble temp ${align} ${color}`;
        container.appendChild(bubble);
    }
    bubble.textContent = text;
    container.scrollTop = container.scrollHeight;
}

function removeInterimBubble() {
    const bubble = document.getElementById('temp-bubble');
    if (bubble) bubble.remove();
}

/* --- API --- */
async function doTranslate(text, from, to) {
    try {
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`;
        const res = await fetch(url);
        const data = await res.json();
        return data.responseStatus === 200 ? data.responseData.translatedText : 'Error';
    } catch (e) { console.error(e); return 'Error'; }
}

function handleSpeak(text, lang) {
    if (state.isMuted) return; // Check Mute State

    // Stop recognition to prevent self-hearing loop
    state.isSpeaking = true;
    try { recognition.abort(); } catch (e) { }

    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;

    // Resume recognition after speaking
    u.onend = u.onerror = () => {
        state.isSpeaking = false;
        if (state.isListening) {
            try { recognition.start(); } catch (e) { }
        }
    };

    window.speechSynthesis.speak(u);
}
