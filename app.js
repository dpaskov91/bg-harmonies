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

  const BREAKDOWN_KEYS = [
    "tree1", "tree2", "tree3",
    "mountain1", "mountain2", "mountain3",
    "fields", "river", "buildings", "animals", "spirits",
  ];

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

  let rowRefs = {}; // playerId -> { totalInput, breakdownEl, bdInputs, subtotalEl }

  function renderScoreEntryRows() {
    const container = $("#score-entry-rows");
    const template = $("#score-row-template");
    container.innerHTML = "";
    rowRefs = {};

    state.players.forEach((player) => {
      const node = template.content.cloneNode(true);
      const row = node.querySelector(".score-row");
      node.querySelector(".player-swatch").style.background = colorHex(player.color);
      node.querySelector(".player-name").textContent = player.name;

      const totalInput = node.querySelector(".total-input");
      const breakdownEl = node.querySelector(".score-breakdown");
      const subtotalEl = node.querySelector(".bd-subtotal-value");
      const bdInputs = {};

      $$(".bd-input", node).forEach((inp) => {
        bdInputs[inp.dataset.key] = inp;
        inp.addEventListener("input", () => {
          const bd = {};
          BREAKDOWN_KEYS.forEach((k) => (bd[k] = Number(bdInputs[k].value) || 0));
          const total = computeBreakdownTotal(bd);
          subtotalEl.textContent = String(total);
          totalInput.value = total;
        });
      });

      container.appendChild(node);
      rowRefs[player.id] = { totalInput, breakdownEl, bdInputs, subtotalEl };
    });
  }

  let breakdownVisible = false;
  $("#toggle-breakdown-btn").addEventListener("click", () => {
    breakdownVisible = !breakdownVisible;
    $("#toggle-breakdown-btn").textContent = breakdownVisible ? "Hide breakdown" : "Detailed breakdown";
    Object.values(rowRefs).forEach((r) => (r.breakdownEl.hidden = !breakdownVisible));
  });

  $("#save-game-btn").addEventListener("click", () => {
    const scores = {};
    const breakdowns = {};
    let anyFilled = false;

    state.players.forEach((player) => {
      const ref = rowRefs[player.id];
      const total = Number(ref.totalInput.value);
      if (ref.totalInput.value !== "" && !Number.isNaN(total)) anyFilled = true;
      scores[player.id] = Number.isNaN(total) ? 0 : total;

      const bd = {};
      let hasBreakdown = false;
      BREAKDOWN_KEYS.forEach((k) => {
        const v = Number(ref.bdInputs[k].value) || 0;
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

    renderScoreEntryRows();
    breakdownVisible = false;
    $("#toggle-breakdown-btn").textContent = "Detailed breakdown";
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

  function renderHistory() {
    const list = $("#history-list");
    const empty = $("#history-empty");
    list.innerHTML = "";

    if (!state.games.length) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    [...state.games].reverse().forEach((game, revIdx) => {
      const gameNumber = state.games.length - revIdx;
      const max = Math.max(...state.players.map((p) => game.scores[p.id] || 0));
      const date = new Date(game.timestamp);
      const dateStr = date.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
        " " + date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

      const item = document.createElement("div");
      item.className = "history-item";

      const head = document.createElement("div");
      head.className = "history-item-head";
      head.innerHTML = `
        <div class="history-item-title">Game ${gameNumber} <span class="muted small">· ${dateStr}</span></div>
        <div class="history-item-scores">
          ${state.players.map((p) => {
            const s = game.scores[p.id] || 0;
            const isWinner = s === max && max > 0;
            return `<span class="history-score-chip${isWinner ? " winner" : ""}">${escapeHtml(p.name)}: ${s}</span>`;
          }).join("")}
        </div>
        <div class="history-item-actions">
          <button type="button" class="icon-btn delete-game-btn" title="Delete this game">🗑</button>
        </div>
      `;
      head.addEventListener("click", (e) => {
        if (e.target.closest(".delete-game-btn")) return;
        if (expandedGames.has(game.id)) expandedGames.delete(game.id);
        else expandedGames.add(game.id);
        renderHistory();
      });

      head.querySelector(".delete-game-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        if (!confirm(`Delete Game ${gameNumber}? This can't be undone.`)) return;
        state.games = state.games.filter((g) => g.id !== game.id);
        saveState(state);
        renderLeaderboard();
        renderHistory();
      });

      item.appendChild(head);

      if (expandedGames.has(game.id)) {
        const hasAnyBreakdown = state.players.some((p) => game.breakdowns[p.id]);
        const detail = document.createElement("div");
        detail.className = "history-item-detail";
        if (!hasAnyBreakdown) {
          detail.textContent = "No detailed breakdown recorded for this game.";
        } else {
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
          detail.innerHTML = `<table>
            <thead><tr><th>Player</th><th>Trees</th><th>Mtns</th><th>Fields</th><th>River</th><th>Bldgs</th><th>Animals+Spirit</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>`;
        }
        item.appendChild(detail);
      }

      list.appendChild(item);
    });
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
    renderScoreEntryRows();
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
