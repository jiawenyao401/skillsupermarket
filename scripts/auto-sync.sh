#!/bin/bash
# 自动同步脚本
# 流程: 导出 DB 快照 -> git add -> commit -> push
# 用法:
#   bash scripts/auto-sync.sh                    # 同步当前数据
#   bash scripts/auto-sync.sh "采集完成"          # 带 message 的 commit
#   bash scripts/auto-sync.sh "采集完成" --force  # 即使没变化也 commit

set -e

PROJECT_DIR="${PROJECT_DIR:-/opt/skillsupermarket}"
COMMIT_MSG="${1:-data sync}"
FORCE="${2:-}"

cd "$PROJECT_DIR"

echo "=== [auto-sync] 开始同步 ==="
echo "项目目录: $PROJECT_DIR"
echo "Commit: $COMMIT_MSG"

# 1. 导出数据快照
echo ""
echo "--- 1. 导出数据快照 ---"
SNAPSHOT_STAMP=$(npx tsx scripts/export-snapshot.ts 2>&1 | tail -1)
echo "快照: $SNAPSHOT_STAMP"

# 公开 Git 同步只能包含显式允许的数据文件。历史目录中若残留过
# evaluation_jobs 等内部快照，立即拒绝提交，避免一次误操作永久泄露。
while IFS= read -r SNAPSHOT_FILE; do
  case "$(basename "$SNAPSHOT_FILE")" in
    skills.json|evaluations.json|metrics_daily.json|rankings.json|meta.json|latest) ;;
    *)
      echo "=== [auto-sync] ❌ 拒绝同步非公开快照: $SNAPSHOT_FILE ==="
      exit 1
      ;;
  esac
done < <(find data/snapshots -type f -print)

# 2. git 操作
echo ""
echo "--- 2. 检查 git 状态 ---"
git status -s

# 3. add + 检查是否有变化
git add data/snapshots/

# 统计 diff
DIFF_LINES=$(git diff --cached --stat 2>/dev/null | tail -1)
echo "变化: $DIFF_LINES"

if [ -z "$DIFF_LINES" ] && [ "$FORCE" != "--force" ]; then
  echo ""
  echo "=== [auto-sync] 无变化, 跳过 commit ==="
  exit 0
fi

# 4. commit
echo ""
echo "--- 3. commit ---"
COMMIT_FULL="chore(data): $COMMIT_MSG

Snapshot: $SNAPSHOT_STAMP

🤖 Generated with auto-sync"

git commit -m "$COMMIT_FULL" 2>&1 | tail -3

# 5. push
echo ""
echo "--- 4. push ---"
if git push origin main 2>&1 | tail -3; then
  echo ""
  echo "=== [auto-sync] ✅ 同步完成 ==="
  echo "查看: https://github.com/jiawenyao401/skillsupermarket"
else
  echo ""
  echo "=== [auto-sync] ❌ push 失败 ==="
  echo "可能原因: 网络问题 / 凭证问题 / 远端有冲突"
  echo "手动处理: cd $PROJECT_DIR && git pull --rebase && git push origin main"
  exit 1
fi
