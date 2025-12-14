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

// --- Web Audio API 全域變數 ---
// 為了確保不漏接任何狀態，我們使用全域變數管理
let audioCtx = null;
let startupBuffer = null;
let hasPlayedStartup = false;
let isContextUnlocked = false;

// -----------------------------------
// 核心：初始化 AudioContext (惰性載入)
// -----------------------------------
function getAudioContext() {
    if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
    }
    return audioCtx;
}

// -----------------------------------
// 核心：載入並解碼 (Buffer Loader)
// -----------------------------------
async function loadAudioBuffer(url) {
    const ctx = getAudioContext();
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        return await ctx.decodeAudioData(arrayBuffer);
    } catch (e) {
        console.warn(`[${extensionName}] Load failed: ${url} - index.js:52`, e);
        return null;
    }
}

// -----------------------------------
// 核心：播放邏輯
// -----------------------------------
async function playSound(srcOrBuffer, isTest = false) {
    const ctx = getAudioContext();

    // 嘗試恢復 Context (如果還沒恢復)
    if (ctx.state === 'suspended') {
        try { await ctx.resume(); } catch (e) { /* 忽略，等待使用者互動 */ }
    }

    let buffer = null;
    if (typeof srcOrBuffer === 'string') {
        const url = getFullAudioUrl(srcOrBuffer);
        if (!url) return;
        buffer = await loadAudioBuffer(url);
    } else {
        buffer = srcOrBuffer;
    }

    if (!buffer) return;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gainNode = ctx.createGain();
    gainNode.gain.value = extension_settings[extensionName].volume ?? 0.9;

    source.connect(gainNode);
    gainNode.connect(ctx.destination);
    source.start(0);

    if (isTest) console.log(`[${extensionName}] Test sound played. - index.js:88`);
}

// -----------------------------------
// 關鍵邏輯：全域互動監聽 (Global Unlocker)
// -----------------------------------
// 這個函式會定義在最外層，確保腳本一執行就開始監聽點擊
// 不管 ST 介面有沒有載入，只要使用者點了視窗任何一處，就嘗試解鎖
function attachGlobalUnlockListener() {
    const events = ['click', 'keydown', 'touchstart', 'mousedown'];
    
    const unlockHandler = () => {
        const ctx = getAudioContext();
        
        // 1. 嘗試解鎖引擎
        if (ctx.state === 'suspended') {
            ctx.resume().then(() => {
                console.log(`[${extensionName}] Audio Engine Unlocked via user gesture! - index.js:105`);
                isContextUnlocked = true;
                
                // 2. 檢查是否有掛單 (Buffer 已經好了，但還沒播)
                if (extension_settings[extensionName]?.enableStartup && startupBuffer && !hasPlayedStartup) {
                    console.log(`[${extensionName}] Buffer ready + Engine unlocked. Playing NOW. - index.js:110`);
                    playSound(startupBuffer);
                    hasPlayedStartup = true;
                }
            });
        } else {
            isContextUnlocked = true;
        }
        
        // 移除監聽 (只需要一次成功即可)
        // 注意：這裡不急著移除，直到確認 Context 真的變成 running
        if (ctx.state === 'running') {
            events.forEach(evt => window.removeEventListener(evt, unlockHandler, { capture: true }));
        }
    };

    // 使用 window 層級 + capture: true，這是最強的攔截方式
    events.forEach(evt => window.addEventListener(evt, unlockHandler, { capture: true }));
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
        console.log(`[${extensionName}] Downloading startup sound... - index.js:156`);
        startupBuffer = await loadAudioBuffer(url);
        
        // 情況 B：音檔下載比較慢，使用者已經點擊過頁面解鎖了引擎
        // 這時候因為監聽器可能已經跑完了，所以我們要主動檢查一次
        const ctx = getAudioContext();
        if (ctx.state === 'running' && !hasPlayedStartup && isContextUnlocked) {
            console.log(`[${extensionName}] Download finished after unlock. Playing NOW. - index.js:163`);
            playSound(startupBuffer);
            hasPlayedStartup = true;
        }
    }
}

// -----------------------------------
// 閒置邏輯
// -----------------------------------
let idleTimer = null;
let isIdle = false;

function triggerIdleAction() {
    if (!extension_settings[extensionName].enableIdle) return;
    if (isIdle) return;
    
    // 只有在引擎是 running 狀態才播，不然會報錯
    const ctx = getAudioContext();
    if (ctx.state === 'running') {
        isIdle = true;
        console.log(`[${extensionName}] Idle triggered. - index.js:184`);
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
// UI 渲染
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
            </div>
        </div>
    </div>
    `;

    targetContainer.append(html);

    // 事件綁定
    $(`#${extensionName}_toggle`).on('click', function(e) {
        e.stopPropagation();
        $(this).next('.inline-drawer-content').slideToggle(200);
        $(this).find('.inline-drawer-icon').toggleClass('down up');
    });

    $(`#${extensionName}_enable_startup`).on('change', function() {
        extension_settings[extensionName].enableStartup = $(this).is(':checked');
        saveSettingsDebounced();
    });
    $(`#${extensionName}_startup_src`).on('input', function() {
        extension_settings[extensionName].startupSoundSrc = $(this).val();
        saveSettingsDebounced();
        hasPlayedStartup = false; // 路徑改變後允許再次播放測試
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

    $(`#${extensionName}_test_startup`).on('click', (e) => {
        e.stopPropagation();
        playSound(extension_settings[extensionName].startupSoundSrc, true);
    });
    $(`#${extensionName}_test_idle`).on('click', (e) => {
        e.stopPropagation();
        playSound(extension_settings[extensionName].idleSoundSrc, true);
    });
}

// -----------------------------------
// 立即執行區塊
// -----------------------------------
// 馬上掛載全域監聽，不要等待 jQuery ready，因為使用者可能在頁面載入中就點擊了
attachGlobalUnlockListener();

// 初始化流程
jQuery(async () => {
    try {
        loadSettings();
        await preloadStartup(); // 下載音檔
        setupIdleListeners();
        renderSettings();
        console.log(`[${extensionName}] Ready. - index.js:336`);
    } catch (e) {
        console.error(`[${extensionName}] Error: - index.js:338`, e);
    }
});
