/* global MahjongTiles, MahjongDifficulty */
(function () {
'use strict';

const { tileLabel } = MahjongTiles;

let game = null;
let aiTimer = null;

const $ = (id) => document.getElementById(id);
const SEAT_POS = ['bottom', 'right', 'top', 'left'];
const SEAT_FACING = { bottom: 'bottom', right: 'right', top: 'top', left: 'left' };

function suitClass(suit) {
  return 'tile-' + (suit || 'wan');
}

function createTileFace(className, inner) {
  const f = document.createElement('div');
  f.className = 'tile-face ' + className;
  if (inner) f.innerHTML = inner;
  return f;
}

function bindTileClick(el, tile, handler) {
  const fn = (e) => {
    e.preventDefault();
    e.stopPropagation();
    handler(tile, el);
  };
  el.addEventListener('click', fn);
  el.addEventListener('touchend', fn, { passive: false });
}

function renderTile(tile, opts) {
  opts = opts || {};
  const facing = opts.facing || 'bottom';
  const size = opts.size || 'md';

  const el = document.createElement('div');
  el.className = 'tile-3d facing-' + facing + ' size-' + size;
  el.dataset.id = tile.id;
  if (opts.faceDown) el.classList.add('face-down');
  if (opts.selectable) el.classList.add('selectable');
  if (opts.hintSuggested) el.classList.add('hint-suggested');
  if (opts.selected) el.classList.add('selected');
  if (opts.lastDiscard) el.classList.add('last-discard');

  const label = opts.faceDown ? '' : '<span class="tile-text">' + tileLabel(tile) + '</span>';
  el.appendChild(createTileFace('front ' + suitClass(tile.suit), label));
  el.appendChild(createTileFace('back'));
  el.appendChild(createTileFace('edge-right'));
  el.appendChild(createTileFace('edge-left'));
  el.appendChild(createTileFace('edge-top'));

  if (opts.hintSuggested) {
    const badge = document.createElement('div');
    badge.className = 'hint-badge';
    badge.textContent = '建议';
    el.appendChild(badge);
  }

  if (opts.onClick) bindTileClick(el, tile, opts.onClick);
  return el;
}

function isSameTile(a, b) {
  return a && b && (a === b || a.id === b.id);
}

function renderMelds(container, melds, facing) {
  container.innerHTML = '';
  melds.forEach((m) => {
    const g = document.createElement('div');
    g.className = 'meld-group facing-' + facing;
    m.tiles.forEach((t) => g.appendChild(renderTile(t, { facing, size: 'sm' })));
    container.appendChild(g);
  });
}

function renderDiscards(container, discards, facing) {
  container.innerHTML = '';
  const pile = document.createElement('div');
  pile.className = 'discard-pile facing-' + facing;
  discards.forEach((t, i) => {
    pile.appendChild(renderTile(t, {
      facing: 'flat', size: 'sm', lastDiscard: i === discards.length - 1,
    }));
  });
  container.appendChild(pile);
}

function renderHand(container, hand, drawn, state) {
  container.innerHTML = '';
  const row = document.createElement('div');
  row.className = 'hand-row facing-bottom';
  const canSelect = state.phase === 'discard' && state.current === 0 && !state.pendingAction;
  const suggestId = state.suggestedDiscard && state.suggestedDiscard.id;
  let hinted = false;

  hand.forEach((t) => {
    const sel = isSameTile(state.selectedTile, t);
    const showHint = canSelect && !hinted && suggestId === t.id && !sel;
    if (showHint) hinted = true;
    row.appendChild(renderTile(t, {
      facing: 'bottom', size: 'lg', selectable: canSelect,
      selected: sel, hintSuggested: showHint,
      onClick: canSelect ? (tile) => { game.selectTile(tile); } : null,
    }));
  });

  if (drawn) {
    const gap = document.createElement('div');
    gap.className = 'drawn-gap';
    row.appendChild(gap);
    const sel = isSameTile(state.selectedTile, drawn);
    const showHint = canSelect && !hinted && suggestId === drawn.id && !sel;
    row.appendChild(renderTile(drawn, {
      facing: 'bottom', size: 'lg', selectable: canSelect,
      selected: sel, hintSuggested: showHint,
      onClick: canSelect ? (tile) => { game.selectTile(tile); } : null,
    }));
  }
  container.appendChild(row);
}

function renderOpponentDiscards(container, discards, facing, highlightLast) {
  container.innerHTML = '';
  if (!discards.length) return;
  const wrap = document.createElement('div');
  wrap.className = 'opp-discards-wrap facing-' + facing;
  const label = document.createElement('div');
  label.className = 'opp-discards-label';
  label.textContent = '河牌 ' + discards.length;
  wrap.appendChild(label);
  const pile = document.createElement('div');
  pile.className = 'discard-pile opp-discard-pile facing-' + facing;
  const recent = discards.slice(-3);
  recent.forEach((t, i) => {
    const isLast = highlightLast && i === recent.length - 1;
    pile.appendChild(renderTile(t, {
      facing: 'flat', size: 'xs', lastDiscard: isLast,
    }));
  });
  wrap.appendChild(pile);
  container.appendChild(wrap);
}

function renderOpponentHand(container, count, facing, isTurn) {
  container.innerHTML = '';
  const strip = document.createElement('div');
  strip.className = 'opp-hand-strip facing-' + facing + (isTurn ? ' is-turn' : '');
  const label = document.createElement('div');
  label.className = 'opp-hand-label';
  label.innerHTML = '<span class="opp-count-num">' + count + '</span><span class="opp-count-unit">张</span>';
  const tiles = document.createElement('div');
  tiles.className = 'opp-hand-tiles';
  const maxShow = facing === 'top' ? 11 : 7;
  const showCount = Math.min(Math.max(count, 0), maxShow);
  for (let i = 0; i < showCount; i++) {
    tiles.appendChild(renderTile(
      { suit: 'wan', value: 1, id: 'opp' + facing + i },
      { faceDown: true, facing, size: 'xs' }
    ));
  }
  if (count > maxShow) {
    const more = document.createElement('span');
    more.className = 'opp-hand-more';
    more.textContent = '+' + (count - maxShow);
    tiles.appendChild(more);
  }
  strip.appendChild(label);
  strip.appendChild(tiles);
  container.appendChild(strip);
}

function renderPlayerHint(state) {
  const box = $('player-hint');
  if (!box) return;

  if (state.phase === 'flow') {
    box.classList.add('hidden');
    return;
  }
  if (state.phase === 'discard' && state.current !== 0) {
    box.classList.add('hidden');
    return;
  }
  if (state.phase !== 'discard' && state.phase !== 'human-claim') {
    box.classList.add('hidden');
    return;
  }

  box.classList.remove('hidden');
  const stepEl = $('hint-step');
  const mainEl = $('hint-main');
  const subEl = $('hint-sub');

  if (state.pendingAction) {
    if (stepEl) stepEl.textContent = '③ 确认操作';
    if (mainEl) mainEl.innerHTML = '是否执行：<b>' + state.pendingAction.label + '</b>？';
    if (subEl) subEl.textContent = '点「确认」执行，点「取消」返回';
    return;
  }

  if (state.phase === 'human-claim') {
    if (stepEl) stepEl.textContent = '② 选择操作';
    if (mainEl) mainEl.textContent = state.hintText || state.message;
    if (subEl) subEl.textContent = '点「胡/碰/杠/吃」后需再点「确认」；不操作请点「过」';
    return;
  }

  if (state.selectedTile) {
    const selName = tileLabel(state.selectedTile);
    if (stepEl) stepEl.textContent = '② 确认打出';
    if (mainEl) mainEl.innerHTML = '已选【<b>' + selName + '</b>】→ 点下方「打出」';
    if (subEl) subEl.textContent = '也可重新点击其他牌更换选择';
  } else {
    if (stepEl) stepEl.textContent = '① 选择手牌';
    const sn = state.suggestedDiscard ? tileLabel(state.suggestedDiscard) : '—';
    if (mainEl) mainEl.innerHTML = '请点击要打出的牌（建议【<b>' + sn + '</b>】）';
    if (subEl) subEl.textContent = '选中后再点「打出」；能胡/杠请先点对应按钮并确认';
  }
}

function profitClass(n) {
  if (n > 0) return 'profit-up';
  if (n < 0) return 'profit-down';
  return 'profit-flat';
}

function renderPlayerCardEl(card) {
  const el = document.createElement('div');
  el.className = 'pc-inner' +
    (card.isTurn ? ' is-turn' : '') +
    (card.isDealer ? ' is-dealer' : '') +
    (card.isHuman ? ' is-human' : '');
  if (card.tip && !card.isHuman) el.title = card.tip;

  const avatar = document.createElement('div');
  avatar.className = 'avatar-circle';
  avatar.style.background = card.bg;
  avatar.textContent = card.emoji;

  const info = document.createElement('div');
  info.className = 'pc-info';
  if (card.isHuman) {
    info.innerHTML =
      '<div class="pc-name">' + card.name + (card.isDealer ? ' <span class="dealer-tag">庄</span>' : '') + '</div>' +
      '<div class="pc-title">' + card.title + '</div>' +
      '<div class="pc-score">积分 <b>' + card.score + '</b></div>' +
      '<div class="pc-profit ' + profitClass(card.roundProfit) + '">本局 ' + MahjongStatus.formatProfit(card.roundProfit) + '</div>' +
      '<div class="pc-meta">手牌 ' + card.handCount + ' 张 · 已出 ' + card.discards + ' 张</div>';
  } else {
    const actionCls = card.isTurn ? ' pc-action-active' : (card.justDiscarded ? ' pc-action-discarded' : '');
    info.innerHTML =
      '<div class="pc-name">' + card.name + (card.isDealer ? ' <span class="dealer-tag">庄</span>' : '') + '</div>' +
      '<div class="pc-hand-big">手牌 <b>' + card.handCount + '</b> 张</div>' +
      '<div class="pc-action' + actionCls + '">' + (card.actionText || '等待中') + '</div>' +
      '<div class="pc-meta">已出 ' + card.discards + ' 张 · 明牌 ' + card.melds + ' 组 · 积分 ' + card.score + '</div>';
  }

  if (card.isTurn) {
    const bubble = document.createElement('div');
    bubble.className = 'pc-bubble';
    bubble.textContent = card.isHuman ? '请您出牌' : (card.actionText || '思考中…');
    el.appendChild(bubble);
  }

  el.appendChild(avatar);
  el.appendChild(info);
  return el;
}

function renderPlayerCards(state) {
  [0, 1, 2, 3].forEach((seat) => {
    const pos = SEAT_POS[seat];
    const box = $('card-' + pos);
    if (!box) return;
    box.innerHTML = '';
    box.appendChild(renderPlayerCardEl(MahjongStatus.buildPlayerCard(seat, state)));
  });
}

function renderStatusPanel(state) {
  const sit = MahjongStatus.buildSituation(state);
  const sitEl = $('status-situation');
  const statsEl = $('status-stats');
  if (!sitEl || !statsEl) return;

  sitEl.innerHTML = sit.situationLines.map((l) => '<p>' + l + '</p>').join('');

  const fanBlock = sit.canWinNow
    ? '<div class="stat-row highlight"><span>可胡番数</span><b>' + sit.currentFan + ' 番 (' + sit.winType + ')</b></div>'
    : '<div class="stat-row"><span>当前牌型</span><b>' + sit.fanLabel + '</b></div>';

  statsEl.innerHTML =
    fanBlock +
    '<div class="stat-row"><span>我的积分</span><b>' + sit.score + '</b></div>' +
    '<div class="stat-row"><span>本局盈利</span><b class="' + profitClass(sit.roundProfit) + '">' + MahjongStatus.formatProfit(sit.roundProfit) + '</b></div>' +
    '<div class="stat-row"><span>累计盈利</span><b class="' + profitClass(sit.sessionProfit) + '">' + MahjongStatus.formatProfit(sit.sessionProfit) + '</b></div>' +
    '<div class="stat-row"><span>已打出</span><b>' + sit.discardCount + ' 张</b></div>' +
    '<div class="stat-row"><span>亮明面子</span><b>' + sit.meldDesc + '</b></div>' +
    '<div class="stat-row"><span>全场已出</span><b>' + sit.totalTableDiscards + ' 张</b></div>';
}

function initAvatarPicker() {
  const grid = $('avatar-grid');
  const preview = $('avatar-preview');
  const nameInput = $('player-name-input');
  if (!grid) return;

  let current = MahjongAvatars.loadPlayerAvatar();
  if (nameInput) nameInput.value = MahjongAvatars.loadPlayerName();

  function updatePreview(a) {
    current = a;
    if (preview) {
      preview.textContent = a.emoji;
      preview.style.background = a.bg;
    }
    grid.querySelectorAll('.avatar-pick').forEach((btn) => {
      btn.classList.toggle('selected', btn.dataset.id === a.id);
    });
  }

  MahjongAvatars.AVATAR_PRESETS.forEach((a) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'avatar-pick';
    btn.dataset.id = a.id;
    btn.title = a.label;
    btn.innerHTML = '<span class="avatar-circle small" style="background:' + a.bg + '">' + a.emoji + '</span>';
    btn.addEventListener('click', () => {
      MahjongAvatars.savePlayerAvatar(a.id);
      updatePreview(a);
    });
    grid.appendChild(btn);
  });

  updatePreview(current);

  if (nameInput) {
    nameInput.addEventListener('change', () => MahjongAvatars.savePlayerName(nameInput.value));
    nameInput.addEventListener('blur', () => MahjongAvatars.savePlayerName(nameInput.value));
  }
}

function renderActions(state) {
  const bar = $('action-bar');
  bar.innerHTML = '';
  if (state.phase === 'flow') return;

  if (state.pendingAction) {
    const ok = document.createElement('button');
    ok.className = 'action-btn primary confirm-btn';
    ok.textContent = '✓ 确认' + state.pendingAction.label.replace(/^(胡|碰|杠|吃|暗杠|补杠|自摸胡！)/, ' $1');
    ok.addEventListener('click', () => game.confirmPendingAction());
    bar.appendChild(ok);

    const cancel = document.createElement('button');
    cancel.className = 'action-btn pass';
    cancel.textContent = '✕ 取消';
    cancel.addEventListener('click', () => game.cancelPendingAction());
    bar.appendChild(cancel);
    return;
  }

  if (state.phase === 'discard' && state.current === 0) {
    state.actionButtons.forEach((btn) => {
      const b = document.createElement('button');
      b.className = 'action-btn' + (btn.type === 'zimo' ? ' win' : ' special');
      b.textContent = btn.label;
      b.addEventListener('click', () => game.requestAction(btn));
      bar.appendChild(b);
    });

    const discardBtn = document.createElement('button');
    discardBtn.className = 'action-btn primary discard-confirm' + (state.selectedTile ? '' : ' disabled');
    discardBtn.textContent = state.selectedTile
      ? '打出【' + tileLabel(state.selectedTile) + '】'
      : '请先选牌';
    discardBtn.disabled = !state.selectedTile;
    if (state.selectedTile) {
      discardBtn.addEventListener('click', () => game.confirmDiscard());
    }
    bar.appendChild(discardBtn);
    return;
  }

  if (state.phase === 'human-claim') {
    state.actionButtons.forEach((btn) => {
      const b = document.createElement('button');
      b.className = 'action-btn' + (btn.type === 'hu' ? ' win' : '');
      b.textContent = btn.label;
      b.addEventListener('click', () => game.requestAction(btn));
      bar.appendChild(b);
    });

    const pass = document.createElement('button');
    pass.className = 'action-btn pass';
    pass.textContent = '过';
    pass.addEventListener('click', () => game.humanPass());
    bar.appendChild(pass);
  }
}

let diceAnimTimer = null;
let lastDiceKey = '';

function startDiceAnimation(dr) {
  const d1El = $('die1');
  const d2El = $('die2');
  if (!d1El || !d2El || !window.MahjongDice) return;
  if (diceAnimTimer) clearInterval(diceAnimTimer);
  let ticks = 0;
  diceAnimTimer = setInterval(() => {
    MahjongDice.renderDie(d1El, null, true);
    MahjongDice.renderDie(d2El, null, true);
    ticks++;
    if (ticks > 14) {
      clearInterval(diceAnimTimer);
      diceAnimTimer = null;
      MahjongDice.renderDie(d1El, dr.d1, false);
      MahjongDice.renderDie(d2El, dr.d2, false);
    }
  }, 70);
}

function renderFlowOverlay(state) {
  const overlay = $('flow-overlay');
  if (!overlay) return;
  if (state.phase !== 'flow' || !state.flowStep) {
    overlay.classList.add('hidden');
    lastDiceKey = '';
    if (diceAnimTimer) { clearInterval(diceAnimTimer); diceAnimTimer = null; }
    return;
  }
  overlay.classList.remove('hidden');
  const info = window.MahjongAudio ? MahjongAudio.getFlowInfo(state.flowStep) : {};
  const iconEl = $('flow-icon');
  const diceBox = $('flow-dice');
  const textEl = $('flow-text');
  const subEl = $('flow-sub');

  if (state.flowStep === 'dice_wall' || state.flowStep === 'dice_break') {
    const isWall = state.flowStep === 'dice_wall';
    const roll = state.diceRoll && (isWall ? state.diceRoll.wall : state.diceRoll.break);
    if (iconEl) iconEl.classList.add('hidden');
    if (diceBox) diceBox.classList.remove('hidden');
    if (textEl) textEl.textContent = info.label || (isWall ? '第一次掷色子' : '第二次掷色子');
    if (roll) {
      const key = state.round + '-' + state.flowStep + '-' + roll.d1 + '-' + roll.d2;
      if (key !== lastDiceKey) {
        lastDiceKey = key;
        startDiceAnimation(roll);
      }
      if (subEl) {
        let sub = roll.d1 + ' + ' + roll.d2 + ' = ' + roll.sum + ' 点';
        if (isWall && state.diceRoll && state.diceRoll.wall) {
          sub += ' · ' + MahjongDice.describeWallRoll(state.dealer, state.diceRoll.wall);
        }
        if (!isWall && state.wallBreak) {
          sub += ' · ' + MahjongDice.describeBreakRoll(state.wallBreak);
        }
        subEl.textContent = sub;
      }
    } else if (subEl) {
      subEl.textContent = isWall ? '定牌墙…' : '定起抓墩…';
    }
  } else {
    lastDiceKey = '';
    if (diceAnimTimer) { clearInterval(diceAnimTimer); diceAnimTimer = null; }
    if (iconEl) iconEl.classList.remove('hidden');
    if (diceBox) diceBox.classList.add('hidden');
    if (iconEl) iconEl.textContent = info.icon || '🀄';
    if (textEl) textEl.textContent = info.label || state.message;
    if (subEl) subEl.textContent = state.message || '';
  }
}

function render(state) {
  $('msg-text').textContent = state.message;
  $('wall-count').textContent = state.wallCount;
  $('round-num').textContent = state.round;
  $('diff-tag').textContent = state.difficulty.icon + ' ' + state.difficulty.name;

  const verEl = $('app-version');
  if (verEl && window.MAHJONG_BUILD) verEl.textContent = MAHJONG_BUILD.label;

  state.players.forEach((p) => {
    const pos = SEAT_POS[p.seat];
    const facing = SEAT_FACING[pos];

    if (p.isHuman) {
      renderHand($('hand-bottom'), state.humanHand, state.drawnTile, state);
      renderMelds($('melds-bottom'), p.melds, 'bottom');
      renderDiscards($('discards-bottom'), p.discards, 'bottom');
    } else {
      renderOpponentHand($('hand-' + pos), p.handCount, facing, state.current === p.seat && !state.gameOver);
      renderMelds($('melds-' + pos), p.melds, facing);
      renderOpponentDiscards($('discards-' + pos), p.discards, facing, state.lastDiscardFrom === p.seat);
    }
  });

  renderPlayerCards(state);
  renderStatusPanel(state);

  const center = $('center-discard');
  center.innerHTML = '';
  if (state.lastDiscard) {
    const spotlight = document.createElement('div');
    spotlight.className = 'center-spotlight';
    const fromName = state.players[state.lastDiscardFrom]
      ? state.players[state.lastDiscardFrom].name : '';
    if (fromName) {
      const tag = document.createElement('div');
      tag.className = 'center-discard-from';
      tag.textContent = fromName + ' 打出';
      spotlight.appendChild(tag);
    }
    spotlight.appendChild(renderTile(state.lastDiscard, { facing: 'flat', size: 'md', lastDiscard: true }));
    center.appendChild(spotlight);
  }

  renderPlayerHint(state);
  renderActions(state);
  renderFlowOverlay(state);

  const overlay = $('result-overlay');
  if (state.gameOver) {
    overlay.classList.remove('hidden');
    if (state.winInfo) {
      $('result-title').textContent = state.winInfo.name + ' 胡牌！';
      $('result-body').innerHTML = (state.winInfo.isZimo ? '自摸' : '点炮') + ' · ' + state.winInfo.fan + ' 番 · 每家 ' + state.winInfo.pay;
    } else {
      $('result-title').textContent = '流局';
      $('result-body').textContent = '无人胡牌，庄家继续';
    }
  } else {
    overlay.classList.add('hidden');
  }
}

function clearAiTimer() {
  if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; }
}

function bindGame(g) {
  game = g;
  clearAiTimer();
  game.onUpdate((state, extra) => {
    render(state);
    if (extra.aiDiscard) {
      clearAiTimer();
      aiTimer = setTimeout(() => game.aiDiscard(), extra.delay || 600);
    }
  });
  render(game.getState());
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.add('hidden'));
  const el = $(id);
  if (el) el.classList.remove('hidden');
}

function updateAudioButtons() {
  const bgmBtn = $('btn-bgm');
  const voiceBtn = $('btn-voice');
  if (bgmBtn && window.MahjongAudio) {
    bgmBtn.textContent = MahjongAudio.isBGMOn() ? '🔊' : '🔇';
    bgmBtn.classList.toggle('off', !MahjongAudio.isBGMOn());
  }
  if (voiceBtn && window.MahjongAudio) {
    voiceBtn.textContent = MahjongAudio.isVoiceOn() ? '🗣️' : '🤐';
    voiceBtn.classList.toggle('off', !MahjongAudio.isVoiceOn());
  }
}

function initAudioControls() {
  updateAudioButtons();
  const bgmBtn = $('btn-bgm');
  const voiceBtn = $('btn-voice');
  if (bgmBtn) {
    bgmBtn.addEventListener('click', () => {
      if (window.MahjongAudio) {
        MahjongAudio.unlock();
        MahjongAudio.toggleBGM();
        updateAudioButtons();
      }
    });
  }
  if (voiceBtn) {
    voiceBtn.addEventListener('click', () => {
      if (window.MahjongAudio) {
        MahjongAudio.unlock();
        MahjongAudio.toggleVoice();
        updateAudioButtons();
        if (MahjongAudio.isVoiceOn()) MahjongAudio.speak('语音已开启');
      }
    });
  }
}

function initUI() {
  initAvatarPicker();
  initAudioControls();
  const diffGrid = $('difficulty-grid');
  MahjongDifficulty.getIds().forEach((id) => {
    const d = MahjongDifficulty.get(id);
    const btn = document.createElement('button');
    btn.className = 'diff-btn';
    btn.innerHTML = '<span class="diff-icon">' + d.icon + '</span><span class="diff-name">' + d.name + '</span>';
    btn.addEventListener('click', () => {
      MahjongDifficulty.save(id);
      const nameInput = $('player-name-input');
      if (nameInput) MahjongAvatars.savePlayerName(nameInput.value);
      if (window.MahjongAudio) MahjongAudio.unlock();
      bindGame(window.MahjongGame.createGame(id));
      showScreen('game-screen');
      updateAudioButtons();
      game.start();
    });
    diffGrid.appendChild(btn);
  });

  $('btn-restart').addEventListener('click', () => {
    showScreen('start-screen');
    game = null;
    clearAiTimer();
  });

  $('btn-next').addEventListener('click', () => {
    if (game) {
      $('result-overlay').classList.add('hidden');
      game.newRound();
    }
  });

  $('btn-menu').addEventListener('click', () => {
    showScreen('start-screen');
    game = null;
    clearAiTimer();
  });

  if (window.MahjongDevice) {
    window.addEventListener('resize', () => {
      if (game) render(game.getState());
    });
  }

  $('rotate-hint').addEventListener('click', () => {
    $('rotate-hint').classList.add('hidden');
  });

  checkOrientation();
  window.addEventListener('resize', checkOrientation);
  window.addEventListener('orientationchange', checkOrientation);
}

function checkOrientation() {
  if (window.MahjongDevice) {
    MahjongDevice.applyDeviceClasses();
    return;
  }
  const hint = $('rotate-hint');
  if (!hint) return;
  const portrait = window.innerHeight > window.innerWidth && window.innerWidth < 900;
  hint.classList.toggle('hidden', !portrait);
}

window.MahjongUI = { initUI, render, bindGame };
})();
