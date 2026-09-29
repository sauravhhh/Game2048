/* 2048 core logic — pure functions, no DOM. Used by index.html and headless-tested in Node. */
(function (root) {
  'use strict';

  var DIRS = ['up', 'down', 'left', 'right'];

  function emptyGrid(size) {
    var g = [];
    for (var r = 0; r < size; r++) { g.push([]); for (var c = 0; c < size; c++) g[r].push(null); }
    return g;
  }

  function createGame(size) {
    size = size || 4;
    var state = { size: size, grid: emptyGrid(size), score: 0, won: false, keepPlaying: false, over: false, nextId: 1 };
    addRandomTile(state);
    addRandomTile(state);
    return state;
  }

  function emptyCells(state) {
    var cells = [];
    for (var r = 0; r < state.size; r++)
      for (var c = 0; c < state.size; c++)
        if (!state.grid[r][c]) cells.push({ r: r, c: c });
    return cells;
  }

  // Adds a random tile (2 with 90%, 4 with 10%). rng injectable for tests.
  // Returns the new tile object or null if board full.
  function addRandomTile(state, rng) {
    rng = rng || Math.random;
    var cells = emptyCells(state);
    if (!cells.length) return null;
    var cell = cells[Math.floor(rng() * cells.length)];
    var tile = { id: state.nextId++, value: rng() < 0.9 ? 2 : 4, r: cell.r, c: cell.c };
    state.grid[cell.r][cell.c] = tile;
    return tile;
  }

  function linesFor(size, dir) {
    var lines = [], r, c;
    if (dir === 'left')  { for (r = 0; r < size; r++) lines.push([[r,0],[r,1],[r,2],[r,3]]); }
    if (dir === 'right') { for (r = 0; r < size; r++) lines.push([[r,3],[r,2],[r,1],[r,0]]); }
    if (dir === 'up')    { for (c = 0; c < size; c++) lines.push([[0,c],[1,c],[2,c],[3,c]]); }
    if (dir === 'down')  { for (c = 0; c < size; c++) lines.push([[3,c],[2,c],[1,c],[0,c]]); }
    return lines;
  }

  // Applies a move. Mutates state. Returns { moved, gained, events } where events
  // describe tile animations: {kind:'move'|'merge', id, from, to, absorbedId, absorbedFrom, value}.
  function move(state, dir, rng) {
    if (state.over || DIRS.indexOf(dir) < 0) return { moved: false, gained: 0, events: [] };
    var size = state.size, events = [], gained = 0, moved = false;
    var lines = linesFor(size, dir);

    lines.forEach(function (line) {
      var tiles = line.map(function (cell) { return state.grid[cell[0]][cell[1]]; })
                      .filter(function (t) { return !!t; });
      line.forEach(function (cell) { state.grid[cell[0]][cell[1]] = null; });

      var out = [], i = 0;
      while (i < tiles.length) {
        var target = line[out.length];
        var t = tiles[i];
        if (i + 1 < tiles.length && tiles[i + 1].value === t.value) {
          var absorbed = tiles[i + 1];
          var newValue = t.value * 2;
          gained += newValue;
          events.push({
            kind: 'merge', id: t.id, value: newValue,
            from: { r: t.r, c: t.c }, to: { r: target[0], c: target[1] },
            absorbedId: absorbed.id, absorbedFrom: { r: absorbed.r, c: absorbed.c }
          });
          if (t.r !== target[0] || t.c !== target[1]) moved = true;
          moved = true; // a merge always counts as a move
          t.value = newValue; t.r = target[0]; t.c = target[1];
          state.grid[target[0]][target[1]] = t;
          out.push(t);
          i += 2;
        } else {
          if (t.r !== target[0] || t.c !== target[1]) {
            events.push({ kind: 'move', id: t.id, from: { r: t.r, c: t.c }, to: { r: target[0], c: target[1] } });
            moved = true;
          }
          t.r = target[0]; t.c = target[1];
          state.grid[target[0]][target[1]] = t;
          out.push(t);
          i += 1;
        }
      }
    });

    if (!moved) return { moved: false, gained: 0, events: [] };

    state.score += gained;
    var newTile = addRandomTile(state, rng);
    if (newTile) events.push({ kind: 'spawn', id: newTile.id, at: { r: newTile.r, c: newTile.c }, value: newTile.value });

    var wonNow = false;
    if (!state.won && !state.keepPlaying) {
      outer: for (var r = 0; r < size; r++)
        for (var c = 0; c < size; c++)
          if (state.grid[r][c] && state.grid[r][c].value >= 2048) { wonNow = true; break outer; }
      if (wonNow) state.won = true;
    }
    if (!movesAvailable(state)) state.over = true;

    return { moved: true, gained: gained, events: events, wonNow: wonNow };
  }

  function movesAvailable(state) {
    if (emptyCells(state).length) return true;
    var size = state.size;
    for (var r = 0; r < size; r++)
      for (var c = 0; c < size; c++) {
        var v = state.grid[r][c].value;
        if (c + 1 < size && state.grid[r][c + 1].value === v) return true;
        if (r + 1 < size && state.grid[r + 1][c].value === v) return true;
      }
    return false;
  }

  function maxTile(state) {
    var m = 0;
    for (var r = 0; r < state.size; r++)
      for (var c = 0; c < state.size; c++)
        if (state.grid[r][c] && state.grid[r][c].value > m) m = state.grid[r][c].value;
    return m;
  }

  function gridValues(state) {
    return state.grid.map(function (row) { return row.map(function (t) { return t ? t.value : 0; }); });
  }

  var api = {
    createGame: createGame, move: move, addRandomTile: addRandomTile,
    movesAvailable: movesAvailable, maxTile: maxTile, gridValues: gridValues, DIRS: DIRS
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Game2048 = api;
})(typeof window !== 'undefined' ? window : global);
