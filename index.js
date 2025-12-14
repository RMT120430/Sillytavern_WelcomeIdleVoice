import {
    extension_settings,
    saveSettingsDebounced,
} from "../../../extensions.js";

const extensionName = "Sillytavern_WelcomeIdleVoice";
// 自動抓取當前模組的路徑，比硬編碼更安全
const extensionFolderPath = `extensions/${extensionName}/`;

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

// 取得正確的音訊路徑
function getAudioUrl(src) {
    if (!src) return null;
    if (src.startsWith("http") || src.startsWith("/")) {
        return src;
    }
    // 確保路徑拼接正確
    return `${extensionFolderPath}${src}`;
}

// 核心播放邏輯
function playSound(src, isTest = false) {
    const finalSrc = getAudioUrl(src);
    if (!finalSrc) return;

    // 取得當前設定的音量
    const vol = extension_settings[extensionName].volume ?? 0.5;

    console.log(`[${extensionName}] Playing: ${finalSrc} (Vol: ${vol})`);

    const audio = new Audio(finalSrc);
    audio.volume = vol;

    const playPromise = audio.play();

    if (playPromise !== undefined) {
        playPromise.catch(error => {
            console.warn(`[${extensionName}] Playback failed:`, error);
            if (!isTest && error.name === 'NotAllowedError') {
                console.warn(`[${extensionName}] Browser Autoplay Policy blocked the sound. Waiting for interaction.`);
            }
        });
    }
}

// --- 閒置檢測邏輯 ---

function triggerIdleAction() {
    if (!extension_settings[extensionName].enableIdle) return;
    if (isIdle) return; // 已經在閒置中就不重複觸發

    isIdle = true;
    console.log(`[${extensionName}] Idle timeout reached. Playing idle sound.`);
    playSound(extension_settings[extensionName].idleSoundSrc);
}

function resetIdleTimer() {
    // 如果從閒置狀態恢復
    if (isIdle) {
        isIdle = false;
        console.log(`[${extensionName}] User active. Idle state reset.`);
    }

    if (idleTimer) clearTimeout(idleTimer);

    if (extension_settings[extensionName].enableIdle) {
        const timeInMs = Math.max(5, extension_settings[extensionName].idleTimeout) * 1000;
        idleTimer = setTimeout(triggerIdleAction, timeInMs);
    }
}

function setupIdleListeners() {
    // 監聽常見的使用者互動
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    
    // 使用 passive: true 優化效能
    events.forEach(event => {
        document.addEventListener(event, resetIdleTimer, { passive: true });
    });
    
    // 初始化計時器
    resetIdleTimer();
}

// --- 啟動音效邏輯 (處理 Autoplay) ---

function triggerStartupAction() {
    if (!extension_settings[extensionName].enableStartup) return;
    if (hasPlayedStartup) return;

    // 定義互動處理函數
    const attemptPlay = () => {
        if (hasPlayedStartup) return;
        
        console.log(`[${extensionName}] User interaction detected. Playing startup sound.`);
        playSound(extension_settings[extensionName].startupSoundSrc);
        hasPlayedStartup = true;

        // 移除監聽器
        ['click', 'keydown', 'touchstart'].forEach(evt => 
            document.removeEventListener(evt, attemptPlay)
        );
    };

    // 由於瀏覽器限制，我們通常無法在頁面載入當下直接播放
    // 我們掛載一個 "一次性" 的監聽器在 document 上
    // 只要使用者點擊任意位置，就會觸發播放
    ['click', 'keydown', 'touchstart'].forEach(evt => 
        document.addEventListener(evt, attemptPlay, { once: true, passive: true })
    );
}

// --- UI 渲染 ---

function renderSettings() {
    const settingsContainerId = `${extensionName}_settings`;
    // 先移除舊的，避免重複
    $(`#${settingsContainerId}`).remove();

    // 建立 HTML。這裡使用了 SillyTavern 標準的 CSS class
    // .inline-drawer 負責外框
    // .inline-drawer-toggle 負責標題與點擊區域
    // .inline-drawer-content 負責內容
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
                
                <div class="flex-container">
                    <small style="flex:1;">Startup Audio Path (relative to extension folder)</small>
                    <div style="display:flex; gap:5px; width:100%;">
                        <input type="text" class="text_pole" id="${extensionName}_startup_src" value="${extension_settings[extensionName].startupSoundSrc}" placeholder="audio/welcome.wav" style="flex:2;">
                        <div id="${extensionName}_test_startup" class="menu_button" style="width: auto;">Test</div>
                    </div>
                </div>

                <hr>

                <div class="flex-container">
                    <label class="checkbox_label">
                        <input type="checkbox" id="${extensionName}_enable_idle" ${extension_settings[extensionName].enableIdle ? "checked" : ""}>
                        Enable Idle Sound
                    </label>
                </div>

                <div class="flex-container">
                    <small style="flex:1;">Idle Audio Path</small>
                    <div style="display:flex; gap:5px; width:100%;">
                        <input type="text" class="text_pole" id="${extensionName}_idle_src" value="${extension_settings[extensionName].idleSoundSrc}" placeholder="audio/idle.wav" style="flex:2;">
                        <div id="${extensionName}_test_idle" class="menu_button" style="width: auto;">Test</div>
                    </div>
                </div>

                <div class="flex-container">
                    <small>Idle Timeout (Seconds)</small>
                    <input type="number" class="text_pole" id="${extensionName}_timeout" value="${extension_settings[extensionName].idleTimeout}" min="5">
                </div>

                <hr>
                
                <div class="flex-container">
                    <small>Volume (0.0 - 1.0)</small>
                    <input type="number" class="text_pole" id="${extensionName}_volume" value="${extension_settings[extensionName].volume}" step="0.1" max="1" min="0">
                </div>
                
                <div style="margin-top: 10px; opacity: 0.7;">
                    <small><i>Files location: /SillyTavern/${extensionFolderPath}audio/</i></small>
                </div>
            </div>
        </div>
    </div>
    `;

    // 將設定插入到 Extensions 選單中
    $('#extensions_settings').append(settingsHtml);

    // --- 事件綁定 ---
    
    // 綁定輸入框變更
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

    // 測試按鈕功能
    $(`#${extensionName}_test_startup`).on('click', function() {
        playSound(extension_settings[extensionName].startupSoundSrc, true);
    });

    $(`#${extensionName}_test_idle`).on('click', function() {
        playSound(extension_settings[extensionName].idleSoundSrc, true);
    });
}

// 全域事件委派：處理摺疊選單 (Drawer) 的開關
// 這是解決 UI 無法點開的關鍵，因為我們是動態插入 HTML
$(document).on('click', `#${extensionName}_settings .inline-drawer-toggle`, function() {
    const icon = $(this).find('.inline-drawer-icon');
    const content = $(this).next('.inline-drawer-content');
    
    content.slideToggle(200);
    icon.toggleClass('down up');
});

// 初始化
jQuery(async () => {
    try {
        loadSettings();
        renderSettings();
        setupIdleListeners();
        triggerStartupAction(); // 註冊啟動音效等待使用者點擊
        console.log(`[${extensionName}] Loaded successfully.`);
    } catch (e) {
        console.error(`[${extensionName}] Error loading:`, e);
    }
});
