// npm run winrate: plays seeded games with "the student" (the policy that
// follows the coach) and each ablation against Beginner, Club and Shark
// tables, then prints the Markdown tables for docs/STRATEGY.md.
//
//   npm run winrate                         # 400 games per policy per table
//   npm run winrate -- --games 100 --tables club --policies student,no-defense
//   npm run winrate -- --json logs/winrate.json   # also save every game record
//
// Games run in parallel worker threads. Game i uses seed `winrate-i` and seat
// i mod 4 for every policy, so the comparisons are paired.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Worker, isMainThread, parentPort, workerData } = require('node:worker_threads');

require('./ts-register');

const sim = require('../src/game/sim');

function runWorker() {
  const { policy, table, start, games, seedPrefix } = workerData;
  const records = sim.runGames(sim.policyById(policy), { table, start, games, seedPrefix });
  parentPort.postMessage(records);
}

function parseArgs(argv) {
  const args = { games: 400, tables: ['beginner', 'club', 'shark'], policies: sim.POLICIES.map((p) => p.id) };
  args.workers = Math.max(1, os.availableParallelism() - 1);
  args.seedPrefix = sim.DEFAULT_SEED_PREFIX;
  for (let i = 0; i < argv.length; i++) {
    const [flag, value] = [argv[i], argv[i + 1]];
    if (flag === '--games') args.games = Number(value);
    else if (flag === '--tables') args.tables = value.split(',');
    else if (flag === '--policies') args.policies = value.split(',');
    else if (flag === '--workers') args.workers = Number(value);
    else if (flag === '--seed') args.seedPrefix = value;
    else if (flag === '--json') args.json = value;
    else throw new Error(`Unknown option ${flag}`);
    i++;
  }
  if (!Number.isInteger(args.games) || args.games < 1) throw new Error('--games must be a positive whole number');
  for (const p of args.policies) if (!sim.policyById(p)) throw new Error(`Unknown policy ${p}`);
  if (!args.policies.includes(sim.STUDENT.id)) args.policies.unshift(sim.STUDENT.id);
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const CHUNK = 50;
  const jobs = [];
  for (const table of args.tables) {
    for (const policy of args.policies) {
      for (let start = 0; start < args.games; start += CHUNK) {
        jobs.push({ policy, table, start, games: Math.min(CHUNK, args.games - start), seedPrefix: args.seedPrefix });
      }
    }
  }
  const results = new Map();
  let done = 0;
  const began = Date.now();
  const total = jobs.length;
  const runJob = (job) =>
    new Promise((resolve, reject) => {
      const worker = new Worker(__filename, { workerData: job });
      worker.once('message', (records) => {
        const key = `${job.policy}|${job.table}`;
        if (!results.has(key)) results.set(key, []);
        results.get(key).push({ start: job.start, records });
        done++;
        const secs = (Date.now() - began) / 1000;
        process.stderr.write(`\r${done}/${total} chunks · ${secs.toFixed(0)}s elapsed · ~${((secs / done) * (total - done)).toFixed(0)}s left   `);
        resolve();
      });
      worker.once('error', reject);
    });
  const queue = [...jobs];
  await Promise.all(
    Array.from({ length: Math.min(args.workers, jobs.length) }, async () => {
      while (queue.length) await runJob(queue.shift());
    }),
  );
  process.stderr.write('\n');

  const runs = [];
  for (const table of args.tables) {
    for (const policy of args.policies) {
      const chunks = results.get(`${policy}|${table}`).sort((a, b) => a.start - b.start);
      runs.push({ policy, table, records: chunks.flatMap((c) => c.records) });
    }
  }
  if (args.json) {
    fs.mkdirSync(path.dirname(path.resolve(args.json)), { recursive: true });
    fs.writeFileSync(args.json, JSON.stringify({ args, runs }, null, 1));
  }
  const minutes = ((Date.now() - began) / 60000).toFixed(1);
  console.log(`${args.games} games per policy per table (seeds ${args.seedPrefix}-0…${args.games - 1}), ${minutes} min\n`);
  console.log(sim.formatReport(runs));
}

if (isMainThread) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
} else {
  runWorker();
}
