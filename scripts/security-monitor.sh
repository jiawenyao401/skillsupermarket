#!/usr/bin/env bash
# Production host integrity monitor. It is intentionally read-only in check
# mode: preserve evidence and alert first; never kill, delete, quarantine, or
# rotate credentials automatically.

set -Eeuo pipefail
umask 077

PROJECT_DIR="${PROJECT_DIR:-/opt/skillsupermarket}"
STATE_DIR="${SECURITY_STATE_DIR:-/var/lib/skillsupermarket-security}"
MODE="${1:-check}"
CODE_BASELINE="$STATE_DIR/code.sha256"
ACCOUNT_BASELINE="$STATE_DIR/accounts.txt"
KEY_BASELINE="$STATE_DIR/authorized-keys.sha256"
PORT_BASELINE="$STATE_DIR/listeners.txt"
DAILY_STAMP="$STATE_DIR/daily-scan-date"
ALERTS=()
TEMP_DIR_TO_CLEAN=""

cleanup() {
  if [[ -n "$TEMP_DIR_TO_CLEAN" && "$TEMP_DIR_TO_CLEAN" == "$STATE_DIR"/.* ]]; then
    rm -rf -- "$TEMP_DIR_TO_CLEAN"
  fi
}
trap cleanup EXIT

alert() {
  ALERTS+=("$1")
  printf '[security-monitor] ALERT %s\n' "$1" >&2
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    printf '[security-monitor] ERROR missing required command: %s\n' "$1" >&2
    exit 3
  }
}

collect_code_manifest() {
  local output="$1"
  local roots=()
  local candidate
  for candidate in app components lib scripts deploy public .next/server .next/static; do
    [[ -e "$PROJECT_DIR/$candidate" ]] && roots+=("$candidate")
  done
  (
    cd "$PROJECT_DIR"
    {
      if ((${#roots[@]} > 0)); then
        find "${roots[@]}" -type f ! -path '*/cache/*' ! -path '*/diagnostics/*' -print0
      fi
      for candidate in package.json package-lock.json next.config.js ecosystem.config.cjs proxy.ts; do
        [[ -f "$candidate" ]] && printf '%s\0' "$candidate"
      done
    } | LC_ALL=C sort -z | xargs -0 -r sha256sum
  ) >"$output"
}

collect_accounts() {
  if command -v getent >/dev/null 2>&1; then
    getent passwd | awk -F: '$3 == 0 || $7 !~ /(nologin|false|sync)$/ { print $1 ":" $3 ":" $6 ":" $7 }' | LC_ALL=C sort
  else
    awk -F: '$3 == 0 || $7 !~ /(nologin|false|sync)$/ { print $1 ":" $3 ":" $6 ":" $7 }' /etc/passwd | LC_ALL=C sort
  fi
}

collect_authorized_keys() {
  { find /root /home -xdev -type f -path '*/.ssh/authorized_keys' -print0 2>/dev/null || true; } \
    | LC_ALL=C sort -z \
    | xargs -0 -r sha256sum
}

collect_listeners() {
  ss -H -lntup 2>/dev/null \
    | sed -E 's/pid=[0-9]+//g; s/fd=[0-9]+//g; s/users:\(\([^)]*\)\)//g; s/[[:space:]]+/ /g' \
    | LC_ALL=C sort
}

initialize_baseline() {
  if [[ "${SECURITY_BASELINE_APPROVED:-}" != "1" ]]; then
    printf '%s\n' '[security-monitor] Refusing to trust the current host automatically.' >&2
    printf '%s\n' '[security-monitor] Inspect the release, processes, accounts, keys and listeners, then rerun with SECURITY_BASELINE_APPROVED=1.' >&2
    exit 4
  fi
  [[ -d "$PROJECT_DIR" ]] || { printf '[security-monitor] ERROR project missing: %s\n' "$PROJECT_DIR" >&2; exit 3; }
  install -d -m 0700 "$STATE_DIR"
  local temp_dir
  temp_dir="$(mktemp -d "$STATE_DIR/.baseline.XXXXXX")"
  TEMP_DIR_TO_CLEAN="$temp_dir"
  collect_code_manifest "$temp_dir/code.sha256"
  collect_accounts >"$temp_dir/accounts.txt"
  collect_authorized_keys >"$temp_dir/authorized-keys.sha256"
  collect_listeners >"$temp_dir/listeners.txt"
  install -m 0600 "$temp_dir/code.sha256" "$CODE_BASELINE"
  install -m 0600 "$temp_dir/accounts.txt" "$ACCOUNT_BASELINE"
  install -m 0600 "$temp_dir/authorized-keys.sha256" "$KEY_BASELINE"
  install -m 0600 "$temp_dir/listeners.txt" "$PORT_BASELINE"
  printf '[security-monitor] BASELINE_INITIALIZED files=%s accounts=%s keys=%s listeners=%s\n' \
    "$(wc -l <"$CODE_BASELINE" | tr -d ' ')" \
    "$(wc -l <"$ACCOUNT_BASELINE" | tr -d ' ')" \
    "$(wc -l <"$KEY_BASELINE" | tr -d ' ')" \
    "$(wc -l <"$PORT_BASELINE" | tr -d ' ')"
}

check_baselines() {
  local temp_dir="$1"
  local baseline
  for baseline in "$CODE_BASELINE" "$ACCOUNT_BASELINE" "$KEY_BASELINE" "$PORT_BASELINE"; do
    [[ -f "$baseline" ]] || alert "BASELINE_MISSING path=$baseline"
  done
  ((${#ALERTS[@]} == 0)) || return

  collect_code_manifest "$temp_dir/code.sha256"
  collect_accounts >"$temp_dir/accounts.txt"
  collect_authorized_keys >"$temp_dir/authorized-keys.sha256"
  collect_listeners >"$temp_dir/listeners.txt"

  cmp -s "$CODE_BASELINE" "$temp_dir/code.sha256" || alert "CODE_INTEGRITY_CHANGED"
  cmp -s "$ACCOUNT_BASELINE" "$temp_dir/accounts.txt" || alert "LOGIN_ACCOUNT_SET_CHANGED"
  cmp -s "$KEY_BASELINE" "$temp_dir/authorized-keys.sha256" || alert "AUTHORIZED_KEYS_CHANGED"
  cmp -s "$PORT_BASELINE" "$temp_dir/listeners.txt" || alert "LISTENING_PORTS_CHANGED"
}

check_runtime() {
  local app_name
  if command -v pm2 >/dev/null 2>&1; then
    for app_name in skillsupermarket skillsupermarket-evaluator; do
      [[ "$(pm2 pid "$app_name" 2>/dev/null | tail -1)" =~ ^[1-9][0-9]*$ ]] || alert "PM2_APP_NOT_RUNNING name=$app_name"
    done
  else
    alert "PM2_NOT_INSTALLED"
  fi

  local process_path process_target
  for process_path in /proc/[0-9]*/exe; do
    [[ -L "$process_path" ]] || continue
    process_target="$(readlink "$process_path" 2>/dev/null || true)"
    [[ "$process_target" == *' (deleted)' ]] && alert "DELETED_EXECUTABLE_RUNNING proc=$process_path target=$process_target"
  done

  local process_list
  if ! process_list="$(ps -eo pid=,user=,comm=,args= 2>/dev/null)"; then
    alert "PROCESS_LIST_UNAVAILABLE"
  elif grep -Eai '[x]mrig|[m]inerd|[k]insing|[k]devtmpfsi|[c]rypto.?miner|[s]ocat .*exec:|[n]c .*-[el]' <<<"$process_list" >/dev/null; then
    alert "SUSPICIOUS_PROCESS_PATTERN"
  fi

  local recent_executable
  recent_executable="$(find /tmp /var/tmp /dev/shm -xdev -type f -perm /111 -mmin -10 -print -quit 2>/dev/null || true)"
  [[ -z "$recent_executable" ]] || alert "RECENT_TEMP_EXECUTABLE path=$recent_executable"

  local disk_usage
  disk_usage="$(df -P / | awk 'NR == 2 { gsub(/%/, "", $5); print $5 }')"
  [[ "$disk_usage" =~ ^[0-9]+$ ]] && ((disk_usage < 90)) || alert "ROOT_DISK_PRESSURE percent=${disk_usage:-unknown}"
}

check_recent_logs() {
  if command -v journalctl >/dev/null 2>&1; then
    local ssh_failures
    ssh_failures="$(journalctl --since '-10 minutes' --no-pager 2>/dev/null | grep -Eci 'Failed password|Invalid user|authentication failure' || true)"
    ((ssh_failures < 20)) || alert "SSH_FAILURE_BURST count=$ssh_failures"
  fi

  if [[ -r /var/log/nginx/access.log ]]; then
    local server_errors
    server_errors="$(tail -n 1000 /var/log/nginx/access.log | awk '$9 ~ /^5[0-9][0-9]$/ { count++ } END { print count + 0 }')"
    ((server_errors < 50)) || alert "NGINX_5XX_BURST last1000=$server_errors"
  fi
}

run_daily_tools_if_available() {
  local today
  local daily_clean=1
  today="$(date +%F)"
  [[ -f "$DAILY_STAMP" && "$(<"$DAILY_STAMP")" == "$today" ]] && return

  if command -v clamscan >/dev/null 2>&1; then
    local clam_exit=0
    clamscan --recursive --infected --no-summary \
      --exclude-dir='(^|/)(node_modules|\.git|\.next/cache)(/|$)' \
      "$PROJECT_DIR" >/dev/null 2>&1 || clam_exit=$?
    if ((clam_exit != 0)); then
      alert "CLAMAV_NONZERO exit=$clam_exit"
      daily_clean=0
    fi
  fi
  if command -v rkhunter >/dev/null 2>&1; then
    if ! rkhunter --check --skip-keypress --report-warnings-only --nolog >/dev/null 2>&1; then
      alert "RKHUNTER_WARNING"
      daily_clean=0
    fi
  fi
  ((daily_clean == 1)) && printf '%s\n' "$today" >"$DAILY_STAMP"
}

main() {
  require_command sha256sum
  require_command ss
  case "$MODE" in
    --init) initialize_baseline; return ;;
    check) ;;
    *) printf 'Usage: %s [check|--init]\n' "$0" >&2; exit 64 ;;
  esac

  [[ -d "$PROJECT_DIR" ]] || { alert "PROJECT_DIRECTORY_MISSING path=$PROJECT_DIR"; }
  install -d -m 0700 "$STATE_DIR"
  local temp_dir
  temp_dir="$(mktemp -d "$STATE_DIR/.check.XXXXXX")"
  TEMP_DIR_TO_CLEAN="$temp_dir"
  check_baselines "$temp_dir"
  check_runtime
  check_recent_logs
  run_daily_tools_if_available

  if ((${#ALERTS[@]} > 0)); then
    printf '[security-monitor] RESULT compromised_or_changed alerts=%s\n' "${#ALERTS[@]}" >&2
    exit 2
  fi
  printf '[security-monitor] RESULT healthy checked_at=%s\n' "$(date -Iseconds)"
}

main "$@"
