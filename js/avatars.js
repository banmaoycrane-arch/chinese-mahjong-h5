/* global */
(function () {
'use strict';

/** 预设头像（emoji + 底色） */
const AVATAR_PRESETS = [
  { id: 'hero1', emoji: '🧑', bg: '#3498db', label: '少年' },
  { id: 'hero2', emoji: '👩', bg: '#e74c3c', label: '姑娘' },
  { id: 'hero3', emoji: '👴', bg: '#8e44ad', label: '大爷' },
  { id: 'hero4', emoji: '👵', bg: '#d35400', label: '大妈' },
  { id: 'hero5', emoji: '🤵', bg: '#2c3e50', label: '绅士' },
  { id: 'hero6', emoji: '👸', bg: '#c0392b', label: '公主' },
  { id: 'hero7', emoji: '🦸', bg: '#16a085', label: '侠客' },
  { id: 'hero8', emoji: '🧙', bg: '#6c5ce7', label: '法师' },
  { id: 'hero9', emoji: '🐼', bg: '#27ae60', label: '熊猫' },
  { id: 'hero10', emoji: '🦊', bg: '#e67e22', label: '灵狐' },
  { id: 'hero11', emoji: '🐯', bg: '#f39c12', label: '猛虎' },
  { id: 'hero12', emoji: '🐲', bg: '#1abc9c', label: '神龙' },
];

/** 三位电脑固定人设 */
const AI_CHARACTERS = [
  null,
  { id: 'ai_nan', name: '南家·阿南', emoji: '🧑‍🌾', bg: '#2980b9', title: '稳健型', tip: '打牌偏保守，爱碰杠' },
  { id: 'ai_xi', name: '西家·老西', emoji: '👴', bg: '#7d6608', title: '老练型', tip: '经验丰富，防守强' },
  { id: 'ai_bei', name: '北家·小北', emoji: '👩', bg: '#8e44ad', title: '进攻型', tip: '敢打敢拼，常追大番' },
];

const STORAGE_KEY = 'mahjong_player_avatar';
const STORAGE_NAME = 'mahjong_player_name';

function getPreset(id) {
  return AVATAR_PRESETS.find((a) => a.id === id) || AVATAR_PRESETS[0];
}

function loadPlayerAvatar() {
  try {
    const id = localStorage.getItem(STORAGE_KEY);
    return getPreset(id || 'hero1');
  } catch (e) {
    return AVATAR_PRESETS[0];
  }
}

function savePlayerAvatar(id) {
  if (getPreset(id)) localStorage.setItem(STORAGE_KEY, id);
}

function loadPlayerName() {
  try {
    return localStorage.getItem(STORAGE_NAME) || '东家';
  } catch (e) {
    return '东家';
  }
}

function savePlayerName(name) {
  const n = String(name || '').trim().slice(0, 8) || '东家';
  localStorage.setItem(STORAGE_NAME, n);
  return n;
}

function getAiCharacter(seat) {
  return AI_CHARACTERS[seat] || AI_CHARACTERS[1];
}

function getSeatDisplayName(seat, isHuman) {
  if (isHuman) return loadPlayerName() + '(你)';
  const c = getAiCharacter(seat);
  return c ? c.name : '电脑';
}

window.MahjongAvatars = {
  AVATAR_PRESETS, AI_CHARACTERS,
  getPreset, loadPlayerAvatar, savePlayerAvatar,
  loadPlayerName, savePlayerName, getAiCharacter, getSeatDisplayName,
};
})();
