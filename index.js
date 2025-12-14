import {
    extension_settings,
    saveSettingsDebounced,
} from "../../../extensions.js";

const extensionName = "Sillytavern_WelcomeIdleVoice";

// 優化：動態獲取插件路徑，不論使用者將資料夾改名為什麼都能運作
const extensionUrl = import.meta.url;
const extensionFolderPath = extensionUrl.substring(0, extensionUrl.lastIndexOf('/') + 1);

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
let hasPlayedStartup = false;

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

// 核心播放邏輯
async function playSound(src, isTest = false) {
    if (!src) return;

    // 路徑處理：支援 HTTP 網址或相對路徑
    let finalSrc = src;
    if (!src.startsWith("http") && !src.startsWith("/")) {
        finalSrc = extensionFolderPath + src;
    }

    // 檢查檔案是否存在 (僅在相對路徑時檢查，避免 CORS 問題)
    if (!src.startsWith("http")) {
        try {
            const check = await fetch(finalSrc, { method: 'HEAD' });
            if (!check.ok) {
                console.warn(`[${extensionName}] Audio file not found: ${finalSrc} - index.js:53`);
                if (isTest) alert(`File not found: ${finalSrc}\nPlease check the path.`);
                return;
            }
        } catch (e) {
            console.error(`[${extensionName}] Error checking file: - index.js:58`, e);
        }
    }

    console.log(`[${extensionName}] Playing: ${finalSrc} - index.js:62`);
    const audio = new Audio(finalSrc);
    audio.volume = extension_settings[extensionName].volume ?? 0.5;

    audio.play().catch(e => {
        console.warn(`[${extensionName}] Playback failed. - index.js:67`, e);
        if (isTest) alert(`Playback failed. Browser might be blocking audio.\nError: ${e.message}`);
    });
}

// 閒置邏輯
function triggerIdleAction() {
    if (!extension_settings[extensionName].enableIdle) return;
    if (isIdle) return;

    isIdle = true;
    console.log(`[${extensionName}] Idle threshold reached. - index.js:78`);
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
    // 增加更多互動事件以確保準確重置
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click', 'wheel'];
    events.forEach(event => {
        document.addEventListener(event, resetIdleTimer, { passive: true });
    });
    resetIdleTimer();
}

// 啟動音效邏輯
function triggerStartupAction() {
    if (!extension_settings[extensionName].enableStartup) return;
    if (hasPlayedStartup) return;

    const interactionHandler = () => {
        if (hasPlayedStartup) return;
        
        console.log(`[${extensionName}] First interaction detected. Playing startup sound. - index.js:109`);
        playSound(extension_settings[extensionName].startupSoundSrc);
        hasPlayedStartup = true;

        // 清理監聽器
        ['click', 'keydown', 'touchstart', 'mousedown'].forEach(evt => 
            document.removeEventListener(evt, interactionHandler)
        );
    };

    // 等待使用者第一次操作 (繞過 Autoplay 限制)
    ['click', 'keydown', 'touchstart', 'mousedown'].forEach(evt => 
        document.addEventListener(evt, interactionHandler, { once: true, passive: true })
    );
}

// ----------------------
// UI 渲染 (修復 CSS 與結構)
// ----------------------
function renderSettings() {
    const settingsContainerId = `${extensionName}_settings`;
    $(`#${settingsContainerId}`).remove();

    // 優化 HTML 結構：
    // 1. 去除多餘的 wrapping div
    // 2. 使用 flex-container 和 alignItems 來對齊按鈕
    // 3. 增加 "Test" 按鈕方便除錯
    const settingsHtml = `
    <div id="${settingsContainerId}" class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
            <b>Welcome & Idle Voice</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content" style="display:none;">
            
            <!-- Volume Control -->
            <div class="flex-container align-items-center">
                <small style="margin-right: 10px;">Master Volume</small>
                <input type="number" class="text_pole" id="${extensionName}_volume" 
                       value="${extension_settings[extensionName].volume}" step="0.1" max="1" min="0" style="width: 80px;">
            </div>
            
            <hr>

            <!-- Startup Settings -->
            <div class="flex-container">
                <label class="checkbox_label">
                    <input type="checkbox" id="${extensionName}_enable_startup" ${extension_settings[extensionName].enableStartup ? "checked" : ""}>
                    Enable Startup Sound
                </label>
            </div>
            <div class="flex-container align-items-center" style="margin-top: 5px;">
                <div style="flex-grow: 1; margin-right: 5px;">
                    <small>Startup Audio Path (Relative to extension)</small>
                    <input type="text" class="text_pole" id="${extensionName}_startup_src" 
                           value="${extension_settings[extensionName].startupSoundSrc}" placeholder="audio/welcome.wav">
                </div>
                <div class="menu_button" id="${extensionName}_test_startup" style="height: 38px; margin-top: 18px;">
                    Test
                </div>
            </div>

            <hr>

            <!-- Idle Settings -->
            <div class="flex-container">
                <label class="checkbox_label">
                    <input type="checkbox" id="${extensionName}_enable_idle" ${extension_settings[extensionName].enableIdle ? "checked" : ""}>
                    Enable Idle Sound
                </label>
            </div>
            <div class="flex-container align-items-center" style="margin-top: 5px;">
                <div style="flex-grow: 1; margin-right: 5px;">
                    <small>Idle Audio Path</small>
                    <input type="text" class="text_pole" id="${extensionName}_idle_src" 
                           value="${extension_settings[extensionName].idleSoundSrc}" placeholder="audio/idle.wav">
                </div>
                <div class="menu_button" id="${extensionName}_test_idle" style="height: 38px; margin-top: 18px;">
                    Test
                </div>
            </div>
            <div style="margin-top: 10px;">
                <small>Idle Timeout (Seconds)</small>
                <input type="number" class="text_pole" id="${extensionName}_timeout" 
                       value="${extension_settings[extensionName].idleTimeout}" min="5">
            </div>

            <hr>
            <div>
                <small><i>Current Extension Path: <b>${extensionFolderPath}audio/</b></i></small>
            </div>
        </div>
    </div>
    `;

    // 直接 append drawer 到 extensions_settings，不要包額外的 div
    $('#extensions_settings').append(settingsHtml);

    // --- 事件綁定 ---

    // 摺疊/展開
    $(`#${settingsContainerId} .inline-drawer-toggle`).on('click', function() {
        const $icon = $(this).find('.inline-drawer-icon');
        const $content = $(this).next('.inline-drawer-content');
        $content.slideToggle(200);
        $icon.toggleClass('down up');
    });

    // 設定變更
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
        resetIdleTimer();
        saveSettingsDebounced();
    });

    $(`#${extensionName}_idle_src`).on('input', function() {
        extension_settings[extensionName].idleSoundSrc = $(this).val();
        saveSettingsDebounced();
    });

    $(`#${extensionName}_timeout`).on('change', function() {
        let val = parseInt($(this).val());
        if (val < 5) val = 5;
        extension_settings[extensionName].idleTimeout = val;
        resetIdleTimer();
        saveSettingsDebounced();
    });
    
    $(`#${extensionName}_volume`).on('change', function() {
        extension_settings[extensionName].volume = parseFloat($(this).val());
        saveSettingsDebounced();
    });

    // 測試按鈕事件
    $(`#${extensionName}_test_startup`).on('click', () => {
        playSound(extension_settings[extensionName].startupSoundSrc, true);
    });

    $(`#${extensionName}_test_idle`).on('click', () => {
        playSound(extension_settings[extensionName].idleSoundSrc, true);
    });
}

// 初始化
jQuery(async () => {
    try {
        loadSettings();
        renderSettings();
        setupIdleListeners();
        triggerStartupAction();
        console.log(`[${extensionName}] Loaded. Path: ${extensionFolderPath} - index.js:269`);
    } catch (e) {
        console.error(`[${extensionName}] Load Error: - index.js:271`, e);
    }
});
