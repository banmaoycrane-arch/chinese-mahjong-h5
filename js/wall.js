/* global */
(function () {
'use strict';

const WALL_SIZE = 34;
const STACKS_PER_WALL = 17;
const SEAT_WIND = ['东', '南', '西', '北'];

function seatWind(seat) {
  return SEAT_WIND[seat] || '东';
}

/** 把洗好的 136 张牌砌成四面牌墙（每家面前 34 张） */
function buildWallsFromDeck(deck) {
  const walls = [[], [], [], []];
  for (let s = 0; s < 4; s++) {
    walls[s] = deck.slice(s * WALL_SIZE, (s + 1) * WALL_SIZE);
  }
  return walls;
}

/**
 * 根据色子计算开牌位置
 * @param {number} dealer 庄家座位 0-3
 * @param {number} wallSum 第一次掷色子点数和 — 从庄家逆时针数到牌墙
 * @param {number} breakSum 第二次掷色子点数和 — 从该墙右端数墩
 */
function calcWallBreak(dealer, wallSum, breakSum) {
  const wallSeat = (dealer + (wallSum - 1) % 4) % 4;
  let stackFromRight = breakSum % STACKS_PER_WALL;
  if (stackFromRight === 0) stackFromRight = STACKS_PER_WALL;
  const tileIndexInWall = (STACKS_PER_WALL - stackFromRight) * 2;
  return {
    dealer,
    wallSum,
    breakSum,
    wallSeat,
    stackFromRight,
    tileIndexInWall,
    wallSeatName: seatWind(wallSeat),
  };
}

/**
 * 建立抓牌队列：从开牌处沿逆时针方向顺抓；牌尾用于杠补牌
 */
function createDrawWall(deck, breakInfo) {
  const { wallSeat, tileIndexInWall } = breakInfo;
  const walls = buildWallsFromDeck(deck);
  const drawQueue = [];
  const tailReserve = [];

  for (let w = 0; w < 4; w++) {
    const seat = (wallSeat + w) % 4;
    const wall = walls[seat];
    const start = w === 0 ? tileIndexInWall : 0;
    for (let i = start; i < wall.length; i++) drawQueue.push(wall[i]);
    if (w === 0) {
      for (let i = 0; i < tileIndexInWall; i++) tailReserve.push(wall[i]);
    }
  }

  return {
    breakInfo,
    drawQueue,
    tailReserve,
    draw() {
      return drawQueue.length ? drawQueue.shift() : null;
    },
    drawFromTail() {
      if (tailReserve.length) return tailReserve.pop();
      return drawQueue.length ? drawQueue.pop() : null;
    },
    skipDun(count) {
      const n = (count || 1) * 2;
      for (let i = 0; i < n && drawQueue.length; i++) drawQueue.shift();
    },
    remaining() {
      return drawQueue.length + tailReserve.length;
    },
    headRemaining() {
      return drawQueue.length;
    },
    tailRemaining() {
      return tailReserve.length;
    },
  };
}

window.MahjongWall = {
  WALL_SIZE,
  STACKS_PER_WALL,
  SEAT_WIND,
  seatWind,
  buildWallsFromDeck,
  calcWallBreak,
  createDrawWall,
};
})();
