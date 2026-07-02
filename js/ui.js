/* global MahjongTiles, MahjongDifficulty */
(function () {
'use strict';

const { tileLabel, SUITS } = MahjongTiles;

let game = null;
let aiTimer = null;

const $ = (id) => document.getElementById(id);

function suitClass(suit) {
  return 'tile-' + suit;
}

function renderTile(tile, opts) {
  opts = opts || {};
  const el = document.createElement('div');
  el.className = 'tile ' + suitClass(tile.suit);
  if (opts.faceDown) el.classList.add('face-down');
  if (opts.selected) el.classList.add('selected');
  if (opts.small) el.classList.add('small');
  if (opts.tiny) el.classList.add('tiny');
  el.dataset.id = tile.id;
  el.innerHTML = opts.faceDown ? '' : '<span class="tile-text">' + tileLabel(tile) + '</span>';
  if (opts.onClick) {
    el.addEventListener('click', (e) => { e.stopPropagation(); opts.onClick(tile, el); });
  }
  return el;
}

function renderMelds(container, melds, vertical) {
  container.innerHTML = '';
  melds.forEach((m) => {
    const g = document.createElement('div');
    g.className = 'meld-group' + (vertical ? ' vertical' : '');
    m.tiles.forEach((t) => g.appendChild(renderTile(t, { small: true, tiny: vertical })));
    container.appendChild(g);
  });
}

function renderDiscards(container, discards) {
  container.innerHTML = '';
  discards.forEach((t, i) => {
    const el = renderTile(t, { small: true });
    if (i === discards.length - 1) el.classList.add('last-discard');
    container.appendChild(el);
  });
}

function renderHand(container, hand, state) {
  container.innerHTML = '';
  hand.forEach((t) => {
    const sel = state.selectedTile && state.selectedTile.id === t.id;
    container.appendChild(renderTile(t, {
      selected: sel,
      onClick: state.phase === 'discard' && state.current === 0 ? (tile) => {
        game.selectTile(tile);
        render(state);
      } : null,
    }));
  });
  if (state.drawnTile) {
    const gap = document.createElement('div');
    gap.className = 'drawn-gap';
    container.appendChild(gap);
    const sel = state.selectedTile && state.selectedTile.id === state.drawnTile.id;
    container.appendChild(renderTile(state.drawnTile, {
      selected: sel,
      onClick: state.phase === 'discard' && state.current === 0 ? (tile) => {
        game.selectTile(tile);
        render(state);
      } : null,
    }));
  }
}

function renderOpponentHand(container, count, vertical) {
  container.innerHTML = '';
  for (let i = 0; i < count; i++) {
    container.appendChild(renderTile({ suit: 'wan', value: 1, id: 'x' + i }, { faceDown: true, small: true, tiny: vertical }));
  }
}

function renderActions(state) {
  const bar = $('action-bar');
  bar.innerHTML = '';
  state.actionButtons.forEach((btn) => {
    const b = document.createElement('button');
    b.className = 'action-btn';
    b.textContent = btn.label;
    b.addEventListener('click', () => {
      game.humanAction(btn);
    });
    bar.appendChild(b);
  });
  if (state.phase === 'human-claim') {
    const pass = document.createElement('button');
    pass.className = 'action-btn pass';
    pass.textContent = '过';
    pass.addEventListener('click', () => game.humanPass());
    bar.appendChild(pass);
  }
  if (state.phase === 'discard' && state.current === 0 && state.selectedTile) {
    const d = document.createElement('button');
    d.className = 'action-btn primary';
    d.textContent = '打出 ' + tileLabel(state.selectedTile);
    d.addEventListener('click', () => game.humanDiscard(state.selectedTile));
    bar.appendChild(d);
  }
}

function render(state) {
  $('msg-text').textContent = state.message;
  $('wall-count').textContent = state.wallCount;
  $('round-num').textContent = state.round;
  $('diff-tag').textContent = state.difficulty.icon + ' ' + state.difficulty.name;

  const seats = ['bottom', 'right', 'top', 'left'];
  state.players.forEach((p) => {
    const pos = seats[p.seat];
    const nameEl = $('name-' + pos);
    if (nameEl) {
      nameEl.textContent = p.name + (p.seat === state.dealer ? ' 庄' : '');
      nameEl.classList.toggle('active-turn', p.seat === state.current);
    }
    const scoreEl = $('score-' + pos);
    if (scoreEl) scoreEl.textContent = state.scores[p.seat];

    if (p.isHuman) {
      renderHand($('hand-bottom'), state.humanHand, state);
      renderMelds($('melds-bottom'), p.melds, false);
    } else {
      const handEl = $('hand-' + pos);
      const vert = pos === 'left' || pos === 'right';
      renderOpponentHand(handEl, p.handCount, vert);
      renderMelds($('melds-' + pos), p.melds, vert);
    }
    renderDiscards($('discards-' + pos), p.discards);
  });

  const center = $('center-discard');
  center.innerHTML = '';
  if (state.lastDiscard) {
    center.appendChild(renderTile(state.lastDiscard, { small: true }));
  }

  renderActions(state);

  const overlay = $('result-overlay');
  if (state.gameOver) {
    overlay.classList.remove('hidden');
    const title = $('result-title');
    const body = $('result-body');
    if (state.winInfo) {
      title.textContent = state.winInfo.name + ' 胡牌！';
      body.innerHTML = (state.winInfo.isZimo ? '自摸' : '点炮') + ' · ' + state.winInfo.fan + ' 番 · 每家 ' + state.winInfo.pay;
    } else {
      title.textContent = '流局';
      body.textContent = '无人胡牌，庄家继续';
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

function initUI() {
  const diffGrid = $('difficulty-grid');
  MahjongDifficulty.getIds().forEach((id) => {
    const d = MahjongDifficulty.get(id);
    const btn = document.createElement('button');
    btn.className = 'diff-btn';
    btn.innerHTML = '<span class="diff-icon">' + d.icon + '</span><span class="diff-name">' + d.name + '</span>';
    btn.addEventListener('click', () => {
      MahjongDifficulty.save(id);
      const g = window.MahjongGame.createGame(id);
      bindGame(g);
      showScreen('game-screen');
      g.start();
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

  $('rotate-hint').addEventListener('click', () => {
    $('rotate-hint').classList.add('hidden');
  });

  checkOrientation();
  window.addEventListener('resize', checkOrientation);
  window.addEventListener('orientationchange', checkOrientation);
}

function checkOrientation() {
  const hint = $('rotate-hint');
  if (!hint) return;
  const portrait = window.innerHeight > window.innerWidth && window.innerWidth < 900;
  hint.classList.toggle('hidden', !portrait);
}

window.MahjongUI = { initUI, render, bindGame };
})();
