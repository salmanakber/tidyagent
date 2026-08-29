#!/usr/bin/env bash
# Run on the production server (SSH) to leave exactly one PM2 app: tidyagent on 127.0.0.1:5070
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== PM2 before ==="
pm2 list || true

echo ""
echo "=== Stop and remove all PM2 apps ==="
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true

echo ""
echo "=== Kill stray Node on dev/production ports ==="
for port in 3000 3001 3002 5070; do
  if command -v lsof >/dev/null 2>&1; then
    pids=$(lsof -ti :"$port" 2>/dev/null || true)
    if [ -n "${pids:-}" ]; then
      echo "Port $port — killing: $pids"
      kill $pids 2>/dev/null || true
      sleep 1
      kill -9 $pids 2>/dev/null || true
    fi
  fi
done

echo ""
echo "=== Start single tidyagent (ecosystem.config.cjs) ==="
pm2 start ecosystem.config.cjs
pm2 save

echo ""
echo "=== PM2 after ==="
pm2 list

echo ""
echo "=== Ports listening (should be 127.0.0.1:5070 only, not 0.0.0.0:3001) ==="
if command -v ss >/dev/null 2>&1; then
  ss -tlnp | grep -E ':300[0-9]|:5070' || echo "(no 300x/5070 listeners)"
elif command -v lsof >/dev/null 2>&1; then
  lsof -iTCP -sTCP:LISTEN -P -n | grep -E ':300[0-9]|:5070' || echo "(no 300x/5070 listeners)"
fi

echo ""
echo "Done. Public traffic should use https://agent.tidyflowapp.com (nginx → 127.0.0.1:5070)."
echo "If :3001 still works from the internet, close it: sudo ufw deny 3001 && sudo ufw reload"
