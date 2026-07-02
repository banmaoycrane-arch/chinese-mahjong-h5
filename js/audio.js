/* global */
(function () {
'use strict';

const STORAGE_BGM = 'mahjong_bgm_on';
const STORAGE_VOICE = 'mahjong_voice_on';
const STORAGE_SFX = 'mahjong_sfx_on';

/**
 * 流程语音与音效配置 — 可按需修改文案和时长
 * delay: 该步骤停留毫秒数（等语音播完）
 */
const FLOW_CONFIG = {
  game_start: { voice: '游戏开始', sfx: 'gameStart', delay: 1400, label: '游戏开始', icon: '🎮' },
  new_round:  { voice: '新一局',   sfx: 'round',     delay: 1200, label: '新一局',   icon: '🔄' },
  dice_wall:  { voice: '掷色子，定牌墙', sfx: 'dice', delay: 2800, label: '第一次掷色子', icon: '🎲',
    voiceFn: (d) => {
      if (!d.roll) return '定牌墙';
      const sum = d.roll.sum;
      const dealer = d.dealer != null ? d.dealer : 0;
      const wallSeat = (dealer + (sum - 1) % 4) % 4;
      const winds = ['东', '南', '西', '北'];
      return sum + '点，从' + winds[wallSeat] + '家牌墙起数';
    } },
  dice_break: { voice: '再掷色子，定起抓墩', sfx: 'dice', delay: 2800, label: '第二次掷色子', icon: '🎲',
    voiceFn: (d) => {
      if (!d.breakInfo) return '定起抓墩';
      const b = d.breakInfo;
      return b.breakSum + '点，' + b.wallSeatName + '家墙右端第' + b.stackFromRight + '墩起抓';
    } },
  shuffle:    { voice: '洗牌',     sfx: 'shuffle',   delay: 1800, label: '洗牌中…',  icon: '🀄' },
  deal:       { voice: '发牌',     sfx: 'deal',      delay: 1600, label: '发牌中…',  icon: '🃏' },
  dealer:     { voice: null,       sfx: 'dealer',    delay: 1400, label: '定庄',     icon: '👑',
    voiceFn: (d) => (d.dealerName || '庄家') + '坐庄' },
  ready:      { voice: '准备出牌', sfx: 'ready',     delay: 900,  label: '准备就绪', icon: '✅' },
};

/** 对局动作语音配置 */
const ACTION_CONFIG = {
  select:   { sfx: 'click' },
  draw:     { voice: '摸牌', sfx: 'draw' },
  discard:  { voice: null, voiceFn: (d) => d.tileLabel, sfx: 'discard' },
  peng:     { voice: '碰', sfx: 'peng' },
  gang:     { voice: '杠', sfx: 'gang' },
  gang_dice:{ voice: '杠牌补花，掷色子', sfx: 'dice',
    voiceFn: (d) => d.roll ? d.roll.sum + '点，从牌尾补牌' : '从牌尾补牌' },
  angang:   { voice: '暗杠', sfx: 'gang' },
  bugang:   { voice: '补杠', sfx: 'gang' },
  chi:      { voice: '吃', sfx: 'chi' },
  hu:       { voice: null, voiceFn: (d) => d.isZimo ? '胡了，自摸' : '胡了', sfx: 'hu', extraVoice: (d) => d.fan ? d.fan + '番' : null },
  zimo:     { voice: '自摸', sfx: 'zimo', extraVoice: (d) => d.fan ? d.fan + '番' : null },
  pass:     { voice: '过', sfx: 'pass' },
  liuju:    { voice: '流局', sfx: 'liuju' },
  your_turn:{ voice: '请出牌', sfx: 'ready' },
};

function createMahjongAudio() {
  let ctx = null;
  let masterGain = null;
  let bgmPlaying = false;
  let timerId = null;
  let step = 0;

  let bgmEnabled = loadBool(STORAGE_BGM, true);
  let voiceEnabled = loadBool(STORAGE_VOICE, true);
  let sfxEnabled = loadBool(STORAGE_SFX, true);

  const voiceQueue = [];
  let voiceBusy = false;
  let voicesReady = false;

  const PENTATONIC = [261.63, 293.66, 329.63, 392.0, 440.0];
  const MELODY = [0, 2, 4, 2, 3, 1, 0, null,  2, 4, 3, 2, 0, 1, 2, null];
  const BASS   = [0, 0, null, null, 2, 2, 0, 0,  0, 2, null, 2, 0, 0, 2, 0];
  const TEMPO = 88;

  function loadBool(key, def) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? def : v === '1';
    } catch (e) { return def; }
  }

  function saveBool(key, val) {
    try { localStorage.setItem(key, val ? '1' : '0'); } catch (e) { /* ignore */ }
  }

  function ensureContext() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.18;
      masterGain.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  function playTone(freq, start, dur, type, vol, forBgm) {
    if (!ctx || !freq || freq <= 0) return;
    if (forBgm) { if (!bgmEnabled) return; }
    else if (!sfxEnabled) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(start);
    osc.stop(start + dur + 0.04);
  }

  function initVoices() {
    if (!window.speechSynthesis || voicesReady) return;
    const pick = () => { voicesReady = true; };
    speechSynthesis.getVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = pick;
    }
    setTimeout(pick, 200);
  }

  function getZhVoice() {
    if (!window.speechSynthesis) return null;
    const list = speechSynthesis.getVoices();
    return list.find((v) => v.lang === 'zh-CN')
      || list.find((v) => v.lang && v.lang.indexOf('zh') === 0)
      || null;
  }

  function speak(text, delayMs) {
    if (!voiceEnabled || !text || !window.speechSynthesis) return;
    if (delayMs) {
      setTimeout(() => speak(text), delayMs);
      return;
    }
    voiceQueue.push(String(text));
    drainVoice();
  }

  function drainVoice() {
    if (voiceBusy || !voiceQueue.length) return;
    voiceBusy = true;
    const text = voiceQueue.shift();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN';
    u.rate = 1.05;
    u.pitch = 1.05;
    const voice = getZhVoice();
    if (voice) u.voice = voice;
    u.onend = () => { voiceBusy = false; drainVoice(); };
    u.onerror = () => { voiceBusy = false; drainVoice(); };
    try { speechSynthesis.speak(u); } catch (e) { voiceBusy = false; }
  }

  function bgmTick() {
    if (!bgmPlaying || !ctx) return;
    const beatDur = 60 / TEMPO;
    const t = ctx.currentTime + 0.04;
    const idx = step % MELODY.length;
    const mel = MELODY[idx];
    if (mel !== null && PENTATONIC[mel]) {
      playTone(PENTATONIC[mel], t, beatDur * 0.9, 'triangle', 0.22, true);
    }
    const b = BASS[idx];
    if (b !== null && PENTATONIC[b]) {
      playTone(PENTATONIC[b] * 0.5, t, beatDur * 0.95, 'sine', 0.12, true);
    }
    step++;
    timerId = setTimeout(bgmTick, beatDur * 1000);
  }

  function startBGM() {
    ensureContext();
    initVoices();
    if (bgmPlaying || !bgmEnabled) return;
    bgmPlaying = true;
    step = 0;
    bgmTick();
  }

  function stopBGM() {
    bgmPlaying = false;
    if (timerId) clearTimeout(timerId);
  }

  function playSFX(type) {
    if (!sfxEnabled) return;
    ensureContext();
    const t = ctx.currentTime;

    if (type === 'click') {
      playTone(660, t, 0.05, 'sine', 0.08);
    } else if (type === 'gameStart') {
      [392, 523, 659, 784].forEach((f, i) => playTone(f, t + i * 0.14, 0.22, 'triangle', 0.14));
    } else if (type === 'dice') {
      for (let i = 0; i < 18; i++) {
        playTone(220 + Math.random() * 280, t + i * 0.045, 0.028, 'square', 0.08);
      }
      playTone(480, t + 0.85, 0.07, 'triangle', 0.13);
      playTone(580, t + 0.93, 0.07, 'triangle', 0.13);
    } else if (type === 'shuffle') {
      for (let i = 0; i < 12; i++) {
        playTone(180 + Math.random() * 120, t + i * 0.07, 0.035, 'square', 0.07);
      }
    } else if (type === 'deal') {
      for (let i = 0; i < 8; i++) {
        playTone(380 + i * 35, t + i * 0.09, 0.05, 'triangle', 0.08);
      }
    } else if (type === 'dealer') {
      playTone(440, t, 0.15, 'triangle', 0.12);
      playTone(554, t + 0.12, 0.2, 'triangle', 0.14);
      playTone(659, t + 0.24, 0.25, 'triangle', 0.12);
    } else if (type === 'ready') {
      playTone(523, t, 0.1, 'sine', 0.1);
      playTone(659, t + 0.1, 0.15, 'sine', 0.1);
    } else if (type === 'discard') {
      playTone(420, t, 0.06, 'square', 0.14);
      playTone(280, t + 0.03, 0.1, 'triangle', 0.1);
    } else if (type === 'draw') {
      playTone(520, t, 0.05, 'sine', 0.07);
      playTone(780, t + 0.04, 0.06, 'sine', 0.05);
    } else if (type === 'peng') {
      [330, 440, 550].forEach((f, i) => playTone(f, t + i * 0.06, 0.1, 'square', 0.13));
    } else if (type === 'gang') {
      [220, 330, 440, 550].forEach((f, i) => playTone(f, t + i * 0.07, 0.12, 'square', 0.13));
    } else if (type === 'chi') {
      playTone(494, t, 0.07, 'triangle', 0.11);
      playTone(587, t + 0.06, 0.09, 'triangle', 0.1);
    } else if (type === 'hu') {
      [523, 659, 784, 988, 1175].forEach((f, i) => playTone(f, t + i * 0.1, 0.28, 'triangle', 0.16));
    } else if (type === 'zimo') {
      [392, 523, 659, 784, 988, 1175].forEach((f, i) => playTone(f, t + i * 0.11, 0.32, 'triangle', 0.17));
    } else if (type === 'pass') {
      playTone(360, t, 0.12, 'sine', 0.06);
    } else if (type === 'liuju') {
      playTone(220, t, 0.35, 'sine', 0.1);
    } else if (type === 'round') {
      [440, 554, 659].forEach((f, i) => playTone(f, t + i * 0.12, 0.2, 'triangle', 0.1));
    }
  }

  function playConfig(cfg, data) {
    if (!cfg) return;
    if (cfg.sfx) playSFX(cfg.sfx);
    if (cfg.voice) speak(cfg.voice);
    else if (cfg.voiceFn && data) {
      const v = cfg.voiceFn(data);
      if (v) speak(v);
    }
    if (cfg.extraVoice && data) {
      const extra = cfg.extraVoice(data);
      if (extra) speak(extra, 650);
    }
  }

  function getFlowInfo(step) {
    return FLOW_CONFIG[step] || { label: step, icon: '🀄', delay: 800 };
  }

  /** 按顺序播放开局流程 */
  function runFlowSequence(steps, callbacks) {
    callbacks = callbacks || {};
    let idx = 0;

    function runNext() {
      if (idx >= steps.length) {
        if (callbacks.onComplete) callbacks.onComplete();
        return;
      }
      const item = steps[idx++];
      const step = item.step || item;
      const data = item.data || {};
      const cfg = FLOW_CONFIG[step];

      if (callbacks.onStep) callbacks.onStep(step, data, cfg);

      if (cfg) {
        const isDiceStep = step === 'dice_wall' || step === 'dice_break';
        if (isDiceStep && cfg.voice) speak(cfg.voice);
        playSFX(cfg.sfx);
        if (!isDiceStep && cfg.voice) speak(cfg.voice);
        else if (cfg.voiceFn && data) {
          const v = cfg.voiceFn(data);
          if (v) setTimeout(() => speak(v), isDiceStep ? 900 : 0);
        }
        setTimeout(runNext, cfg.delay || 900);
      } else {
        runNext();
      }
    }
    runNext();
  }

  function onGameEvent(event, data) {
    data = data || {};
    const cfg = ACTION_CONFIG[event];
    if (cfg) {
      playConfig(cfg, data);
      return;
    }
    if (FLOW_CONFIG[event]) {
      playConfig(FLOW_CONFIG[event], data);
    }
  }

  return {
    FLOW_CONFIG,
    ACTION_CONFIG,
    unlock() {
      ensureContext();
      initVoices();
      if (bgmEnabled) startBGM();
    },
    onGameEvent,
    runFlowSequence,
    getFlowInfo,
    playSFX,
    speak,
    startBGM,
    stopBGM,
    toggleBGM() {
      bgmEnabled = !bgmEnabled;
      saveBool(STORAGE_BGM, bgmEnabled);
      if (bgmEnabled) startBGM(); else stopBGM();
      return bgmEnabled;
    },
    toggleVoice() {
      voiceEnabled = !voiceEnabled;
      saveBool(STORAGE_VOICE, voiceEnabled);
      if (!voiceEnabled && window.speechSynthesis) speechSynthesis.cancel();
      return voiceEnabled;
    },
    toggleSFX() {
      sfxEnabled = !sfxEnabled;
      saveBool(STORAGE_SFX, sfxEnabled);
      return sfxEnabled;
    },
    isBGMOn: () => bgmEnabled,
    isVoiceOn: () => voiceEnabled,
    isSFXOn: () => sfxEnabled,
    isBGMPlaying: () => bgmPlaying,
  };
}

window.MahjongAudio = createMahjongAudio();
})();
