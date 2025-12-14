import {
    extension_settings,
    saveSettingsDebounced,
} from "../../../extensions.js";

const extensionName = "Sillytavern_WelcomeIdleVoice";
// 確保路徑以 / 開頭，指向伺服器根目錄，避免相對路徑錯誤
const extensionFolderPath = `/extensions/${extensionName}/`;

// 預設設定
const defaultSettings = {
    enableStartup: true,
    startupSoundSrc: "audio/welcome.wav",
    enableIdle: true,
    idleSoundSrc: "audio/idle.wav",
    idleTimeout: 60,
    volume: 0.5
};

let idleTimer = null;
let isIdle = false;
let hasPlayedStartup = false; // 確保歡迎音效只放一次

// 載入設定
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

// 撥放邏輯
function playSound(src) {
    if (!src) return;

    let finalSrc = src;
    // 簡單的路徑處理：如果是 http 開頭或已經是絕對路徑則不變
    // 否則加上插件目錄前綴
    if (!src.startsWith("http") && !src.startsWith("/")) {
        finalSrc = extensionFolderPath + src;
    }

    console.log(`[${extensionName}] Attempting to play: ${finalSrc}`);

    const audio = new Audio(finalSrc);
    audio.volume = extension_settings[extensionName].volume || 0.5;

    // 嘗試撥放，並捕捉 Autoplay 錯誤
    audio.play().catch(e => {
        console.warn(`[${extensionName}] Playback failed. Likely due to browser Autoplay Policy or file not found.`, e);
    });
}

// 閒置邏輯
function triggerIdleAction() {
    if (!extension_settings[extensionName].enableIdle) return;
    // 如果已經在閒置狀態且已經觸發過，可以根據需求決定是否重複撥放
    // 這裡設計為：一旦進入閒置，撥放一次，直到使用者動滑鼠重置
    if (isIdle) return;

    isIdle = true;
    console.log(`[${extensionName}] Idle state detected.`);
    playSound(extension_settings[extensionName].idleSoundSrc);
}

function resetIdleTimer() {
    isIdle = false;
    if (idleTimer) clearTimeout(idleTimer);

    if (extension_settings[extensionName].enableIdle) {
        const timeInMs = (extension_settings[extensionName].idleTimeout || 60) * 1000;
        idleTimer = setTimeout(triggerIdleAction, timeInMs);
    }
}

function setupIdleListeners() {
    const events = ['mousemove', 'mousedown', 'keypress', 'touchstart', 'scroll', 'click'];
    events.forEach(event => {
        document.addEventListener(event, resetIdleTimer, { passive: true });
    });
    resetIdleTimer();
}

// 啟動音效邏輯 (修復 Autoplay 問題)
function triggerStartupAction() {
    if (!extension_settings[extensionName].enableStartup) return;
    if (hasPlayedStartup) return;

    // 定義一個一次性的互動監聽器
    const interactionHandler = () => {
        if (hasPlayedStartup) return;
        
        console.log(`[${extensionName}] User interaction detected, playing startup sound.`);
        playSound(extension_settings[extensionName].startupSoundSrc);
        hasPlayedStartup = true;

        // 移除監聽器，避免重複觸發
        ['click', 'keydown', 'touchstart'].forEach(evt => 
            document.removeEventListener(evt, interactionHandler)
        );
    };

    // 瀏覽器通常不允許頁面載入後立即自動撥放聲音
    // 我們必須等待使用者的第一次 "點擊" 或 "按鍵"
    ['click', 'keydown', 'touchstart'].forEach(evt => 
        document.addEventListener(evt, interactionHandler, { once: true, passive: true })
    );
}

// ----------------------
// UI 渲染 (修復 CSS 與摺疊功能)
// ----------------------
function renderSettings() {
    const settingsContainerId = `${extensionName}_settings`;
    $(`#${settingsContainerId}`).remove();

    // 注意：HTML 結構嚴格參照 SillyTavern 的樣式習慣
    const settingsHtml = `
    <div id="${settingsContainerId}" class="settings_content">
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
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
                <div>
                    <small>Startup Audio Path (Relative to extension folder)</small>
                    <input type="text" class="text_pole" id="${extensionName}_startup_src" value="${extension_settings[extensionName].startupSoundSrc}" placeholder="audio/welcome.wav">
                </div>

                <hr>

                <div class="flex-container">
                    <label class="checkbox_label">
                        <input type="checkbox" id="${extensionName}_enable_idle" ${extension_settings[extensionName].enableIdle ? "checked" : ""}>
                        Enable Idle Sound
                    </label>
                </div>
                <div>
                    <small>Idle Audio Path</small>
                    <input type="text" class="text_pole" id="${extensionName}_idle_src" value="${extension_settings[extensionName].idleSoundSrc}" placeholder="audio/idle.wav">
                </div>
                <div>
                    <small>Idle Timeout (Seconds)</small>
                    <input type="number" class="text_pole" id="${extensionName}_timeout" value="${extension_settings[extensionName].idleTimeout}" min="5">
                </div>

                <hr>
                
                <div>
                    <small>Volume (0.0 - 1.0)</small>
                    <input type="number" class="text_pole" id="${extensionName}_volume" value="${extension_settings[extensionName].volume}" step="0.1" max="1" min="0">
                </div>
                <div style="margin-top: 10px;">
                    <small><i>Place your audio files in: <b>/extensions/${extensionName}/audio/</b></i></small>
                </div>
            </div>
        </div>
    </div>
    `;

    $('#extensions_settings').append(settingsHtml);

    // --- UI 事件綁定區 ---

    // 1. 手動添加摺疊/展開邏輯 (這是 UI 無法正確運作的主因)
    const $drawer = $(`#${settingsContainerId} .inline-drawer-toggle`);
    $drawer.on('click', function() {
        const $icon = $(this).find('.inline-drawer-icon');
        const $content = $(this).next('.inline-drawer-content');
        
        $content.slideToggle(200); // 執行動畫
        
        // 切換圖標方向
        if ($icon.hasClass('down')) {
            $icon.removeClass('down').addClass('up');
        } else {
            $icon.removeClass('up').addClass('down');
        }
    });

    // 2. 設定值變更監聽
    $(`#${extensionName}_enable_startup`).on('change', function() {
        extension_settings[extensionName].enableStartup = $(this).is(':checked');
        saveSettingsDebounced();
    });

    $(`#${extensionName}_startup_src`).on('input', function() {
        extension_settings[extensionName].startupSoundSrc = $(this).val();
        saveSettingsDebounced();
    });

    $(`#${extensionName}_enable_idle`).on('change', function() {
        extension_settings[extensionName].enableIdle = $(this).is(':checked');
        resetIdleTimer(); // 狀態改變時重置計時器
        saveSettingsDebounced();
    });

    $(`#${extensionName}_idle_src`).on('input', function() {
        extension_settings[extensionName].idleSoundSrc = $(this).val();
        saveSettingsDebounced();
    });

    $(`#${extensionName}_timeout`).on('change', function() {
        let val = parseInt($(this).val());
        if (val < 5) val = 5; // 最小限制
        extension_settings[extensionName].idleTimeout = val;
        resetIdleTimer();
        saveSettingsDebounced();
    });
    
    $(`#${extensionName}_volume`).on('change', function() {
        extension_settings[extensionName].volume = parseFloat($(this).val());
        saveSettingsDebounced();
    });
}

// 監聽 SillyTavern 初始化
jQuery(async () => {
    try {
        loadSettings();
        renderSettings();
        setupIdleListeners();
        triggerStartupAction();
        console.log(`[${extensionName}] Loaded successfully.`);
    } catch (e) {
        console.error(`[${extensionName}] Error loading:`, e);
    }
});
