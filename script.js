/*
 * JavaScript to power the sweepstake site.
 *
 * Defines the list of players and their allocated teams, builds
 * the leaderboard display, and fetches current match results
 * from the WorldCupJSON API. When new matches finish, the
 * results list will update automatically on refresh.
 */

// List of players with their sweepstake teams. Each team has a
// 'type' property which controls the colour (gold, silver or bronze).
const players = [
  {
    name: 'John',
    teams: [
      { name: 'Brazil', type: 'gold' },
      { name: 'Senegal', type: 'silver' },
      { name: 'DR Congo', type: 'bronze' },
      { name: 'Australia', type: 'bronze' },
      { name: 'Bosnia & Herzegovina', type: 'bronze' },
    ],
  },
  {
    name: 'Kirsty',
    teams: [
      { name: 'France', type: 'gold' },
      { name: 'Norway', type: 'silver' },
      { name: 'Algeria', type: 'bronze' },
      { name: 'Egypt', type: 'bronze' },
      { name: 'Ecuador', type: 'bronze' },
    ],
  },
  {
    name: 'Amelia',
    teams: [
      { name: 'Spain', type: 'gold' },
      { name: 'Turkiye', type: 'silver' },
      { name: 'South Korea', type: 'bronze' },
      { name: 'Scotland', type: 'bronze' },
      { name: 'South Africa', type: 'bronze' },
    ],
  },
  {
    name: 'Felicity',
    teams: [
      { name: 'England', type: 'gold' },
      { name: 'Switzerland', type: 'silver' },
      { name: 'Iran', type: 'bronze' },
      { name: 'Ghana', type: 'bronze' },
      { name: 'Panama', type: 'bronze' },
    ],
  },
  {
    name: 'Julie',
    teams: [
      { name: 'Belgium', type: 'gold' },
      { name: 'Croatia', type: 'silver' },
      { name: 'Iraq', type: 'bronze' },
      { name: 'Ivory Coast', type: 'bronze' },
    ],
  },
  {
    name: 'Ian',
    teams: [
      { name: 'Uruguay', type: 'gold' },
      { name: 'United States', type: 'silver' },
      { name: 'Haiti', type: 'bronze' },
      { name: 'New Zealand', type: 'bronze' },
      { name: 'Tunisia', type: 'bronze' },
    ],
  },
  {
    name: 'Samantha',
    teams: [
      { name: 'Portugal', type: 'gold' },
      { name: 'Japan', type: 'silver' },
      { name: 'Uzbekistan', type: 'bronze' },
      { name: 'Austria', type: 'bronze' },
      { name: 'Czechia', type: 'bronze' },
    ],
  },
  {
    name: 'Andrew',
    teams: [
      { name: 'Netherlands', type: 'gold' },
      { name: 'Morocco', type: 'silver' },
      { name: 'Cabo Verde', type: 'bronze' },
      { name: 'Saudi Arabia', type: 'bronze' },
    ],
  },
  {
    name: 'George',
    teams: [
      { name: 'Argentina', type: 'gold' },
      { name: 'Colombia', type: 'silver' },
      { name: 'Sweden', type: 'bronze' },
      { name: 'Jordan', type: 'bronze' },
      { name: 'Curaçao', type: 'bronze' },
    ],
  },
  {
    name: 'Sophie',
    teams: [
      { name: 'Germany', type: 'gold' },
      { name: 'Mexico', type: 'silver' },
      { name: 'Qatar', type: 'bronze' },
      { name: 'Paraguay', type: 'bronze' },
      { name: 'Canada', type: 'bronze' },
    ],
  },
];

// Build player cards in the leaderboard section
function renderPlayers() {
  const container = document.getElementById('players');
  container.innerHTML = '';
  players.forEach((player) => {
    const card = document.createElement('div');
    card.className = 'player-card';
    const nameElem = document.createElement('h3');
    nameElem.textContent = player.name;
    card.appendChild(nameElem);
    const list = document.createElement('ul');
    list.className = 'team-list';
    player.teams.forEach((team) => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="${team.type}">${team.name}</span>`;
      list.appendChild(li);
    });
    card.appendChild(list);
    container.appendChild(card);
  });
}

// Fetch match results from the API and display them
async function loadMatches() {
  const loadingElem = document.getElementById('fixtures-loading');
  const listElem = document.getElementById('match-results');
  try {
    const response = await fetch('https://worldcupjson.net/matches');
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }
    const matches = await response.json();
    // Filter out matches that have a valid score (final or in progress)
    const completed = matches.filter((m) =>
      m.home_team && m.away_team && m.home_team_events && m.away_team_events
    );
    listElem.innerHTML = '';
    if (completed.length === 0) {
      listElem.innerHTML = '<li>No match results available yet.</li>';
    } else {
      completed.slice(0, 10).forEach((match) => {
        const li = document.createElement('li');
        const homeTeam = match.home_team.name;
        const awayTeam = match.away_team.name;
        const homeGoals = match.home_team.goals || 0;
        const awayGoals = match.away_team.goals || 0;
        const status = match.status;
        li.textContent = `${homeTeam} ${homeGoals} – ${awayGoals} ${awayTeam} (${status})`;
        listElem.appendChild(li);
      });
    }
  } catch (error) {
    listElem.innerHTML = '';
    const li = document.createElement('li');
    li.textContent = 'Failed to load results: ' + error.message;
    listElem.appendChild(li);
  } finally {
    loadingElem.style.display = 'none';
  }
}

// Initialise the page on load
window.addEventListener('DOMContentLoaded', () => {
  renderPlayers();
  loadMatches();
});