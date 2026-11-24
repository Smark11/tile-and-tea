#!/usr/bin/env bash
# Agentic build loop with independent reviewers.
#
# For each backlog task:
#   1. Builder agent implements it (doesn't commit).
#   2. Design, Rules/IP, Code and Winning-Strategy reviewers run in parallel. They're read-only
#      and must end with "VERDICT: APPROVE" or "VERDICT: CHANGES_REQUESTED".
#   3. If any reviewer requests changes, the builder fixes them and the
#      reviewers run again (up to MAX_REVIEW_ROUNDS).
#   4. Once all approve, the loop commits. Otherwise it stops for a human.
# Stops at 🛑 CHECKPOINT lines, on BLOCKED, or after MAX_ITERS.
#
#   ./scripts/loop.sh              # run until the next checkpoint
#   MAX_ITERS=3 ./scripts/loop.sh  # cap iterations
#   ./scripts/loop.sh --pass       # you've reviewed the app: clear the next checkpoint, then run
set -euo pipefail
cd "$(dirname "$0")/.."

MAX_ITERS="${MAX_ITERS:-20}"
MAX_REVIEW_ROUNDS="${MAX_REVIEW_ROUNDS:-3}"
BUILD_BUDGET="${BUILD_BUDGET:-8}"     # USD cap per builder run
REVIEW_BUDGET="${REVIEW_BUDGET:-2}"   # USD cap per reviewer run
MODEL="${MODEL:-opus}"
REVIEWERS=(design rules code strategy)
mkdir -p logs

BUILDER_TOOLS="Read Edit Write Glob Grep Bash(npm *) Bash(npx *) Bash(git status*) Bash(git diff*) Bash(git log*) Bash(ls *) Bash(cat *) Bash(mkdir *) Bash(rm *) Bash(mv *) Bash(node *) WebFetch(domain:docs.expo.dev) WebFetch(domain:reactnative.dev)"
REVIEWER_TOOLS="Read Glob Grep Bash(git diff*) Bash(git status*) Bash(git log*) Bash(npx tsc *) Bash(npx expo lint*) Bash(npm test*) Bash(ls *)"

if [[ "${1:-}" == "--pass" ]]; then
  awk 'BEGIN{d=0} /^## 🛑 CHECKPOINT/ && !d {sub(/🛑 CHECKPOINT/, "✅ CHECKPOINT PASSED"); d=1} {print}' \
    tasks/BACKLOG.md > tasks/BACKLOG.md.tmp && mv tasks/BACKLOG.md.tmp tasks/BACKLOG.md
  git add tasks/BACKLOG.md && git commit -qm "Checkpoint passed" || true
  echo "Checkpoint cleared."
fi

# An interrupted or rejected task is saved in logs/.pending (stamp, then task line),
# so the next run resumes it instead of starting the next task on top of it.
PENDING=logs/.pending
pause() {  # $1 = message, $2 = exit code
  printf '%s\n%s\n' "$stamp" "$line" > "$PENDING"
  echo "$1"; exit "$2"
}

next_line() {  # first remaining todo or checkpoint line
  grep -m1 -E '^- \[ \]|^## 🛑 CHECKPOINT' tasks/BACKLOG.md || true
}

build() {  # $1 = prompt, $2 = log file
  claude -p "$1" --model "$MODEL" --permission-mode acceptEdits \
    --allowedTools "$BUILDER_TOOLS" --max-budget-usd "$BUILD_BUDGET" 2>&1 | tee "$2"
}

review() {  # $1 = reviewer name, $2 = task line, $3 = output file
  local prompt
  prompt="$(cat "reviewers/$1.md")

## Task under review
$2

## Output format
List each issue as: **[blocking|minor]** file:line, what's wrong, and the concrete fix.
Request changes only for blocking issues. End your reply with exactly one line:
VERDICT: APPROVE   or   VERDICT: CHANGES_REQUESTED"
  claude -p "$prompt" --model "$MODEL" --allowedTools "$REVIEWER_TOOLS" \
    --disallowedTools "Edit Write NotebookEdit" --max-budget-usd "$REVIEW_BUDGET" > "$3" 2>&1 || true
}

for ((i = 1; i <= MAX_ITERS; i++)); do
  if [[ -f "$PENDING" ]]; then
    stamp="$(sed -n 1p "$PENDING")"; line="$(sed -n 2p "$PENDING")"; rm "$PENDING"
    echo "↻ Resuming: $line"
    # Feed back the rejecting reviews from the last round, if there was one.
    feedback=""
    # `|| true`: a task resumed before any review has no such logs, and pipefail would end the script here.
    last="$(ls logs/$stamp-review*-*.md 2>/dev/null | sed -E 's/.*review([0-9]+)-.*/\1/' | sort -n | tail -1 || true)"
    if [[ -n "$last" ]]; then
      for f in logs/$stamp-review$last-*.md; do
        grep -q "VERDICT: APPROVE" "$f" || feedback+=$'\n\n'"### $(basename "$f")"$'\n'"$(cat "$f")"
      done
    fi
    stamp="$(date +%Y%m%d-%H%M%S)"
    out="$(build "Follow CLAUDE.md. You are resuming the current task, which an earlier run left unfinished or not yet approved (do not start a new task, do not commit). Finish it, address every blocking review issue below, re-verify, and update tasks/PROGRESS.md.
Task: $line
$feedback" "logs/$stamp-resume.log" || true)"
  else
  line="$(next_line)"
  if [[ -z "$line" ]]; then echo "🎉 Backlog complete."; exit 0; fi
  if [[ "$line" == "## 🛑 CHECKPOINT"* ]]; then
    echo; echo "$line"
    echo "Try the app:  cd app && npx expo start"
    echo "When happy:   ./scripts/loop.sh --pass"
    exit 0
  fi

  stamp="$(date +%Y%m%d-%H%M%S)"
  echo "▶ Iteration $i: $line"
  out="$(build "Follow CLAUDE.md. Implement the next backlog task and verify it. Do not commit." "logs/$stamp-build.log" || true)"
  fi
  if grep -qiE "hit your .*limit|usage limit" <<<"$out"; then
    pause "⏸  Claude usage limit reached. Partial work left uncommitted. Rerun this script after the reset to resume it." 2
  fi
  if grep -q "BLOCKED" <<<"$out"; then
    git add -A && git commit -qm "Blocked: $line" || true
    echo "⛔ Builder reported BLOCKED. See tasks/PROGRESS.md"; exit 1
  fi

  approved=false
  for ((round = 1; round <= MAX_REVIEW_ROUNDS; round++)); do
    echo "  🔍 Review round $round: ${REVIEWERS[*]}"
    for r in "${REVIEWERS[@]}"; do review "$r" "$line" "logs/$stamp-review$round-$r.md" & done
    wait

    if grep -qiE "hit your .*limit" logs/$stamp-review$round-*.md; then
      pause "⏸  Claude usage limit reached during review. Work left uncommitted. Rerun after the reset to resume it." 2
    fi
    feedback=""
    for r in "${REVIEWERS[@]}"; do
      f="logs/$stamp-review$round-$r.md"
      if grep -q "VERDICT: APPROVE" "$f"; then
        echo "     ✅ $r"
      else
        echo "     ❌ $r  ($f)"
        feedback+=$'\n\n'"### $r reviewer"$'\n'"$(cat "$f")"
      fi
    done
    [[ -z "$feedback" ]] && { approved=true; break; }
    (( round == MAX_REVIEW_ROUNDS )) && break

    echo "  🔧 Fixing review feedback"
    build "Follow CLAUDE.md. You are fixing reviewer feedback on the current task (do not start a new task, do not commit). Address every blocking issue, re-verify, and update tasks/PROGRESS.md.
Task: $line
$feedback" "logs/$stamp-fix$round.log" > /dev/null
  done

  if ! $approved; then
    pause "⛔ Reviewers still not satisfied after $MAX_REVIEW_ROUNDS rounds. Changes left uncommitted; see logs/$stamp-review*.md. Rerun to give it more rounds, or fix by hand." 1
  fi
  if grep -qF -- "$line" tasks/BACKLOG.md; then
    echo "⚠️  Task was not marked done in the backlog. Stopping; see logs/$stamp-build.log"; exit 1
  fi
  id="$(sed -E 's/^- \[.\] \*\*([^ ]+) .*/\1/' <<<"$line")"
  git add -A && git commit -qm "$id: reviewed and approved (design, rules, code, strategy)"
  echo "  📦 Committed $id"
done
echo "Reached MAX_ITERS=$MAX_ITERS."
