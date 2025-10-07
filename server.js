const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Simple health
app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// Data paths
const DATA_DIR = path.join(__dirname, 'data');
const SCORES_FILE = path.join(DATA_DIR, 'scores.json');
const WINNERS_FILE = path.join(DATA_DIR, 'winners.json');

function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
  if (!fs.existsSync(SCORES_FILE)) fs.writeFileSync(SCORES_FILE, JSON.stringify([]));
  if (!fs.existsSync(WINNERS_FILE)) fs.writeFileSync(WINNERS_FILE, JSON.stringify({}));
}

ensureDataFiles();

function getTodayKey() {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// POST /api/score { twitter, wallet, score }
app.post('/api/score', (req, res) => {
  const { twitter, wallet, score } = req.body || {};
  if (typeof score !== 'number' || !Number.isFinite(score) || score < 0) {
    return res.status(400).json({ error: 'Invalid score' });
  }
  const safeTwitter = (twitter || '').toString().slice(0, 40);
  const safeWallet = (wallet || '').toString().slice(0, 100);

  const today = getTodayKey();
  const nowIso = new Date().toISOString();
  const entry = { id: Date.now().toString(36), date: today, score, twitter: safeTwitter, wallet: safeWallet, createdAt: nowIso };

  const scores = JSON.parse(fs.readFileSync(SCORES_FILE, 'utf8'));
  scores.push(entry);
  fs.writeFileSync(SCORES_FILE, JSON.stringify(scores, null, 2));

  res.json({ ok: true, entry });
});

// GET /api/leaderboard/daily?date=YYYY-MM-DD
app.get('/api/leaderboard/daily', (req, res) => {
  const dateKey = (req.query.date || getTodayKey()).toString();
  const scores = JSON.parse(fs.readFileSync(SCORES_FILE, 'utf8'));
  const daily = scores.filter(s => s.date === dateKey).sort((a, b) => b.score - a.score).slice(0, 50);
  res.json({ date: dateKey, leaderboard: daily });
});

// GET /api/winners  -> returns map of date -> winner entry (auto-compute missing)
app.get('/api/winners', (_req, res) => {
  const scores = JSON.parse(fs.readFileSync(SCORES_FILE, 'utf8'));
  const winners = JSON.parse(fs.readFileSync(WINNERS_FILE, 'utf8'));

  const today = getTodayKey();
  const byDate = new Map();
  for (const s of scores) {
    if (!byDate.has(s.date)) byDate.set(s.date, []);
    byDate.get(s.date).push(s);
  }

  for (const [date, list] of byDate.entries()) {
    if (date === today) continue; // do not compute winner for current UTC day
    if (winners[date]) continue;
    const top = [...list].sort((a, b) => b.score - a.score)[0];
    if (top) winners[date] = top;
  }

  fs.writeFileSync(WINNERS_FILE, JSON.stringify(winners, null, 2));
  res.json(winners);
});

// POST /api/winners/compute  -> compute winner for yesterday (idempotent)
app.post('/api/winners/compute', (req, res) => {
  // Compute winners for any date missing up to today-1
  const scores = JSON.parse(fs.readFileSync(SCORES_FILE, 'utf8'));
  const winners = JSON.parse(fs.readFileSync(WINNERS_FILE, 'utf8'));

  const byDate = new Map();
  for (const s of scores) {
    if (!byDate.has(s.date)) byDate.set(s.date, []);
    byDate.get(s.date).push(s);
  }

  for (const [date, list] of byDate.entries()) {
    if (winners[date]) continue;
    const top = [...list].sort((a, b) => b.score - a.score)[0];
    if (top) winners[date] = top;
  }

  fs.writeFileSync(WINNERS_FILE, JSON.stringify(winners, null, 2));
  res.json({ ok: true, winners });
});

// Fallback to index.html
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Virgen Jump server running on http://localhost:${PORT}`);
});


