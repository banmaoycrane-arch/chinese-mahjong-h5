/* global */
(function () {
'use strict';

/** 四档难度 — 影响 AI 智能与容错 */
const DIFFICULTIES = {
  easy: {
    id: 'easy',
    name: '简单',
    icon: '🌱',
    aiThinkMs: 400,
    aiClaimRate: 0.15,
    aiHuRate: 0.25,
    aiDefense: 0.1,
    aiMistakeRate: 0.45,
    hintEnabled: true,
    aiDelayMul: 1.4,
  },
  normal: {
    id: 'normal',
    name: '普通',
    icon: '⚔️',
    aiThinkMs: 600,
    aiClaimRate: 0.45,
    aiHuRate: 0.55,
    aiDefense: 0.35,
    aiMistakeRate: 0.2,
    hintEnabled: true,
    aiDelayMul: 1,
  },
  hard: {
    id: 'hard',
    name: '困难',
    icon: '🔥',
    aiThinkMs: 800,
    aiClaimRate: 0.72,
    aiHuRate: 0.78,
    aiDefense: 0.6,
    aiMistakeRate: 0.08,
    hintEnabled: false,
    aiDelayMul: 0.85,
  },
  hell: {
    id: 'hell',
    name: '地狱',
    icon: '💀',
    aiThinkMs: 1000,
    aiClaimRate: 0.9,
    aiHuRate: 0.92,
    aiDefense: 0.85,
    aiMistakeRate: 0.02,
    hintEnabled: false,
    aiDelayMul: 0.7,
  },
};

const STORAGE_KEY = 'mahjong_difficulty';

function get(id) {
  return DIFFICULTIES[id] || DIFFICULTIES.normal;
}

function getIds() {
  return ['easy', 'normal', 'hard', 'hell'];
}

function loadSaved() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return DIFFICULTIES[v] ? v : 'normal';
  } catch (e) {
    return 'normal';
  }
}

function save(id) {
  if (DIFFICULTIES[id]) localStorage.setItem(STORAGE_KEY, id);
}

window.MahjongDifficulty = {
  DIFFICULTIES, get, getIds, loadSaved, save,
};
})();
