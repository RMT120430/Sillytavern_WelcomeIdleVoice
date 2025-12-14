import {
    extension_settings,
} from "../../../extensions.js";

import {
    saveSettingsDebounced,
} from "../../../../script.js";

const extensionName = "Sillytavern_WelcomeIdleVoice";
const scriptUrl = import.meta.url; 
const extensionRootUrl = scriptUrl.substring(0, scriptUrl.lastIndexOf('/') + 1);

// 預設設定
const defaultSettings = {
    enableStartup: true,
    startupSoundSrc: "audio/welcome.wav",
    enableIdle: true,
    idleSoundSrc: "audio/idle.wav",
    idleTimeout: 60,
    volume: 0.9
};

// --- Web Audio API 變數 ---
let audioCtx = null;       // 音訊引擎核心
let startupBuffer = null;  // 預先解碼好的啟動音效數據
let isAudioUnlocked = false; // 標記引擎是否已解鎖

let idleTimer = null;
let isIdle = false;
let hasPlayedStartup = false;

// -----------------------------------
// 核心：初始化 AudioContext
// -----------------------------------
function initAudioContext() {
    if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
    }
}

// -----------------------------------
// 核心：載入並解碼音效 (Buffer Loader)
// -----------------------------------
async function loadAudioBuffer(url) {
    initAudioContext();
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        // 將檔案解碼為音訊數據
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        return audioBuffer;
    } catch (e) {
        console.warn(`[${extensionName}] Failed to load audio: ${url} - index.js:55`, e);
        return null;
    }
}

// -----------------------------------
// 核心：播放邏輯 (Buffer Source)
// -----------------------------------
async function playSound(srcOrBuffer, isTest = false) {
    initAudioContext();

    // 1. 處理音源：如果是字串路徑，需要即時載入；如果是 Buffer，直接用
    let buffer = null;
    if (typeof srcOrBuffer === 'string') {
        const url = getFullAudioUrl(srcOrBuffer);
        if (!url) return;
        buffer = await loadAudioBuffer(url);
    } else {
        buffer = srcOrBuffer;
    }

    if (!buffer) return;

    // 2. 建立音源節點
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;

    // 3. 建立音量節點 (GainNode)
    const gainNode = audioCtx.createGain();
    gainNode.gain.value = extension_settings[extensionName].volume ?? 0.9;

    // 4. 連接：Source -> Gain -> Destination (喇叭)
    source.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    // 5. 播放
    // 這裡不需要 catch，因為 Web Audio 的 start() 不會回傳 Promise，也不會像 HTML5 Audio 那樣報 NotAllowedError
    // 只要 Context 是 running 狀態就會有聲音
    source.start(0); 
    
    if (isTest) console.log(`[${extensionName}] Test sound played via Web Audio API - index.js:95`);
}

// -----------------------------------
// 輔助函式
// -----------------------------------

function loadSettings() {
    if (!extension_settings[extensionName]) {
        extension_settings[extensionName] = {};
    }
    for (const key in defaultSettings) {
        if (!Object.hasOwn(extension_settings[extensionName], key)) {
            extension_settings[extensionName][key] = defaultSettings[key];
        }
    }
}

function getFullAudioUrl(src) {
    if (!src) return null;
    if (src.startsWith("http")) return src;
    const cleanPath = src.startsWith('/') ? src.slice(1) : src;
    return `${extensionRootUrl}${cleanPath}`;
}

// 預載啟動音效
async function preloadStartup() {
    if (!extension_settings[extensionName].enableStartup) return;
    const url = getFullAudioUrl(extension_settings[extensionName].startupSoundSrc);
    if (url) {
        console.log(`[${extensionName}] Preloading startup sound... - index.js:125`);
        startupBuffer = await loadAudioBuffer(url);
    }
}

// -----------------------------------
// 關鍵修復：解鎖 AudioContext 並播放啟動音效
// -----------------------------------
function setupStartupTrigger() {
    if (hasPlayedStartup) return;

    // 這個函式會在使用者第一次互動時執行
    const unlockAndPlay = () => {
        if (hasPlayedStartup) return;

        initAudioContext();

        // 這是 Google 文件提到的關鍵步驟：resume()
        if (audioCtx.state === 'suspended') {
            audioCtx.resume().then(() => {
                console.log(`[${extensionName}] AudioContext resumed (unlocked)! - index.js:145`);
                
                // 引擎解鎖後，如果我們有預載好的 Buffer，直接播放
                if (extension_settings[extensionName].enableStartup && startupBuffer) {
                    console.log(`[${extensionName}] Playing startup sound now. - index.js:149`);
                    playSound(startupBuffer);
                }
            });
        } else {
             // 如果已經是 running 狀態 (極少見)，直接播
             if (extension_settings[extensionName].enableStartup && startupBuffer) {
                playSound(startupBuffer);
            }
        }

        hasPlayedStartup = true;
        isAudioUnlocked = true;

        // 清理監聽器
        ['click', 'keydown', 'touchstart', 'mousedown'].forEach(evt => 
            document.removeEventListener(evt, unlockAndPlay, { capture: true })
        );
    };

    // 監聽
    ['click', 'keydown', 'touchstart', 'mousedown'].forEach(evt => 
        document.addEventListener(evt, unlockAndPlay, { once: true, capture: true })
    );
}

// -----------------------------------
// 閒置邏輯 (不變，但改用 Web Audio 播放)
// -----------------------------------
function triggerIdleAction() {
    if (!extension_settings[extensionName].enableIdle) return;
    if (isIdle) return;

    // 只有在引擎解鎖後才播放閒置音效，避免報錯
    if (audioCtx && audioCtx.state === 'running') {
        isIdle = true;
        console.log(`[${extensionName}] Idle triggered. - index.js:185`);
        playSound(extension_settings[extensionName].idleSoundSrc);
    }
}

function resetIdleTimer() {
    if (isIdle) isIdle = false;
    if (idleTimer) clearTimeout(idleTimer);

    if (extension_settings[extensionName].enableIdle) {
        let timeout = extension_settings[extensionName].idleTimeout;
        if (timeout < 60) timeout = 60; 
        idleTimer = setTimeout(triggerIdleAction, timeout * 1000);
    }
}

function setupIdleListeners() {
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'click', 'scroll'];
    events.forEach(event => {
        document.addEventListener(event, resetIdleTimer, { passive: true });
    });
    resetIdleTimer();
}

// -----------------------------------
// UI 渲染 (維持你要求的樣式)
// -----------------------------------
function renderSettings() {
    const settingsContainerId = `${extensionName}_settings`;
    const targetContainer = $('#extensions_settings');

    if (targetContainer.length === 0) {
        setTimeout(renderSettings, 500);
        return;
    }

    $(`#${settingsContainerId}`).remove();

    const html = `
    <div id="${settingsContainerId}" class="settings_content">
        <div class="inline-drawer">
            <div id="${extensionName}_toggle" class="inline-drawer-toggle inline-drawer-header">
                <b>Welcome & Idle Voice</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content" style="display:none;">
                
                <div class="flex-container">
                    <label class="checkbox_label">
                        <input type="checkbox" id="${extensionName}_enable_startup" ${extension_settings[extensionName].enableStartup ? "checked" : ""}>
                        Enable Startup Sound
                    </label>
                </div>
                <div class="flex-container">
                    <input type="text" class="text_pole" id="${extensionName}_startup_src" value="${extension_settings[extensionName].startupSoundSrc}" placeholder="audio/welcome.wav" style="flex:1;">
                    <div id="${extensionName}_test_startup" class="menu_button">Test</div>
                </div>

                <hr>

                <div class="flex-container">
                    <label class="checkbox_label">
                        <input type="checkbox" id="${extensionName}_enable_idle" ${extension_settings[extensionName].enableIdle ? "checked" : ""}>
                        Enable Idle Sound
                    </label>
                </div>
                <div class="flex-container">
                    <input type="text" class="text_pole" id="${extensionName}_idle_src" value="${extension_settings[extensionName].idleSoundSrc}" placeholder="audio/idle.wav" style="flex:1;">
                    <div id="${extensionName}_test_idle" class="menu_button">Test</div>
                </div>
                
                <div class="flex-container" style="align-items: center; margin-top: 5px;">
                    <small style="flex:1;">Idle Timeout (Min 60s):</small>
                    <input type="number" class="text_pole" id="${extensionName}_timeout_input" value="${extension_settings[extensionName].idleTimeout}" min="60" style="width: 70px; margin-right: 5px;">
                    <div id="${extensionName}_timeout_apply" class="menu_button" style="width: auto; padding: 5px 10px;">Apply</div>
                </div>

                <hr>
                <div class="flex-container">
                    <small>Volume:</small>
                    <input type="number" class="text_pole" id="${extensionName}_volume" value="${extension_settings[extensionName].volume}" step="0.1" max="1" min="0" style="width: 80px;">
                </div>
                <div style="margin-top:5px; font-size:0.8em; opacity:0.6;">
                    Engine: Web Audio API
                </div>
            </div>
        </div>
    </div>
    `;

    targetContainer.append(html);

    // 事件綁定
    $(`#${extensionName}_toggle`).on('click', function(e) {
        e.stopPropagation();
        const icon = $(this).find('.inline-drawer-icon');
        const content = $(this).next('.inline-drawer-content');
        content.slideToggle(200);
        icon.toggleClass('down up');
    });

    $(`#${extensionName}_enable_startup`).on('change', function() {
        extension_settings[extensionName].enableStartup = $(this).is(':checked');
        saveSettingsDebounced();
    });
    $(`#${extensionName}_startup_src`).on('input', function() {
        extension_settings[extensionName].startupSoundSrc = $(this).val();
        saveSettingsDebounced();
        // 重載 Buffer
        preloadStartup();
    });
    $(`#${extensionName}_enable_idle`).on('change', function() {
        extension_settings[extensionName].enableIdle = $(this).is(':checked');
        resetIdleTimer();
        saveSettingsDebounced();
    });
    $(`#${extensionName}_idle_src`).on('input', function() {
        extension_settings[extensionName].idleSoundSrc = $(this).val();
        saveSettingsDebounced();
    });
    $(`#${extensionName}_volume`).on('change', function() {
        extension_settings[extensionName].volume = parseFloat($(this).val());
        saveSettingsDebounced();
    });

    // Apply Button
    $(`#${extensionName}_timeout_apply`).on('click', function(e) {
        e.stopPropagation();
        const inputElem = $(`#${extensionName}_timeout_input`);
        let val = parseInt(inputElem.val());
        if (isNaN(val) || val < 60) val = 60;
        inputElem.val(val);
        extension_settings[extensionName].idleTimeout = val;
        saveSettingsDebounced();
        resetIdleTimer();
        const btn = $(this);
        const originalText = btn.text();
        btn.text("Saved!");
        setTimeout(() => btn.text(originalText), 1500);
    });

    // Tests (現在使用 Web Audio)
    $(`#${extensionName}_test_startup`).on('click', (e) => {
        e.stopPropagation();
        // 測試時如果沒有 buffer，會嘗試即時載入，所以這裡傳入路徑
        playSound(extension_settings[extensionName].startupSoundSrc, true);
    });
    $(`#${extensionName}_test_idle`).on('click', (e) => {
        e.stopPropagation();
        playSound(extension_settings[extensionName].idleSoundSrc, true);
    });
}

// 初始化
jQuery(async () => {
    try {
        loadSettings();
        
        // 1. 初始化 Web Audio Context (Suspended state)
        initAudioContext();
        
        // 2. 預先下載解碼 Welcome 音效 (Buffer)
        await preloadStartup();
        
        // 3. 設定監聽器：當使用者第一次點擊時，Resume Context 並播放 Buffer
        setupStartupTrigger();
        
        setupIdleListeners();
        renderSettings();
        
        console.log(`[${extensionName}] Web Audio API Ready. Waiting for user gesture to unlock. - index.js:355`);
    } catch (e) {
        console.error(`[${extensionName}] Error: - index.js:357`, e);
    }
});
