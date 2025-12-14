import {
    extension_settings,
} from "../../../extensions.js";

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
    idleSoundSrc1: "audio/idle1.wav",
    idleSoundSrc2: "audio/idle2.wav",
    idleSoundSrc3: "audio/idle3.wav",
    idleTimeout: 60,
    volume: 0.9
};

let audioCtx = null;
let startupBuffer = null;
let hasPlayedStartup = false;
let isContextUnlocked = false;

function getAudioContext() {
    if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
    }
    return audioCtx;
}

async function loadAudioBuffer(url) {
    const ctx = getAudioContext();
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        return await ctx.decodeAudioData(arrayBuffer);
    } catch (e) {
        console.warn(`[${extensionName}] Load failed: ${url}  index.js:43 - index_v2.js:45`, e);
        return null;
    }
}

async function playSound(srcOrBuffer, isTest = false) {
    const ctx = getAudioContext();

    if (ctx.state === 'suspended') {
        try { await ctx.resume(); } catch (e) { /* Ignore and wait for user interaction. */ }
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

    if (isTest) console.log(`[${extensionName}] Test sound played.  index.js:75 - index_v2.js:77`);
}

function attachGlobalUnlockListener() {
    const events = ['click', 'keydown', 'touchstart', 'mousedown'];
    
    const unlockHandler = () => {
        const ctx = getAudioContext();
        
        if (ctx.state === 'suspended') {
            ctx.resume().then(() => {
                console.log(`[${extensionName}] Audio Engine Unlocked via user gesture!  index.js:86 - index_v2.js:88`);
                isContextUnlocked = true;
                
                if (extension_settings[extensionName]?.enableStartup && startupBuffer && !hasPlayedStartup) {
                    console.log(`[${extensionName}] Buffer ready + Engine unlocked. Playing NOW.  index.js:90 - index_v2.js:92`);
                    playSound(startupBuffer);
                    hasPlayedStartup = true;
                }
            });
        } else {
            isContextUnlocked = true;
        }
        
        if (ctx.state === 'running') {
            events.forEach(evt => window.removeEventListener(evt, unlockHandler, { capture: true }));
        }
    };

    events.forEach(evt => window.addEventListener(evt, unlockHandler, { capture: true }));
}

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

async function preloadStartup() {
    if (!extension_settings[extensionName].enableStartup) return;
    const url = getFullAudioUrl(extension_settings[extensionName].startupSoundSrc);
    if (url) {
        console.log(`[${extensionName}] Downloading startup sound...  index.js:129 - index_v2.js:131`);
        startupBuffer = await loadAudioBuffer(url);
        
        const ctx = getAudioContext();
        if (ctx.state === 'running' && !hasPlayedStartup && isContextUnlocked) {
            console.log(`[${extensionName}] Download finished after unlock. Playing NOW.  index.js:134 - index_v2.js:136`);
            playSound(startupBuffer);
            hasPlayedStartup = true;
        }
    }
}

let idleTimer = null;
let isIdle = false;

function triggerIdleAction() {
    if (!extension_settings[extensionName].enableIdle) return;
    if (isIdle) return;
    
    const ctx = getAudioContext();
    if (ctx.state === 'running') {
        isIdle = true;
        
        const settings = extension_settings[extensionName];
        
        const availableSources = [
            settings.idleSoundSrc1,
            settings.idleSoundSrc2,
            settings.idleSoundSrc3
        ].filter(src => src && src.trim().length > 0);

        if (availableSources.length === 0) {
            console.log(`[${extensionName}] Idle triggered but no sound sources set. - index_v2.js:163`);
            return;
        }

        const randomSrc = availableSources[Math.floor(Math.random() * availableSources.length)];

        console.log(`[${extensionName}] Idle triggered. Playing: ${randomSrc} - index_v2.js:169`);
        playSound(randomSrc);
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
                        Enable Idle Sound (Random 1 of 3)
                    </label>
                </div>
                
                <div class="flex-container">
                    <small style="min-width: 20px;">1.</small>
                    <input type="text" class="text_pole" id="${extensionName}_idle_src1" value="${extension_settings[extensionName].idleSoundSrc1}" placeholder="audio/idle1.wav" style="flex:1;">
                    <div id="${extensionName}_test_idle1" class="menu_button">Test</div>
                </div>
                
                <div class="flex-container" style="margin-top: 5px;">
                    <small style="min-width: 20px;">2.</small>
                    <input type="text" class="text_pole" id="${extensionName}_idle_src2" value="${extension_settings[extensionName].idleSoundSrc2}" placeholder="audio/idle2.wav" style="flex:1;">
                    <div id="${extensionName}_test_idle2" class="menu_button">Test</div>
                </div>
                
                <div class="flex-container" style="margin-top: 5px;">
                    <small style="min-width: 20px;">3.</small>
                    <input type="text" class="text_pole" id="${extensionName}_idle_src3" value="${extension_settings[extensionName].idleSoundSrc3}" placeholder="audio/idle3.wav" style="flex:1;">
                    <div id="${extensionName}_test_idle3" class="menu_button">Test</div>
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
        hasPlayedStartup = false;
        preloadStartup();
    });

    $(`#${extensionName}_enable_idle`).on('change', function() {
        extension_settings[extensionName].enableIdle = $(this).is(':checked');
        resetIdleTimer();
        saveSettingsDebounced();
    });

    $(`#${extensionName}_idle_src1`).on('input', function() {
        extension_settings[extensionName].idleSoundSrc1 = $(this).val();
        saveSettingsDebounced();
    });
    $(`#${extensionName}_idle_src2`).on('input', function() {
        extension_settings[extensionName].idleSoundSrc2 = $(this).val();
        saveSettingsDebounced();
    });
    $(`#${extensionName}_idle_src3`).on('input', function() {
        extension_settings[extensionName].idleSoundSrc3 = $(this).val();
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

    $(`#${extensionName}_test_idle1`).on('click', (e) => {
        e.stopPropagation();
        playSound(extension_settings[extensionName].idleSoundSrc1, true);
    });
    $(`#${extensionName}_test_idle2`).on('click', (e) => {
        e.stopPropagation();
        playSound(extension_settings[extensionName].idleSoundSrc2, true);
    });
    $(`#${extensionName}_test_idle3`).on('click', (e) => {
        e.stopPropagation();
        playSound(extension_settings[extensionName].idleSoundSrc3, true);
    });
}

attachGlobalUnlockListener();

jQuery(async () => {
    try {
        loadSettings();
        await preloadStartup();
        setupIdleListeners();
        renderSettings();
        console.log(`[${extensionName}] Ready.  index.js:294 - index_v2.js:348`);
    } catch (e) {
        console.error(`[${extensionName}] Error:  index.js:296 - index_v2.js:350`, e);
    }
});
