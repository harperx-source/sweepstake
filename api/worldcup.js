const WORLDCUP_JSON_BASE_URL = process.env.WORLDCUP_JSON_BASE_URL || "https://worldcupjson.net";
const TIME_ZONE = "Europe/London";

const teamAliases = {
  "Cape Verde Islands": "Cabo Verde",
  "Côte d'Ivoire": "Ivory Coast",
  "Cote d'Ivoire": "Ivory Coast",
  "Czech Republic": "Czechia",
  "Iran": "IR Iran",
  "Korea Republic": "South Korea",
  "Turkey": "Türkiye",
  "United States": "USA",
  "United States of America": "USA"
};

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");

  try {
    const [matches, teams] = await Promise.all([
      worldCupJson("/matches"),
      worldCupJson("/teams").catch(() => [])
    ]);

    return res.status(200).json({
      provider: "WorldCupJSON",
      updatedAt: new Date().toISOString(),
      fixtures: arrayOf(matches).map(normalizeMatch).filter(match => match.team1 && match.team2),
      standings: arrayOf(teams).map(normalizeTeamStanding).filter(row => row.team)
    });
  } catch (error) {
    return res.status(502).json({
      error: "WorldCupJSON request failed",
      detail: error.message
    });
  }
};

async function worldCupJson(path) {
  const response = await fetch(`${WORLDCUP_JSON_BASE_URL}${path}`, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`worldcupjson.net returned ${response.status}`);
  }

  return response.json();
}

function normalizeMatch(match) {
  const kickoff = match.datetime ? new Date(match.datetime) : null;
  const home = match.home_team || {};
  const away = match.away_team || {};
  const group = match.group || match.group_letter || match.group_name || match.stage_name || "";

  return {
    id: String(match.id || match.fifa_id || ""),
    date: kickoff && !Number.isNaN(kickoff.valueOf()) ? formatDate(kickoff) : match.date || "",
    time: kickoff && !Number.isNaN(kickoff.valueOf()) ? formatTime(kickoff) : match.time || "",
    group: cleanGroup(group),
    team1: cleanTeam(match.home_team_country || home.country || home.name),
    team2: cleanTeam(match.away_team_country || away.country || away.name),
    venue: match.venue || match.location || "",
    status: cleanStatus(match.status),
    score1: numberOrNull(match.home_team_score ?? home.goals),
    score2: numberOrNull(match.away_team_score ?? away.goals),
    stage: match.stage_name || match.stage || ""
  };
}

function normalizeTeamStanding(team) {
  const wins = numberOrZero(team.wins);
  const draws = numberOrZero(team.draws);
  const losses = numberOrZero(team.losses);
  const goalsFor = numberOrZero(team.goals_for);
  const goalsAgainst = numberOrZero(team.goals_against);

  return {
    group: cleanGroup(team.group_letter || team.group || team.group_id || ""),
    team: cleanTeam(team.country || team.name),
    p: numberOrZero(team.games_played ?? team.played),
    w: wins,
    d: draws,
    l: losses,
    gf: goalsFor,
    ga: goalsAgainst,
    gd: numberOrZero(team.goal_differential ?? goalsFor - goalsAgainst),
    pts: numberOrZero(team.points ?? wins * 3 + draws)
  };
}

function arrayOf(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.matches)) return value.matches;
  if (Array.isArray(value?.teams)) return value.teams;
  return [];
}

function cleanTeam(name = "") {
  return teamAliases[name] || name;
}

function cleanGroup(group = "") {
  return String(group).replace(/^Group\s+/i, "");
}

function cleanStatus(status = "") {
  const normalized = String(status).toLowerCase();
  if (["in progress", "in_progress", "live"].includes(normalized)) return "live";
  if (["completed", "complete", "finished", "full-time", "full time"].includes(normalized)) return "finished";
  if (["postponed", "suspended", "cancelled"].includes(normalized)) return normalized;
  return "scheduled";
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function numberOrZero(value) {
  return numberOrNull(value) ?? 0;
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: TIME_ZONE
  }).format(date);
}

function formatTime(date) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TIME_ZONE
  }).format(date);
}
