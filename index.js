import {
    extension_settings,
} from "../../../extensions.js";

// 修正點：saveSettingsDebounced 通常位於 script.js，路徑需要多往上一層
// 如果你的環境報錯找不到 script.js，請嘗試改成 "../../../script.js"
import {
    saveSettingsDebounced,
} from "../../../../script.js";

const extensionName = "Sillytavern_WelcomeIdleVoice";

// 自動抓取當前模組的路徑
const scriptUrl = import.meta.url; 
const extensionRootUrl = scriptUrl.substring(0, scriptUrl.lastIndexOf('/') + 1);

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
    console.log(`[${extensionName}] Settings loaded.`);
}

// 取得正確的音訊路徑
function getFullAudioUrl(src) {
    if (!src) return null;
    if (src.startsWith("http")) return src;
    const cleanPath = src.startsWith('/') ? src.slice(1) : src;
    return `${extensionRootUrl}${cleanPath}`;
}

// 播放邏輯
function playSound(src, isTest = false) {
    const fullUrl = getFullAudioUrl(src);
    if (!fullUrl) return;

    const vol = extension_settings[extensionName].volume ?? 0.5;
    console.log(`[${extensionName}] Attempting play: ${fullUrl} (Vol: ${vol})`);

    const audio = new Audio(fullUrl);
    audio.volume = vol;

    audio.play().then(() => {
        console.log(`[${extensionName}] Playing success.`);
    }).catch(e => {
        console.warn(`[${extensionName}] Play failed:`, e);
        if (isTest) alert(`播放失敗: ${e.message}\n請檢查 Console (F12) 獲取詳情`);
    });
}

// 閒置邏輯
function triggerIdleAction() {
    if (!extension_settings[extensionName].enableIdle) return;
    if (isIdle) return;

    isIdle = true;
    console.log(`[${extensionName}] Idle state triggered.`);
    playSound(extension_settings[extensionName].idleSoundSrc);
}

function resetIdleTimer() {
    if (isIdle) {
        isIdle = false;
    }
    if (idleTimer) clearTimeout(idleTimer);

    if (extension_settings[extensionName].enableIdle) {
        const timeoutSeconds = Math.max(5, extension_settings[extensionName].idleTimeout);
        idleTimer = setTimeout(triggerIdleAction, timeoutSeconds * 1000);
    }
}

function setupIdleListeners() {
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'click', 'scroll'];
    events.forEach(event => {
        document.addEventListener(event, resetIdleTimer, { passive: true });
    });
    resetIdleTimer();
}

// 啟動音效
function triggerStartupAction() {
    if (!extension_settings[extensionName].enableStartup) return;
    if (hasPlayedStartup) return;

    const playStartup = () => {
        if (hasPlayedStartup) return;
        console.log(`[${extensionName}] User interacted. Playing startup sound.`);
        playSound(extension_settings[extensionName].startupSoundSrc);
        hasPlayedStartup = true;
        
        ['click', 'keydown', 'touchstart'].forEach(e => document.removeEventListener(e, playStartup));
    };

    ['click', 'keydown', 'touchstart'].forEach(e => 
        document.addEventListener(e, playStartup, { once: true, passive: true })
    );
}

// UI 渲染
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
                
                <div class="flex-container">
                    <small>Timeout (Sec):</small>
                    <input type="number" class="text_pole" id="${extensionName}_timeout" value="${extension_settings[extensionName].idleTimeout}" min="5" style="width: 80px;">
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
    
    $(`#${extensionName}_test_startup`).click(() => playSound(extension_settings[extensionName].startupSoundSrc, true));
    $(`#${extensionName}_test_idle`).click(() => playSound(extension_settings[extensionName].idleSoundSrc, true));
}

// 摺疊選單事件
$(document).on('click', `#${extensionName}_settings .inline-drawer-toggle`, function() {
    const icon = $(this).find('.inline-drawer-icon');
    const content = $(this).next('.inline-drawer-content');
    content.slideToggle(200);
    icon.toggleClass('down up');
});

// 初始化
jQuery(async () => {
    try {
        console.log(`[${extensionName}] Initializing...`);
        loadSettings();
        setupIdleListeners();
        triggerStartupAction();
        renderSettings();
    } catch (e) {
        console.error(`[${extensionName}] Fatal Error:`, e);
    }
});
