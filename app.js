const state = {
  players: [],
  fixtures: [],
  live: null,
  liveStatus: {
    label: "Local schedule",
    detail: "Live feed not connected yet"
  },
  standings: {}
};

const weights = { GOLD: 5, SILVER: 3, BRONZE: 1 };
const aliases = {
  "cape verde islands": "cabo verde",
  "cote d'ivoire": "ivory coast",
  "côte d’ivoire": "ivory coast",
  "czech republic": "czechia",
  "iran": "ir iran",
  "korea republic": "south korea",
  "turkey": "turkiye",
  "türkiye": "turkiye",
  "united states": "usa",
  "united states of america": "usa"
};

function normalizeTeam(value = "") {
  const normalized = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  return aliases[normalized] || normalized;
}

function safe(text) {
  return String(text ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

async function loadJson(url, fallback = null) {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`${url} returned ${response.status}`);
    return await response.json();
  } catch (error) {
    return fallback;
  }
}

async function boot() {
  const [allocations, fixtures, overrides, live] = await Promise.all([
    loadJson("data/allocations.json", { players: [] }),
    loadJson("data/fixtures.json", { fixtures: [] }),
    loadJson("data/results-overrides.json", { results: [] }),
    loadJson("/api/worldcup", null)
  ]);

  state.players = allocations.players || [];
  state.fixtures = mergeFixtures(fixtures.fixtures || [], overrides.results || [], live?.fixtures || []);
  state.live = live;
  state.liveStatus = live?.updatedAt
    ? {
        label: live.provider || "Live feed",
        detail: `Updated ${new Date(live.updatedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`
      }
    : {
        label: "Local schedule",
        detail: "Waiting for live API"
      };
  state.standings = live?.standings?.length ? standingsFromFeed(live.standings) : standingsFromFixtures(state.fixtures);

  render();
}

function fixtureKey(fixture) {
  return [normalizeTeam(fixture.team1), normalizeTeam(fixture.team2)].sort().join("::");
}

function mergeFixtures(localFixtures, overrides, liveFixtures) {
  const updates = new Map();
  [...liveFixtures, ...overrides].forEach(fixture => {
    if (fixture?.team1 && fixture?.team2) updates.set(fixtureKey(fixture), fixture);
  });

  return localFixtures.map(local => {
    const update = updates.get(fixtureKey(local));
    if (!update) return local;

    const reversed = normalizeTeam(local.team1) === normalizeTeam(update.team2);
    const score1 = reversed ? update.score2 : update.score1;
    const score2 = reversed ? update.score1 : update.score2;

    return {
      ...local,
      date: update.date || local.date,
      time: update.time || local.time,
      venue: update.venue || local.venue,
      status: update.status || local.status,
      score1: score1 ?? local.score1,
      score2: score2 ?? local.score2,
      stage: update.stage || local.stage || "GROUP_STAGE"
    };
  });
}

function owner(team) {
  for (const player of state.players) {
    const found = player.teams.find(t => normalizeTeam(t.team) === normalizeTeam(team));
    if (found) return { player: player.name, pool: found.pool };
  }

  return { player: "Unassigned", pool: "BRONZE" };
}

function teamStatus(team) {
  const fixtures = state.fixtures.filter(f => sameTeam(f.team1, team) || sameTeam(f.team2, team));
  const live = fixtures.some(f => f.status === "live");
  const played = fixtures.some(f => hasScore(f));
  const remaining = fixtures.some(f => !hasScore(f));

  if (live) return "Live";
  if (played && remaining) return "Active";
  if (played) return "Played";
  return "Scheduled";
}

function sameTeam(a, b) {
  return normalizeTeam(a) === normalizeTeam(b);
}

function hasScore(fixture) {
  return Number.isFinite(fixture.score1) && Number.isFinite(fixture.score2);
}

function playerScore(player) {
  let remaining = 0;
  let potential = 0;
  let points = 0;

  for (const team of player.teams) {
    const row = findStanding(team.team);
    if (teamStatus(team.team) !== "Played") remaining += 1;
    potential += weights[team.pool];
    points += row?.pts || 0;
  }

  return { remaining, potential, points };
}

function findStanding(team) {
  for (const group of Object.values(state.standings)) {
    const row = group.find(item => sameTeam(item.team, team));
    if (row) return row;
  }
  return null;
}

function standingsFromFeed(rows) {
  return rows.reduce((groups, row) => {
    const group = cleanGroup(row.group);
    groups[group] ||= [];
    groups[group].push({ ...row, group, owner: owner(row.team) });
    return groups;
  }, {});
}

function standingsFromFixtures(fixtures) {
  const groups = {};

  for (const fixture of fixtures) {
    const group = cleanGroup(fixture.group);
    groups[group] ||= {};

    for (const team of [fixture.team1, fixture.team2]) {
      groups[group][team] ||= blankStanding(team);
    }

    if (!hasScore(fixture)) continue;

    const home = groups[group][fixture.team1];
    const away = groups[group][fixture.team2];
    applyResult(home, fixture.score1, fixture.score2);
    applyResult(away, fixture.score2, fixture.score1);
  }

  return Object.fromEntries(Object.entries(groups).map(([group, table]) => [
    group,
    Object.values(table).sort(sortStandings)
  ]));
}

function blankStanding(team) {
  return { team, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0, owner: owner(team) };
}

function applyResult(row, goalsFor, goalsAgainst) {
  row.p += 1;
  row.gf += goalsFor;
  row.ga += goalsAgainst;
  row.gd = row.gf - row.ga;
  if (goalsFor > goalsAgainst) {
    row.w += 1;
    row.pts += 3;
  } else if (goalsFor === goalsAgainst) {
    row.d += 1;
    row.pts += 1;
  } else {
    row.l += 1;
  }
}

function sortStandings(a, b) {
  return b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.team.localeCompare(b.team);
}

function cleanGroup(group = "") {
  return String(group).replace(/^Group\s+/i, "");
}

function render() {
  document.getElementById("heroStats").innerHTML = `
    <div class="stat"><b>${state.players.length}</b>Players</div>
    <div class="stat"><b>48</b>Teams</div>
    <div class="stat"><b>${state.fixtures.length}</b>Group fixtures</div>
    <div class="stat"><b>${safe(state.liveStatus.label)}</b>${safe(state.liveStatus.detail)}</div>
  `;

  renderLeaderboard();
  renderNextFixtures();
  renderPlayers();
  renderFixtures();
  renderGroups();
  renderPoolMap();
}

function renderLeaderboard() {
  const rows = [...state.players]
    .sort((a, b) => {
      const scoreA = playerScore(a);
      const scoreB = playerScore(b);
      return scoreB.points - scoreA.points || scoreB.potential - scoreA.potential;
    })
    .map((player, index) => {
      const score = playerScore(player);
      return `
        <div class="leader-row">
          <div class="rank">${index + 1}</div>
          <div>
            <b>${safe(player.name)}</b>
            <div class="muted">${score.remaining} teams live • ${score.points} group pts • ${score.potential} pool value</div>
          </div>
          <div>${index === 0 ? "👑" : "🏆"}</div>
        </div>
      `;
    })
    .join("");

  document.getElementById("leaderboard").innerHTML = rows;
}

function renderNextFixtures() {
  const upcoming = state.fixtures
    .filter(fixture => !hasScore(fixture))
    .slice(0, 5);

  document.getElementById("nextFixtures").innerHTML = upcoming.length
    ? upcoming.map(renderCompactFixture).join("")
    : `<p class="muted">No upcoming fixtures in the current feed.</p>`;
}

function renderCompactFixture(fixture) {
  return `
    <div class="mini-fixture">
      <div>
        <b>${safe(fixture.team1)} v ${safe(fixture.team2)}</b>
        <div class="muted">${safe(fixture.player1)} v ${safe(fixture.player2)} • Group ${safe(cleanGroup(fixture.group))}</div>
      </div>
      <span>${safe(fixture.date)} ${safe(fixture.time)}</span>
    </div>
  `;
}

function renderPlayers() {
  document.getElementById("playerCards").innerHTML = state.players.map(player => `
    <article class="player-card">
      <h3>${safe(player.name)}</h3>
      ${player.teams.map(team => `
        <div class="team">
          <span><span class="badge ${team.pool.toLowerCase()}">${safe(team.pool)}</span> ${safe(team.team)}</span>
          <span class="status ${teamStatus(team.team).toLowerCase()}">${teamStatus(team.team)}</span>
        </div>
      `).join("")}
    </article>
  `).join("");
}

function renderFixtures() {
  const query = (document.getElementById("fixtureSearch")?.value || "").toLowerCase();
  const filtered = state.fixtures.filter(fixture => {
    const haystack = [fixture.team1, fixture.team2, fixture.player1, fixture.player2, fixture.group, fixture.venue].join(" ").toLowerCase();
    return !query || haystack.includes(query);
  });

  document.getElementById("fixtureList").innerHTML = filtered.map(fixture => `
    <div class="fixture-row">
      <div><b>${safe(fixture.date)}</b><br><span class="muted">${safe(fixture.time)}</span></div>
      <div><span class="pill">Group ${safe(cleanGroup(fixture.group))}</span></div>
      <div>
        <div class="match">${safe(fixture.team1)} ${scoreMarkup(fixture)} ${safe(fixture.team2)}</div>
        <div class="muted">${safe(fixture.player1)} v ${safe(fixture.player2)} • ${safe(fixture.venue)}</div>
      </div>
      <div class="status ${safe(fixture.status)}">${safe(fixture.status)}</div>
    </div>
  `).join("");
}

function scoreMarkup(fixture) {
  if (!hasScore(fixture)) return `<span class="muted">v</span>`;
  return `<span class="score">${fixture.score1} - ${fixture.score2}</span>`;
}

function renderGroups() {
  document.getElementById("groupTables").innerHTML = Object.keys(state.standings).sort().map(group => {
    const rows = state.standings[group].sort(sortStandings).map(row => `
      <tr>
        <td>${safe(row.team)}<br><span class="muted">${safe(row.owner?.player || owner(row.team).player)}</span></td>
        <td>${row.p}</td>
        <td>${row.w}</td>
        <td>${row.d}</td>
        <td>${row.l}</td>
        <td>${row.gd}</td>
        <td>${row.pts}</td>
      </tr>
    `).join("");

    return `
      <article class="panel group-table">
        <h2>Group ${safe(group)}</h2>
        <table>
          <thead><tr><th>Team / owner</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </article>
    `;
  }).join("");
}

function renderPoolMap() {
  const teams = state.players.flatMap(player => player.teams.map(team => ({ ...team, player: player.name })));

  document.getElementById("poolMap").innerHTML = teams.map(team => {
    const row = findStanding(team.team);
    return `
      <div class="pool-card">
        <span class="badge ${team.pool.toLowerCase()}">${safe(team.pool)}</span>
        <h3>${safe(team.team)}</h3>
        <p class="muted">${safe(team.player)}${row ? ` • ${row.pts} pts` : ""}</p>
      </div>
    `;
  }).join("");
}

document.querySelectorAll(".tabs button").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tabs button,.tab").forEach(item => item.classList.remove("active"));
    button.classList.add("active");
    document.getElementById(button.dataset.tab).classList.add("active");
  });
});

document.addEventListener("input", event => {
  if (event.target.id === "fixtureSearch") renderFixtures();
});

boot();
