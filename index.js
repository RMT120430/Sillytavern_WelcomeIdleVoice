import {
    extension_settings,
    saveSettingsDebounced,
    getContext,
} from "../../../extensions.js";

const extensionName = "Sillytavern_WelcomeIdleVoice";
const extensionFolderPath = `extensions/${extensionName}/`;

// 預設設定
const defaultSettings = {
    enableStartup: true,
    startupSoundSrc: "", // 支援 URL 或相對路徑
    enableIdle: true,
    idleSoundSrc: "",
    idleTimeout: 60, // 秒
    volume: 0.5
};

// 用來追蹤閒置狀態
let idleTimer = null;
let isIdle = false;

// 載入設定
function loadSettings() {
    if (!extension_settings[extensionName]) {
        extension_settings[extensionName] = {};
    }
    // 合併預設值
    for (const key in defaultSettings) {
        if (!Object.hasOwn(extension_settings[extensionName], key)) {
            extension_settings[extensionName][key] = defaultSettings[key];
        }
    }
}

// 撥放音效的通用函數
function playSound(src) {
    if (!src) return;
    
    // 簡單的格式處理，如果不是 http 開頭，預設認為是在 extension 資料夾內
    let finalSrc = src;
    if (!src.startsWith("http") && !src.startsWith("/")) {
        finalSrc = extensionFolderPath + src;
    }

    const audio = new Audio(finalSrc);
    audio.volume = extension_settings[extensionName].volume;
    
    audio.play().catch(e => {
        console.warn(`[${extensionName}] Audio play failed (Browser Autoplay Policy?): - index.js:51`, e);
        toastr.warning("Audio play blocked. Interact with the page first.", "Idle Voice");
    });
}

// ----------------------
// 閒置 (AFK) 邏輯
// ----------------------

function triggerIdleAction() {
    if (!extension_settings[extensionName].enableIdle) return;
    if (isIdle) return; // 已經在閒置中，避免重複撥放

    isIdle = true;
    console.log(`[${extensionName}] User is idle. - index.js:65`);
    playSound(extension_settings[extensionName].idleSoundSrc);
}

function resetIdleTimer() {
    // 如果之前是閒置狀態，現在恢復了，可以在這裡加邏輯 (例如 "歡迎回來" 音效，目前先略過)
    isIdle = false;

    if (idleTimer) clearTimeout(idleTimer);

    if (extension_settings[extensionName].enableIdle) {
        const timeInMs = extension_settings[extensionName].idleTimeout * 1000;
        idleTimer = setTimeout(triggerIdleAction, timeInMs);
    }
}

function setupIdleListeners() {
    // 監聽各種使用者操作來重置計時器
    const events = ['mousemove', 'mousedown', 'keypress', 'touchstart', 'scroll', 'click'];
    events.forEach(event => {
        document.addEventListener(event, resetIdleTimer, { passive: true });
    });
    
    // 初始化計時器
    resetIdleTimer();
}

// ----------------------
// 啟動 (Startup) 邏輯
// ----------------------

function triggerStartupAction() {
    if (!extension_settings[extensionName].enableStartup) return;
    
    // 設定一個極短延遲確保頁面載入完畢
    setTimeout(() => {
        console.log(`[${extensionName}] Playing startup sound. - index.js:101`);
        playSound(extension_settings[extensionName].startupSoundSrc);
    }, 1000);
}

// ----------------------
// UI 設定介面
// ----------------------

function renderSettings() {
    const settingsHtml = `
    <div class="settings_content">
        <h3>Startup Settings</h3>
        <label class="checkbox_label">
            <input type="checkbox" id="st_iv_enable_startup" ${extension_settings[extensionName].enableStartup ? "checked" : ""}>
            Enable Startup Sound
        </label>
        <div>
            <small>Audio URL or Filename (put file in <code>${extensionFolderPath}</code>)</small>
            <input type="text" class="text_pole" id="st_iv_startup_src" value="${extension_settings[extensionName].startupSoundSrc}" placeholder="startup.mp3">
        </div>

        <hr>

        <h3>Idle (AFK) Settings</h3>
        <label class="checkbox_label">
            <input type="checkbox" id="st_iv_enable_idle" ${extension_settings[extensionName].enableIdle ? "checked" : ""}>
            Enable Idle Sound
        </label>
        <div>
            <small>Audio URL or Filename</small>
            <input type="text" class="text_pole" id="st_iv_idle_src" value="${extension_settings[extensionName].idleSoundSrc}" placeholder="idle.mp3">
        </div>
        <div>
            <small>Idle Timeout (Seconds)</small>
            <input type="number" class="text_pole" id="st_iv_timeout" value="${extension_settings[extensionName].idleTimeout}" min="5">
        </div>

        <hr>
        
        <div>
            <small>Volume (0.1 - 1.0)</small>
            <input type="number" class="text_pole" id="st_iv_volume" value="${extension_settings[extensionName].volume}" step="0.1" max="1" min="0">
        </div>
    </div>
    `;

    // 將 HTML 注入到擴充設定選單中
    $('#extensions_settings').append(settingsHtml);

    // 綁定事件監聽器以儲存設定
    $('#st_iv_enable_startup').on('change', function() {
        extension_settings[extensionName].enableStartup = $(this).is(':checked');
        saveSettingsDebounced();
    });

    $('#st_iv_startup_src').on('input', function() {
        extension_settings[extensionName].startupSoundSrc = $(this).val();
        saveSettingsDebounced();
    });

    $('#st_iv_enable_idle').on('change', function() {
        extension_settings[extensionName].enableIdle = $(this).is(':checked');
        resetIdleTimer(); // 設定改變時重置
        saveSettingsDebounced();
    });

    $('#st_iv_idle_src').on('input', function() {
        extension_settings[extensionName].idleSoundSrc = $(this).val();
        saveSettingsDebounced();
    });

    $('#st_iv_timeout').on('change', function() {
        extension_settings[extensionName].idleTimeout = parseInt($(this).val());
        resetIdleTimer(); // 時間改變時重置
        saveSettingsDebounced();
    });
    
    $('#st_iv_volume').on('change', function() {
        extension_settings[extensionName].volume = parseFloat($(this).val());
        saveSettingsDebounced();
    });
}

// ----------------------
// 初始化
// ----------------------

jQuery(async () => {
    loadSettings();
    renderSettings();
    setupIdleListeners();
    triggerStartupAction();
});