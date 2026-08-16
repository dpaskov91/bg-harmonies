(() => {
  "use strict";
  // Auto-reload when a newer deploy is live, so an open tab never shows a stale
  // cached copy. Skipped when running locally (no build step to fill in the version).
  const metaVersion = document.querySelector('meta[name="app-version"]');
  const currentVersion = metaVersion ? metaVersion.content : "";
  if (currentVersion && currentVersion !== "__CACHE_VERSION__") {
    const RELOAD_GUARD_KEY = "harmonies-reloaded-for-version";
    const checkForUpdate = () => {
      fetch("version.txt", { cache: "no-store" })
        .then((res) => (res.ok ? res.text() : null))
        .then((latest) => {
          const latestVersion = latest && latest.trim();
          if (!latestVersion || latestVersion === currentVersion) return;
          // Cap at one reload attempt per detected version so a broken deploy
          // (version.txt updated but index.html didn't change) can't loop forever.
          if (sessionStorage.getItem(RELOAD_GUARD_KEY) === latestVersion) return;
          sessionStorage.setItem(RELOAD_GUARD_KEY, latestVersion);
          location.reload();
        })
        .catch(() => {});
    };
    checkForUpdate();
    setInterval(checkForUpdate, 120000);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) checkForUpdate();
    });
  }
})();

(() => {
  "use strict";

  const STATE_KEY = "harmonies-tracker-session-v1";
  const SETUP_KEY = "harmonies-tracker-lastsetup-v1";
  const PALETTE = [
    { key: "forest", label: "Forest", hex: "#6f8f6a" },
    { key: "water", label: "Water", hex: "#6f9fb8" },
    { key: "field", label: "Field", hex: "#e0ab3c" },
    { key: "mountain", label: "Mountain", hex: "#928a7c" },
    { key: "building", label: "Building", hex: "#c1583f" },
  ];

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function colorHex(key) {
    const c = PALETTE.find((p) => p.key === key);
    return c ? c.hex : PALETTE[0].hex;
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveState(state) {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  }

  function loadLastSetup() {
    try {
      const raw = localStorage.getItem(SETUP_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveLastSetup(players) {
    localStorage.setItem(
      SETUP_KEY,
      JSON.stringify(players.map((p) => ({ name: p.name, color: p.color })))
    );
  }

  let state = loadState();

  // ---------- Setup screen ----------

  let setupCount = (state && state.players.length) || (loadLastSetup() || []).length || 2;
  if (setupCount < 2 || setupCount > 4) setupCount = 2;

  function buildDefaultSetupPlayers(count) {
    const last = loadLastSetup() || [];
    const out = [];
    for (let i = 0; i < count; i++) {
      out.push({
        name: (last[i] && last[i].name) || "",
        color: (last[i] && last[i].color) || PALETTE[i % PALETTE.length].key,
      });
    }
    return out;
  }

  let setupPlayers = buildDefaultSetupPlayers(setupCount);

  function renderSetupCountButtons() {
    $$(".count-btn").forEach((btn) => {
      btn.classList.toggle("active", Number(btn.dataset.count) === setupCount);
    });
  }

  function renderSetupPlayers() {
    const container = $("#setup-players");
    container.innerHTML = "";
    setupPlayers.forEach((player, idx) => {
      const row = document.createElement("div");
      row.className = "setup-player-row";

      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = `Player ${idx + 1} name`;
      input.value = player.name;
      input.maxLength = 24;
      input.addEventListener("input", (e) => {
        setupPlayers[idx].name = e.target.value;
      });

      const swatchPicker = document.createElement("div");
      swatchPicker.className = "color-swatch-picker";
      PALETTE.forEach((c) => {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = "color-dot" + (player.color === c.key ? " selected" : "");
        dot.style.background = c.hex;
        dot.title = c.label;
        dot.addEventListener("click", () => {
          setupPlayers[idx].color = c.key;
          renderSetupPlayers();
        });
        swatchPicker.appendChild(dot);
      });

      row.appendChild(input);
      row.appendChild(swatchPicker);
      container.appendChild(row);
    });
  }

  $$(".count-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      setupCount = Number(btn.dataset.count);
      const existing = setupPlayers;
      setupPlayers = buildDefaultSetupPlayers(setupCount).map(
        (p, i) => existing[i] ? { name: existing[i].name || p.name, color: existing[i].color || p.color } : p
      );
      renderSetupCountButtons();
      renderSetupPlayers();
    });
  });

  $("#start-session-btn").addEventListener("click", () => {
    const players = setupPlayers.map((p, i) => ({
      id: `p${i}-${Date.now()}`,
      name: p.name.trim() || `Player ${i + 1}`,
      color: p.color,
    }));
    saveLastSetup(players);
    state = { players, games: [] };
    saveState(state);
    showTracker();
  });

  $("#edit-players-btn").addEventListener("click", () => {
    if (!confirm("Edit players? This starts a fresh session (game history for the current session will be cleared).")) return;
    setupCount = state.players.length;
    setupPlayers = state.players.map((p) => ({ name: p.name, color: p.color }));
    renderSetupCountButtons();
    renderSetupPlayers();
    showSetup();
  });

  function showSetup() {
    $("#setup-screen").hidden = false;
    $("#tracker-screen").hidden = true;
    renderSetupCountButtons();
    renderSetupPlayers();
  }

  // ---------- Tracker screen ----------

  const BREAKDOWN_ROWS = [
    { key: "tree1", label: "🌳 Trees 1", full: "Trees size 1" },
    { key: "tree2", label: "🌳 Trees 2", full: "Trees size 2" },
    { key: "tree3", label: "🌳 Trees 3", full: "Trees size 3" },
    { key: "mountain1", label: "⛰️ Mtns 1", full: "Mountains size 1" },
    { key: "mountain2", label: "⛰️ Mtns 2", full: "Mountains size 2" },
    { key: "mountain3", label: "⛰️ Mtns 3", full: "Mountains size 3" },
    { key: "fields", label: "🌾 Fields", full: "Field groups" },
    { key: "river", label: "💧 River", full: "Longest river" },
    { key: "buildings", label: "🏠 Bldgs", full: "Buildings" },
    { key: "animals", label: "🦔 Animals", full: "Animal cards total" },
    { key: "spirits", label: "✨ Spirits", full: "Nature's Spirit total" },
  ];
  const BREAKDOWN_KEYS = BREAKDOWN_ROWS.map((r) => r.key);

  function pointsForStack(n) {
    return n === 1 ? 1 : n === 2 ? 3 : n === 3 ? 7 : 0;
  }

  function pointsForRiver(len) {
    if (len <= 1) return 0;
    const table = { 2: 2, 3: 5, 4: 8, 5: 11, 6: 15 };
    if (len <= 6) return table[len];
    return 15 + (len - 6) * 4;
  }

  function computeBreakdownTotal(bd) {
    let total = 0;
    total += (bd.tree1 || 0) * pointsForStack(1);
    total += (bd.tree2 || 0) * pointsForStack(2);
    total += (bd.tree3 || 0) * pointsForStack(3);
    total += (bd.mountain1 || 0) * pointsForStack(1);
    total += (bd.mountain2 || 0) * pointsForStack(2);
    total += (bd.mountain3 || 0) * pointsForStack(3);
    total += (bd.fields || 0) * 5;
    total += pointsForRiver(bd.river || 0);
    total += (bd.buildings || 0) * 5;
    total += (bd.animals || 0);
    total += (bd.spirits || 0);
    return total;
  }

  let totalInputs = {}; // playerId -> input
  let bdInputsByPlayer = {}; // playerId -> { key: input }
  let subtotalEls = {}; // playerId -> span

  function updateBreakdownForPlayer(playerId) {
    const bd = {};
    BREAKDOWN_KEYS.forEach((k) => (bd[k] = Number(bdInputsByPlayer[playerId][k].value) || 0));
    const total = computeBreakdownTotal(bd);
    subtotalEls[playerId].textContent = String(total);
    totalInputs[playerId].value = total;
  }

  function renderScoreEntryTable() {
    const table = $("#score-table");
    table.innerHTML = "";
    totalInputs = {};
    bdInputsByPlayer = {};
    subtotalEls = {};

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    headRow.appendChild(document.createElement("th"));
    state.players.forEach((player) => {
      const th = document.createElement("th");
      th.title = player.name;
      const swatch = document.createElement("span");
      swatch.className = "player-swatch";
      swatch.style.background = colorHex(player.color);
      const nameSpan = document.createElement("span");
      nameSpan.className = "player-name-short";
      nameSpan.textContent = player.name;
      th.appendChild(swatch);
      th.appendChild(nameSpan);
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    const totalRow = document.createElement("tr");
    totalRow.className = "row-total";
    const totalLabelTd = document.createElement("td");
    totalLabelTd.className = "row-label";
    totalLabelTd.textContent = "Total";
    totalRow.appendChild(totalLabelTd);
    state.players.forEach((player) => {
      const td = document.createElement("td");
      const input = document.createElement("input");
      input.type = "number";
      input.inputMode = "numeric";
      input.placeholder = "0";
      input.className = "total-input";
      td.appendChild(input);
      totalRow.appendChild(td);
      totalInputs[player.id] = input;
      bdInputsByPlayer[player.id] = {};
    });
    tbody.appendChild(totalRow);

    BREAKDOWN_ROWS.forEach((rowDef) => {
      const tr = document.createElement("tr");
      tr.className = "row-breakdown";
      const labelTd = document.createElement("td");
      labelTd.className = "row-label";
      labelTd.textContent = rowDef.label;
      labelTd.title = rowDef.full;
      tr.appendChild(labelTd);
      state.players.forEach((player) => {
        const td = document.createElement("td");
        const input = document.createElement("input");
        input.type = "number";
        input.min = "0";
        input.placeholder = "0";
        input.className = "bd-input";
        input.addEventListener("input", () => updateBreakdownForPlayer(player.id));
        td.appendChild(input);
        tr.appendChild(td);
        bdInputsByPlayer[player.id][rowDef.key] = input;
      });
      tbody.appendChild(tr);
    });

    const subtotalRow = document.createElement("tr");
    subtotalRow.className = "row-subtotal row-breakdown";
    const subtotalLabelTd = document.createElement("td");
    subtotalLabelTd.className = "row-label";
    subtotalLabelTd.textContent = "Subtotal";
    subtotalLabelTd.title = "Breakdown total";
    subtotalRow.appendChild(subtotalLabelTd);
    state.players.forEach((player) => {
      const td = document.createElement("td");
      const span = document.createElement("span");
      span.className = "bd-subtotal-value";
      span.textContent = "0";
      td.appendChild(span);
      subtotalRow.appendChild(td);
      subtotalEls[player.id] = span;
    });
    tbody.appendChild(subtotalRow);

    table.appendChild(tbody);
    applyBreakdownVisibility();
  }

  let breakdownVisible = true;

  function applyBreakdownVisibility() {
    $("#toggle-breakdown-btn").textContent = breakdownVisible ? "Hide breakdown" : "Detailed breakdown";
    $$(".row-breakdown", $("#score-table")).forEach((row) => (row.hidden = !breakdownVisible));
    // When the breakdown is open, Total is computed from it, not typed directly.
    Object.keys(totalInputs).forEach((playerId) => {
      totalInputs[playerId].readOnly = breakdownVisible;
      if (breakdownVisible) updateBreakdownForPlayer(playerId);
    });
  }

  $("#toggle-breakdown-btn").addEventListener("click", () => {
    breakdownVisible = !breakdownVisible;
    applyBreakdownVisibility();
  });

  $("#save-game-btn").addEventListener("click", () => {
    const scores = {};
    const breakdowns = {};
    let anyFilled = false;

    state.players.forEach((player) => {
      const totalInput = totalInputs[player.id];
      const total = Number(totalInput.value);
      if (totalInput.value !== "" && !Number.isNaN(total)) anyFilled = true;
      scores[player.id] = Number.isNaN(total) ? 0 : total;

      const bd = {};
      let hasBreakdown = false;
      BREAKDOWN_KEYS.forEach((k) => {
        const v = Number(bdInputsByPlayer[player.id][k].value) || 0;
        bd[k] = v;
        if (v) hasBreakdown = true;
      });
      breakdowns[player.id] = hasBreakdown ? bd : null;
    });

    if (!anyFilled) {
      alert("Enter at least one score before saving.");
      return;
    }

    state.games.push({
      id: `g${Date.now()}`,
      timestamp: new Date().toISOString(),
      scores,
      breakdowns,
    });
    saveState(state);

    renderScoreEntryTable();
    renderLeaderboard();
    renderHistory();
  });

  function renderLeaderboard() {
    const el = $("#leaderboard");
    el.innerHTML = "";

    const totals = state.players.map((player) => {
      const scoresForPlayer = state.games.map((g) => g.scores[player.id] || 0);
      const sum = scoresForPlayer.reduce((a, b) => a + b, 0);
      const wins = state.games.filter((g) => {
        const max = Math.max(...state.players.map((p) => g.scores[p.id] || 0));
        return (g.scores[player.id] || 0) === max;
      }).length;
      const avg = scoresForPlayer.length ? Math.round((sum / scoresForPlayer.length) * 10) / 10 : 0;
      const best = scoresForPlayer.length ? Math.max(...scoresForPlayer) : 0;
      return { player, sum, wins, avg, best };
    });

    const maxSum = Math.max(...totals.map((t) => t.sum), 0);

    totals.forEach((t) => {
      const card = document.createElement("div");
      card.className = "player-card" + (state.games.length && t.sum === maxSum && maxSum > 0 ? " leader" : "");
      card.style.setProperty("--player-color", colorHex(t.player.color));
      card.innerHTML = `
        <div class="pc-name">${escapeHtml(t.player.name)} ${state.games.length && t.sum === maxSum && maxSum > 0 ? '<span class="pc-crown">👑</span>' : ""}</div>
        <div class="pc-total">${t.sum}</div>
        <div class="pc-meta">${t.wins} win${t.wins === 1 ? "" : "s"} · avg ${t.avg} · best ${t.best}</div>
      `;
      el.appendChild(card);
    });

    $("#game-number-heading").textContent = `Record Game ${state.games.length + 1}`;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  const expandedGames = new Set();

  function buildBreakdownDetailHtml(game) {
    const hasAnyBreakdown = state.players.some((p) => game.breakdowns[p.id]);
    if (!hasAnyBreakdown) {
      return `<div class="history-item-detail">No detailed breakdown recorded for this game.</div>`;
    }
    const rows = state.players.map((p) => {
      const bd = game.breakdowns[p.id];
      if (!bd) return `<tr><td>${escapeHtml(p.name)}</td><td colspan="6">total only</td></tr>`;
      return `<tr>
        <td>${escapeHtml(p.name)}</td>
        <td>🌳 ${(bd.tree1||0)}/${(bd.tree2||0)}/${(bd.tree3||0)}</td>
        <td>⛰️ ${(bd.mountain1||0)}/${(bd.mountain2||0)}/${(bd.mountain3||0)}</td>
        <td>🌾 ${bd.fields||0}</td>
        <td>💧 ${bd.river||0}</td>
        <td>🏠 ${bd.buildings||0}</td>
        <td>🦔✨ ${(bd.animals||0)+(bd.spirits||0)}</td>
      </tr>`;
    }).join("");
    return `<div class="history-item-detail"><table>
      <thead><tr><th>Player</th><th>Trees</th><th>Mtns</th><th>Fields</th><th>River</th><th>Bldgs</th><th>Animals+Spirit</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
  }

  function renderHistory() {
    const table = $("#history-table");
    const empty = $("#history-empty");
    table.innerHTML = "";

    if (!state.games.length) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    headRow.appendChild(document.createElement("th"));
    state.players.forEach((player) => {
      const th = document.createElement("th");
      th.title = player.name;
      const swatch = document.createElement("span");
      swatch.className = "player-swatch";
      swatch.style.background = colorHex(player.color);
      const nameSpan = document.createElement("span");
      nameSpan.className = "player-name-short";
      nameSpan.textContent = player.name;
      th.appendChild(swatch);
      th.appendChild(nameSpan);
      headRow.appendChild(th);
    });
    headRow.appendChild(document.createElement("th"));
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    [...state.games].reverse().forEach((game, revIdx) => {
      const gameNumber = state.games.length - revIdx;
      const max = Math.max(...state.players.map((p) => game.scores[p.id] || 0));
      const date = new Date(game.timestamp);
      const dateStr = date.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
        " " + date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

      const row = document.createElement("tr");
      row.className = "history-row";

      const labelTd = document.createElement("td");
      labelTd.className = "row-label";
      labelTd.innerHTML = `<span class="row-game-num">G${gameNumber}</span><span class="row-game-date">${dateStr}</span>`;
      row.appendChild(labelTd);

      state.players.forEach((player) => {
        const td = document.createElement("td");
        const score = game.scores[player.id] || 0;
        const isWinner = score === max && max > 0;
        if (isWinner) {
          td.className = "cell-winner";
          td.innerHTML = `<span class="trophy">🏆</span>${score}`;
        } else {
          td.textContent = String(score);
        }
        row.appendChild(td);
      });

      const actionsTd = document.createElement("td");
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "icon-btn delete-game-btn";
      deleteBtn.title = "Delete this game";
      deleteBtn.textContent = "🗑";
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!confirm(`Delete Game ${gameNumber}? This can't be undone.`)) return;
        state.games = state.games.filter((g) => g.id !== game.id);
        saveState(state);
        renderLeaderboard();
        renderHistory();
      });
      actionsTd.appendChild(deleteBtn);
      row.appendChild(actionsTd);

      row.addEventListener("click", (e) => {
        if (e.target.closest(".delete-game-btn")) return;
        if (expandedGames.has(game.id)) expandedGames.delete(game.id);
        else expandedGames.add(game.id);
        renderHistory();
      });

      tbody.appendChild(row);

      if (expandedGames.has(game.id)) {
        const detailRow = document.createElement("tr");
        detailRow.className = "history-detail-row";
        const detailTd = document.createElement("td");
        detailTd.colSpan = state.players.length + 2;
        detailTd.innerHTML = buildBreakdownDetailHtml(game);
        detailRow.appendChild(detailTd);
        tbody.appendChild(detailRow);
      }
    });

    table.appendChild(tbody);
  }

  // ---------- Cheatsheet ----------
  $("#cheatsheet-toggle").addEventListener("click", () => {
    const panel = $("#cheatsheet-panel");
    panel.hidden = !panel.hidden;
  });

  // ---------- Export / Import ----------
  $("#export-btn").addEventListener("click", () => {
    if (!state) return;
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `harmonies-session-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  $("#import-btn").addEventListener("click", () => $("#import-file").click());
  $("#import-file").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed.players || !Array.isArray(parsed.players) || !Array.isArray(parsed.games)) {
          throw new Error("Invalid file");
        }
        state = parsed;
        saveState(state);
        showTracker();
      } catch {
        alert("That file doesn't look like a valid Harmonies session export.");
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  });

  // ---------- New session ----------
  $("#new-session-btn").addEventListener("click", () => {
    if (!confirm("Start a brand new session? Current session history will be cleared (export first if you want to keep it).")) return;
    localStorage.removeItem(STATE_KEY);
    state = null;
    setupCount = (loadLastSetup() || []).length || 2;
    if (setupCount < 2 || setupCount > 4) setupCount = 2;
    setupPlayers = buildDefaultSetupPlayers(setupCount);
    showSetup();
  });

  // ---------- Screen switching ----------
  function showTracker() {
    $("#setup-screen").hidden = true;
    $("#tracker-screen").hidden = false;
    renderScoreEntryTable();
    renderLeaderboard();
    renderHistory();
  }

  // ---------- Init ----------
  if (state && Array.isArray(state.players) && state.players.length >= 2) {
    showTracker();
  } else {
    showSetup();
  }
})();
