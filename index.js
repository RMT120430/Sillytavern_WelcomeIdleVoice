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

// 取得完整路徑
function getFullAudioUrl(src) {
    if (!src) return null;
    if (src.startsWith("http")) return src;
    const cleanPath = src.startsWith('/') ? src.slice(1) : src;
    return `${extensionRootUrl}${cleanPath}`;
}

/**
 * 核心播放函式
 * @param {string} src - 音檔路徑
 * @param {boolean} isTest - 是否為測試按鈕觸發
 * @param {boolean} forceSync - (新功能) 是否強制同步播放 (用於啟動音效)
 */
function playSound(src, isTest = false, forceSync = false) {
    const fullUrl = getFullAudioUrl(src);
    if (!fullUrl) return;

    const vol = extension_settings[extensionName].volume ?? 0.9;

    // 關鍵修正：如果是啟動音效，我們不使用任何非同步邏輯，直接建立並播放
    // 這樣瀏覽器才會將其視為「使用者行為的一部分」
    const audio = new Audio(fullUrl);
    audio.volume = vol;

    const playPromise = audio.play();

    if (playPromise !== undefined) {
        playPromise.then(() => {
            console.log(`[${extensionName}] Playing: ${src} - index.js:68`);
        }).catch(error => {
            console.warn(`[${extensionName}] Play failed: - index.js:70`, error);
            if (isTest) {
                alert(`播放失敗: ${error.message}\n(請確認檔案格式正確，且瀏覽器允許聲音播放)`);
            }
        });
    }
}

// --- 閒置邏輯 ---
function triggerIdleAction() {
    if (!extension_settings[extensionName].enableIdle) return;
    if (isIdle) return;

    isIdle = true;
    console.log(`[${extensionName}] Idle triggered. - index.js:84`);
    playSound(extension_settings[extensionName].idleSoundSrc);
}

function resetIdleTimer() {
    if (isIdle) isIdle = false;
    if (idleTimer) clearTimeout(idleTimer);

    if (extension_settings[extensionName].enableIdle) {
        // 確保至少 60 秒
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

// --- 啟動音效 (最終修正版：即時建立策略) ---
function triggerStartupAction() {
    if (!extension_settings[extensionName].enableStartup) return;
    if (hasPlayedStartup) return;

    // 定義強制的互動監聽器
    const forcePlay = (e) => {
        if (hasPlayedStartup) return;
        
        // 這裡非常重要：
        // 我們不讀取任何外部變數，不在這裡做複雜的 console.log，也不使用預載物件。
        // 直接讀取設定 -> 建立 Audio -> Play
        // 這能最大程度騙過瀏覽器，讓它認為這是按鈕的點擊音效
        const src = extension_settings[extensionName].startupSoundSrc;
        const vol = extension_settings[extensionName].volume ?? 0.9;
        const url = getFullAudioUrl(src);
        
        if (url) {
            const tempAudio = new Audio(url);
            tempAudio.volume = vol;
            tempAudio.play().then(() => {
                console.log(`[${extensionName}] Startup sound success. - index.js:130`);
            }).catch(err => {
                console.warn(`[${extensionName}] Startup blocked by browser: - index.js:132`, err);
            });
        }
        
        hasPlayedStartup = true;

        // 移除所有監聽
        ['mousedown', 'keydown', 'touchstart', 'click'].forEach(evt => 
            document.removeEventListener(evt, forcePlay, { capture: true })
        );
    };

    // 監聽所有可能的互動，使用 capture: true 確保優先權
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
                <div style="margin-bottom: 5px;">
                    <small><i>Note: Plays on first click/interaction due to browser policy.</i></small>
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

    // Idle Timeout Apply
    $(`#${extensionName}_timeout_apply`).on('click', function(e) {
        e.stopPropagation();
        const inputElem = $(`#${extensionName}_timeout_input`);
        let val = parseInt(inputElem.val());
        
        if (isNaN(val) || val < 60) {
            val = 60;
        }

        inputElem.val(val);
        extension_settings[extensionName].idleTimeout = val;
        saveSettingsDebounced();
        resetIdleTimer();

        const btn = $(this);
        const originalText = btn.text();
        btn.text("Saved!");
        setTimeout(() => btn.text(originalText), 1500);
    });

    // Tests
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
        setupIdleListeners();
        triggerStartupAction();
        renderSettings();
        console.log(`[${extensionName}] Ready. Waiting for interaction to play startup sound. - index.js:290`);
    } catch (e) {
        console.error(`[${extensionName}] Error: - index.js:292`, e);
    }
});
