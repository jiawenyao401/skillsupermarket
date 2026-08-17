#!/usr/bin/env bash
# 服务器侧数据流水线（由 systemd timer 每 6 小时触发）
# 流程: collect -> rank -> IndexNow -> snapshot
# 不 push 到 GitHub (服务器网络封了, 改为导出快照, 本地拉)
# 服务器路径: /opt/skillsupermarket/scripts/daily-pipeline.sh

set -Eeuo pipefail
umask 027

PROJECT_DIR="${PROJECT_DIR:-/opt/skillsupermarket}"
LOG_DIR="${LOG_DIR:-/var/log/skillsupermarket}"
LOCK_FILE="${LOCK_FILE:-/run/lock/skillsupermarket-pipeline.lock}"
cd "$PROJECT_DIR"

mkdir -p "$LOG_DIR" "$(dirname "$LOCK_FILE")"
LOG_FILE="$LOG_DIR/pipeline-$(date +%Y%m%d).log"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] 流水线已有实例运行，本次跳过" | tee -a "$LOG_FILE"
  exit 0
fi

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log "========== 每日流水线开始 =========="

# 1. 采集
log "--- 1. collect ---"
npm run collect 2>&1 | tee -a "$LOG_FILE"
log "✅ collect 完成"

# 2. 榜单（评测由常驻 Worker 独立处理）
log "--- 2. rank ---"
npm run rank 2>&1 | tee -a "$LOG_FILE"
log "✅ rank 完成"

# 3. 主动通知支持 IndexNow 的搜索引擎（失败不阻断数据流水线）
log "--- 3. indexnow ---"
if npm run indexnow 2>&1 | tee -a "$LOG_FILE"; then
  log "✅ IndexNow 提交完成"
else
  log "⚠️ IndexNow 提交失败，将在下一轮重试"
fi

# 4. 导出快照 (失败不影响已生成的线上榜单)
log "--- 4. snapshot ---"
if SNAPSHOT_STAMP=$(npm run --silent snapshot 2>&1 | tail -1); then
  log "✅ 快照: $SNAPSHOT_STAMP"
else
  log "⚠️ 快照导出失败，榜单仍已成功生成"
fi

log "========== 每日流水线完成 =========="
