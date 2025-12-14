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
    idleTimeout: 60, // 預設改為 60
    volume: 0.5
};

let idleTimer = null;
let isIdle = false;
let hasPlayedStartup = false;
let startupAudioObj = null; // 用來預載 Startup 音效

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

// 預載啟動音效 (解決 Autoplay 延遲問題)
function preloadStartupSound() {
    if (!extension_settings[extensionName].enableStartup) return;
    const src = extension_settings[extensionName].startupSoundSrc;
    const url = getFullAudioUrl(src);
    if (url) {
        startupAudioObj = new Audio(url);
        startupAudioObj.preload = "auto";
        startupAudioObj.volume = extension_settings[extensionName].volume ?? 0.5;
        startupAudioObj.load(); // 強制瀏覽器先緩衝
    }
}

function playSound(src, isTest = false, preloadedObj = null) {
    const vol = extension_settings[extensionName].volume ?? 0.5;
    let audio;

    // 如果有預載好的物件，直接使用，速度最快
    if (preloadedObj) {
        audio = preloadedObj;
        audio.volume = vol; // 確保音量是最新的
    } else {
        const fullUrl = getFullAudioUrl(src);
        if (!fullUrl) return;
        audio = new Audio(fullUrl);
        audio.volume = vol;
    }

    const playPromise = audio.play();

    if (playPromise !== undefined) {
        playPromise.then(() => {
            console.log(`[${extensionName}] Playing success.`);
        }).catch(error => {
            console.warn(`[${extensionName}] Play failed:`, error);
            if (isTest) {
                alert(`播放失敗: ${error.message}\n(請確認檔案格式是否為 wav/mp3)`);
            }
        });
    }
}

// --- 閒置邏輯 ---
function triggerIdleAction() {
    if (!extension_settings[extensionName].enableIdle) return;
    if (isIdle) return;

    isIdle = true;
    console.log(`[${extensionName}] Idle triggered.`);
    playSound(extension_settings[extensionName].idleSoundSrc);
}

function resetIdleTimer() {
    if (isIdle) isIdle = false;
    if (idleTimer) clearTimeout(idleTimer);

    if (extension_settings[extensionName].enableIdle) {
        // 確保至少 60 秒 (這裡做雙重防護)
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

// --- 啟動音效 (改進版：使用 mousedown/keydown) ---
function triggerStartupAction() {
    if (!extension_settings[extensionName].enableStartup) return;
    if (hasPlayedStartup) return;

    // 定義強制的互動監聽器
    const forcePlay = (e) => {
        if (hasPlayedStartup) return;
        
        console.log(`[${extensionName}] User interaction (${e.type}) detected. Playing startup sound.`);
        
        // 使用預載好的物件播放
        playSound(null, false, startupAudioObj);
        
        hasPlayedStartup = true;

        // 移除所有監聽
        ['mousedown', 'keydown', 'touchstart', 'click'].forEach(evt => 
            document.removeEventListener(evt, forcePlay, { capture: true })
        );
    };

    // 使用 capture: true 確保在事件傳遞的最早期就捕捉到
    // 增加 mousedown 和 keydown，比 click 反應更快
    ['mousedown', 'keydown', 'touchstart', 'click'].forEach(evt => 
        document.addEventListener(evt, forcePlay, { once: true, capture: true }) 
    );
}

// --- UI 渲染 ---
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
                
                <!-- Startup Sound -->
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

                <!-- Idle Sound -->
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
                
                <!-- Idle Timeout (防呆與 Apply 按鈕) -->
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

    // --- 事件綁定 ---

    // Toggle 展開/摺疊
    $(`#${extensionName}_toggle`).on('click', function(e) {
        e.stopPropagation();
        const icon = $(this).find('.inline-drawer-icon');
        const content = $(this).next('.inline-drawer-content');
        content.slideToggle(200);
        icon.toggleClass('down up');
    });

    // 一般設定 (Debounce Save)
    $(`#${extensionName}_enable_startup`).on('change', function() {
        extension_settings[extensionName].enableStartup = $(this).is(':checked');
        saveSettingsDebounced();
    });
    $(`#${extensionName}_startup_src`).on('input', function() {
        extension_settings[extensionName].startupSoundSrc = $(this).val();
        saveSettingsDebounced();
        // 如果路徑改變，更新預載物件
        preloadStartupSound(); 
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
        if (startupAudioObj) startupAudioObj.volume = extension_settings[extensionName].volume;
    });

    // --- 新增：Idle Timeout Apply 按鈕邏輯 ---
    $(`#${extensionName}_timeout_apply`).on('click', function(e) {
        e.stopPropagation();
        const inputElem = $(`#${extensionName}_timeout_input`);
        let val = parseInt(inputElem.val());
        
        // 防呆邏輯：如果不是數字或小於60，強制設為60
        if (isNaN(val) || val < 60) {
            val = 60;
        }

        // 更新 UI 顯示正確的值
        inputElem.val(val);
        
        // 存檔與應用
        extension_settings[extensionName].idleTimeout = val;
        saveSettingsDebounced();
        resetIdleTimer();

        // 簡單的視覺回饋
        const btn = $(this);
        const originalText = btn.text();
        btn.text("Saved!");
        setTimeout(() => btn.text(originalText), 1500);

        console.log(`[${extensionName}] Idle timeout updated to ${val}s`);
    });

    // 測試按鈕
    $(`#${extensionName}_test_startup`).on('click', (e) => {
        e.stopPropagation();
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
        preloadStartupSound(); // 啟動預載
        setupIdleListeners();
        triggerStartupAction();
        renderSettings();
    } catch (e) {
        console.error(`[${extensionName}] Error:`, e);
    }
});
