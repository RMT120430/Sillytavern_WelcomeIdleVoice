import {
    extension_settings,
} from "../../../extensions.js";

// 引用 ST 主程式的存檔函數
import {
    saveSettingsDebounced,
} from "../../../../script.js";

const extensionName = "Sillytavern_WelcomeIdleVoice";
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

// 播放核心 (優化版)
function playSound(src, isTest = false) {
    const fullUrl = getFullAudioUrl(src);
    if (!fullUrl) return;

    const vol = extension_settings[extensionName].volume ?? 0.5;
    const audio = new Audio(fullUrl);
    audio.volume = vol;

    const playPromise = audio.play();

    if (playPromise !== undefined) {
        playPromise.catch(error => {
            console.warn(`[${extensionName}] Play failed:`, error);
            // 如果不是測試，且是被瀏覽器阻擋，我們不彈窗干擾使用者，只在背景記錄
            if (isTest) {
                alert(`播放失敗 (Play failed): ${error.message}`);
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

// --- 啟動音效 (強制互動版) ---
function triggerStartupAction() {
    if (!extension_settings[extensionName].enableStartup) return;
    if (hasPlayedStartup) return;

    // 定義一個強制的點擊監聽器
    const forcePlay = () => {
        if (hasPlayedStartup) return;
        
        console.log(`[${extensionName}] User clicked. Playing startup sound NOW.`);
        playSound(extension_settings[extensionName].startupSoundSrc);
        hasPlayedStartup = true;

        // 移除監聽
        ['click', 'keydown', 'touchstart'].forEach(e => 
            document.removeEventListener(e, forcePlay)
        );
    };

    // 監聽 document 上的任意點擊，這通常是瀏覽器最認可的「互動」
    ['click', 'keydown', 'touchstart'].forEach(e => 
        document.addEventListener(e, forcePlay, { once: true, capture: true }) 
        // capture: true 確保我們比其他腳本更早抓到事件
    );
}

// --- UI 渲染 (修復展開問題) ---
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
            <!-- 給 Toggle 一個明確的 ID 以便綁定 -->
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

    // --- 關鍵修復：直接綁定點擊事件，不使用 document 委派 ---
    // 這樣可以確保點擊一定會觸發，不會被其他層級吃掉
    $(`#${extensionName}_toggle`).on('click', function(e) {
        // 阻止事件冒泡，避免 ST 其他腳本干擾 (如果有的話)
        e.stopPropagation();
        
        const icon = $(this).find('.inline-drawer-icon');
        const content = $(this).next('.inline-drawer-content');
        
        // 使用 jQuery 動畫切換
        content.slideToggle(200);
        
        // 切換圖示方向
        if (icon.hasClass('down')) {
            icon.removeClass('down').addClass('up');
        } else {
            icon.removeClass('up').addClass('down');
        }
    });

    // 設定值綁定
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
    
    // 測試按鈕
    $(`#${extensionName}_test_startup`).on('click', (e) => {
        e.stopPropagation(); // 防止測試按鈕觸發摺疊
        playSound(extension_settings[extensionName].startupSoundSrc, true);
    });
    $(`#${extensionName}_test_idle`).on('click', (e) => {
        e.stopPropagation();
        playSound(extension_settings[extensionName].idleSoundSrc, true);
    });

    console.log(`[${extensionName}] UI Rendered & Events Bound.`);
}

// 初始化
jQuery(async () => {
    try {
        loadSettings();
        setupIdleListeners();
        triggerStartupAction();
        renderSettings();
    } catch (e) {
        console.error(`[${extensionName}] Error:`, e);
    }
});
