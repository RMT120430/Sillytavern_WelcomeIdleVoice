import {
    extension_settings,
    saveSettingsDebounced,
} from "../../../extensions.js";

const extensionName = "Sillytavern_WelcomeIdleVoice";
const extensionFolderPath = `extensions/${extensionName}/`;

// 預設設定
const defaultSettings = {
    enableStartup: true,
    startupSoundSrc: "audio/welcome.wav", // 預設路徑建議指引到 audio 資料夾
    enableIdle: true,
    idleSoundSrc: "audio/idle.wav",
    idleTimeout: 60,
    volume: 0.5
};

let idleTimer = null;
let isIdle = false;

// 載入設定
function loadSettings() {
    // 如果設定檔中沒有這個插件的紀錄，初始化它
    if (!extension_settings[extensionName]) {
        extension_settings[extensionName] = {};
    }
    // 補齊缺失的預設值
    for (const key in defaultSettings) {
        if (!Object.hasOwn(extension_settings[extensionName], key)) {
            extension_settings[extensionName][key] = defaultSettings[key];
        }
    }
}

// 撥放邏輯
function playSound(src) {
    if (!src) return;
    
    // 判斷路徑：如果是 http 開頭或是絕對路徑則不變，否則加上插件路徑
    let finalSrc = src;
    if (!src.startsWith("http") && !src.startsWith("/") && !src.startsWith("file")) {
        // 這樣使用者只需要填 "audio/xxx.wav"
        finalSrc = extensionFolderPath + src;
    }

    const audio = new Audio(finalSrc);
    audio.volume = extension_settings[extensionName].volume || 0.5;
    
    audio.play().catch(e => {
        console.warn(`[${extensionName}] Autoplay blocked or file not found: - index.js:51`, e);
    });
}

// 閒置邏輯
function triggerIdleAction() {
    if (!extension_settings[extensionName].enableIdle) return;
    if (isIdle) return; 

    isIdle = true;
    console.log(`[${extensionName}] Idle state detected. - index.js:61`);
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

function triggerStartupAction() {
    if (!extension_settings[extensionName].enableStartup) return;
    setTimeout(() => {
        console.log(`[${extensionName}] Startup sound triggered. - index.js:86`);
        playSound(extension_settings[extensionName].startupSoundSrc);
    }, 1500); // 稍微延後一點點以免瀏覽器還沒準備好
}

// ----------------------
// UI 渲染 (修復重點)
// ----------------------
function renderSettings() {
    // 產生 HTML ID，確保唯一性
    const settingsContainerId = `${extensionName}_settings`;
    
    // 如果已經渲染過，先移除舊的 (避免重複)
    $(`#${settingsContainerId}`).remove();

    const settingsHtml = `
    <div id="${settingsContainerId}" class="settings_content">
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>Welcome & Idle Voice</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
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
                    <small>Volume (0.1 - 1.0)</small>
                    <input type="number" class="text_pole" id="${extensionName}_volume" value="${extension_settings[extensionName].volume}" step="0.1" max="1" min="0">
                </div>
                <div style="margin-top: 10px;">
                    <small><i>Place your audio files in: <b>/public/extensions/${extensionName}/audio/</b></i></small>
                </div>
            </div>
        </div>
    </div>
    `;

    // 將設定介面插入 SillyTavern 的擴充設定區塊
    $('#extensions_settings').append(settingsHtml);

    // 綁定事件 (jQuery)
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
        extension_settings[extensionName].idleTimeout = parseInt($(this).val());
        resetIdleTimer();
        saveSettingsDebounced();
    });
    
    $(`#${extensionName}_volume`).on('change', function() {
        extension_settings[extensionName].volume = parseFloat($(this).val());
        saveSettingsDebounced();
    });
}

// 監聽 SillyTavern 初始化完成
jQuery(async () => {
    try {
        loadSettings();
        renderSettings();
        setupIdleListeners();
        triggerStartupAction();
        console.log(`[${extensionName}] Loaded successfully. - index.js:195`);
    } catch (e) {
        console.error(`[${extensionName}] Error loading: - index.js:197`, e);
    }
});
