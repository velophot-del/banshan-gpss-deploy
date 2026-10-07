#!/usr/bin/env bash
# =============================================================================
# 半山学堂 + 毕业设计管理系统（GPSS）一键升级
#
# 适用拓扑：/opt/banshan-gpss-deploy/ 下的 docker compose 单机编排
#   gpss-app      ← 构建上下文 ./gpss              (3011)  前端产物 /app/dist
#   banshan-app   ← 构建上下文 ./banshan-academy   (3012)  前端产物 /app/client/dist
#   banshan-nginx / banshan-gpss-mysql
#
# 用法：
#   bash upgrade.sh <升级包.tar.gz> [升级包.tar.gz.sha256] [选项]
# 例：
#   bash upgrade.sh /tmp/gpss-upgrade-20260912-1446.tar.gz \
#                   /tmp/gpss-upgrade-20260912-1446.tar.gz.sha256 --build
#
# -----------------------------------------------------------------------------
# 核心原则
# -----------------------------------------------------------------------------
#   任何涉及前端/后端源码变更的部署，都必须带 --build 重建镜像。
#
#   只把源码同步进 gpss/ 或 banshan-academy/ 而不重建镜像，容器里跑的仍然是
#   构建时打进镜像的旧产物 —— 源码是新的、"升级成功"，但页面永远不变。
#   本脚本因此**拒绝**在源码发生变化时省略 --build（除非显式 --sync-only）。
#
#   并且：重建后会比对容器内 index.html 的哈希。若源码变了而产物哈希没变，
#   说明构建被缓存命中或镜像未被替换，脚本会以失败退出，而不是让你事后再发现。
#
# -----------------------------------------------------------------------------
# 选项
# -----------------------------------------------------------------------------
#   --build          重建镜像并强制替换容器（源码变更时必需）
#   --no-cache       构建时不使用 Docker 缓存（构建慢但最保险）
#   --only <目标>    只处理 gpss / banshan / both（默认 both）
#   --sync-only      只同步源码不重建（会导致页面仍旧，仅用于排障）
#   --dry-run        只显示将要执行的操作，不做任何改动
#   -h, --help       显示帮助
# =============================================================================

set -euo pipefail

# 部署目录：默认线上固定路径；若本脚本所在目录就是部署目录（本机排障/dry-run），优先用它。
# 也可用 DEPLOY_DIR=/path 显式覆盖。
SELF_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -z "${DEPLOY_DIR:-}" ]; then
  if [ -f "$SELF_DIR/docker-compose.yml" ]; then DEPLOY_DIR="$SELF_DIR"
  else DEPLOY_DIR=/opt/banshan-gpss-deploy; fi
fi
BACKUP_DIR=/opt/gpss/backup
HEALTH_TIMEOUT=180          # 每个服务等待就绪的秒数
STAMP="$(date +%Y%m%d-%H%M%S)"

PKG=""
SHA_FILE=""
DO_BUILD=0
NO_CACHE=0
SYNC_ONLY=0
DRY_RUN=0
ONLY="both"

# ---------- 输出 ----------
say()  { printf '\033[1;34m==> %s\033[0m\n' "$*"; }
ok()   { printf '    \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m警告: %s\033[0m\n' "$*"; }
err()  { printf '\033[1;31m错误: %s\033[0m\n' "$*" >&2; exit 1; }

usage() { sed -n '2,40p' "$0" | sed 's/^# \{0,1\}//'; exit 0; }

# ---------- 参数解析 ----------
while [ $# -gt 0 ]; do
  case "$1" in
    --build)     DO_BUILD=1; shift ;;
    --no-cache)  NO_CACHE=1; shift ;;
    --sync-only) SYNC_ONLY=1; shift ;;
    --dry-run)   DRY_RUN=1; shift ;;
    --only)      ONLY="${2:-}"; shift 2 ;;
    -h|--help)   usage ;;
    -*)          err "未知选项: $1（用 -h 查看帮助）" ;;
    *)           if [ -z "$PKG" ]; then PKG="$1"
                 elif [ -z "$SHA_FILE" ]; then SHA_FILE="$1"
                 else err "多余的参数: $1"; fi
                 shift ;;
  esac
done

case "$ONLY" in gpss|banshan|both) ;; *) err "--only 只能是 gpss / banshan / both" ;; esac
[ -n "$PKG" ] || { usage; }

# ---------- 前置检查 ----------
for c in tar docker; do
  command -v "$c" >/dev/null 2>&1 || err "缺少命令: $c"
done
CKSUM=sha256sum
command -v sha256sum >/dev/null 2>&1 || CKSUM="shasum -a 256"

[ -f "$PKG" ] || err "找不到升级包: $PKG"
[ -f "$DEPLOY_DIR/docker-compose.yml" ] || err "未找到编排文件: $DEPLOY_DIR/docker-compose.yml"

COMPOSE=(docker compose)

# 源码变更但没带 --build：直接拒绝。这正是"升级后页面还是旧的"的根因。
if [ "$DO_BUILD" = 0 ] && [ "$SYNC_ONLY" = 0 ] && [ "$DRY_RUN" = 0 ]; then
  err "缺少 --build。

  只同步源码而不重建镜像，容器里跑的还是旧产物，页面不会变。
  源码变更必须重建：bash $(basename "$0") <升级包> [校验文件] --build

  确实只想同步源码（排障用）：加 --sync-only"
fi

# ---------- 工具 ----------
sync_dir() {   # 用 --delete 保证与升级包完全一致；无 rsync 时退化为整体替换
  local src="$1" dst="$2"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete "$src"/ "$dst"/
  else
    rm -rf "$dst"; mkdir -p "$dst"; cp -a "$src"/. "$dst"/
  fi
}

tree_hash() {  # 源码树指纹（排除 node_modules/.git）
  local d="$1"
  [ -d "$d" ] || { echo "none"; return; }
  find "$d" -type f \
    -not -path '*/node_modules/*' -not -path '*/.git/*' \
    -not -name '.DS_Store' -print0 2>/dev/null \
    | sort -z | xargs -0 $CKSUM 2>/dev/null | $CKSUM | awk '{print $1}'
}

fe_hash() {    # 只取「前端」相关路径的指纹 —— 后端改动不应触发前端产物核对
  local base="$1"; shift
  local paths=()
  for p in "$@"; do [ -e "$base/$p" ] && paths+=("$base/$p"); done
  [ ${#paths[@]} -eq 0 ] && { echo "none"; return; }
  find "${paths[@]}" -type f \
    -not -path '*/node_modules/*' -not -path '*/.git/*' \
    -not -name '.DS_Store' -print0 2>/dev/null \
    | sort -z | xargs -0 $CKSUM 2>/dev/null | $CKSUM | awk '{print $1}'
}

bundle_hash() {  # 容器内前端入口 HTML 的哈希 —— 它引用带哈希的资源名，构建变了它就变
  # 容器是 Debian 系，固定用 sha256sum，不要沿用宿主机的 $CKSUM
  local svc="$1" path="$2"
  docker exec "$svc" sha256sum "$path" 2>/dev/null | awk '{print $1}' || true
}

wait_ready() {
  local svc="$1" port="$2" label="$3" i
  for i in $(seq 1 $((HEALTH_TIMEOUT / 2))); do
    if "${COMPOSE[@]}" exec -T "$svc" node -e \
        "fetch('http://127.0.0.1:$port/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" \
        >/dev/null 2>&1; then
      ok "$label ($svc:$port) 已就绪"
      return 0
    fi
    sleep 2
  done
  return 1
}

# 目标服务
GPSS_SRC_DIR="$DEPLOY_DIR/gpss"
BANSHAN_SRC_DIR="$DEPLOY_DIR/banshan-academy"
# 各自「前端」源码的相对路径（用于判断前端是否需要重新出产物）
GPSS_FE_PATHS=(src public index.html package.json vite.config.ts)
BANSHAN_FE_PATHS=(client)
TARGETS=()
case "$ONLY" in
  gpss)    TARGETS=(gpss) ;;
  banshan) TARGETS=(banshan) ;;
  both)    TARGETS=(gpss banshan) ;;
esac

# 源码目录名 → compose 服务名
SVCS=()
for t in "${TARGETS[@]}"; do
  if [ "$t" = gpss ]; then SVCS+=(gpss-app); else SVCS+=(banshan-app); fi
done

echo "============================================================"
echo " 半山学堂 + GPSS 升级"
echo "  包      : $PKG"
echo "  目录    : $DEPLOY_DIR"
echo "  范围    : $ONLY"
echo "  构建    : $([ "$DO_BUILD" = 1 ] && echo "重建镜像 $([ "$NO_CACHE" = 1 ] && echo '(--no-cache)')" || echo '跳过')"
[ "$DRY_RUN" = 1 ] && echo "  模式    : DRY-RUN（不做任何改动）"
echo "============================================================"
echo

cd "$DEPLOY_DIR"
[ "$DRY_RUN" = 1 ] || mkdir -p "$BACKUP_DIR"

STAGE=""
cleanup() { [ -n "$STAGE" ] && rm -rf "$STAGE"; }
trap cleanup EXIT

# ---------- 1. 校验包 ----------
say "1/8 校验升级包"
if [ -n "$SHA_FILE" ] && [ -f "$SHA_FILE" ]; then
  expected=$($CKSUM "$PKG" | awk '{print $1}')
  recorded=$(awk '{print $1}' "$SHA_FILE")
  [ "$expected" = "$recorded" ] || err "校验失败：包已损坏或与校验文件不匹配"
  ok "sha256 校验通过 ($recorded)"
else
  warn "未提供校验文件，跳过完整性校验（建议提供）"
fi

# ---------- 2. 记录改动前状态 ----------
say "2/8 记录当前状态"
BEFORE_GPSS_SRC=$(tree_hash "$GPSS_SRC_DIR")
BEFORE_BAN_SRC=$(tree_hash "$BANSHAN_SRC_DIR")
BEFORE_GPSS_FE=$(fe_hash "$GPSS_SRC_DIR" "${GPSS_FE_PATHS[@]}")
BEFORE_BAN_FE=$(fe_hash "$BANSHAN_SRC_DIR" "${BANSHAN_FE_PATHS[@]}")
BEFORE_GPSS_BUNDLE=$(bundle_hash gpss-app /app/dist/index.html)
BEFORE_BAN_BUNDLE=$(bundle_hash banshan-app /app/client/dist/index.html)
echo "    gpss 源码指纹            : ${BEFORE_GPSS_SRC:0:16}"
echo "    banshan 源码指纹         : ${BEFORE_BAN_SRC:0:16}"
echo "    gpss 容器内产物指纹      : ${BEFORE_GPSS_BUNDLE:0:16}"
echo "    banshan 容器内产物指纹   : ${BEFORE_BAN_BUNDLE:0:16}"

# ---------- 3. 解压 ----------
say "3/8 解压升级包"
STAGE=$(mktemp -d "${TMPDIR:-/tmp}/gpss-upgrade.XXXXXX")
tar -xzf "$PKG" -C "$STAGE"
[ -d "$STAGE/gpss-src" ]        || err "包内缺少 gpss-src/ 目录"
[ -d "$STAGE/banshan-academy" ] || err "包内缺少 banshan-academy/ 目录"
ok "顶层结构：$(ls "$STAGE" | tr '\n' ' ')"

# ---------- 4. 备份 ----------
say "4/8 备份现有源码与 .env"
if [ "$DRY_RUN" = 1 ]; then
  echo "    (dry-run 跳过备份)"
else
  for t in "${TARGETS[@]}"; do
    if [ "$t" = gpss ]; then d="$GPSS_SRC_DIR"; n=gpss; else d="$BANSHAN_SRC_DIR"; n=banshan-academy; fi
    [ -d "$d" ] && cp -a "$d" "$BACKUP_DIR/$n-$STAMP" && ok "$n → $BACKUP_DIR/$n-$STAMP"
  done
  [ -f "$DEPLOY_DIR/.env" ] && cp -a "$DEPLOY_DIR/.env" "$BACKUP_DIR/env-$STAMP.bak" && ok ".env → $BACKUP_DIR/env-$STAMP.bak"
fi

# ---------- 5. 同步源码 ----------
say "5/8 同步源码"
if [ "$DRY_RUN" = 1 ]; then
  for t in "${TARGETS[@]}"; do
    [ "$t" = gpss ] && echo "    (dry-run) rsync $STAGE/gpss-src/ → $GPSS_SRC_DIR/" \
                    || echo "    (dry-run) rsync $STAGE/banshan-academy/ → $BANSHAN_SRC_DIR/"
  done
else
  for t in "${TARGETS[@]}"; do
    if [ "$t" = gpss ]; then sync_dir "$STAGE/gpss-src" "$GPSS_SRC_DIR";       ok "gpss/ 已同步"
    else                        sync_dir "$STAGE/banshan-academy" "$BANSHAN_SRC_DIR"; ok "banshan-academy/ 已同步"
    fi
  done
fi

AFTER_GPSS_SRC=$(tree_hash "$GPSS_SRC_DIR")
AFTER_BAN_SRC=$(tree_hash "$BANSHAN_SRC_DIR")
AFTER_GPSS_FE=$(fe_hash "$GPSS_SRC_DIR" "${GPSS_FE_PATHS[@]}")
AFTER_BAN_FE=$(fe_hash "$BANSHAN_SRC_DIR" "${BANSHAN_FE_PATHS[@]}")
GPSS_SRC_CHANGED=0; BAN_SRC_CHANGED=0; GPSS_FE_CHANGED=0; BAN_FE_CHANGED=0
[ "$AFTER_GPSS_SRC" != "$BEFORE_GPSS_SRC" ] && GPSS_SRC_CHANGED=1
[ "$AFTER_BAN_SRC"  != "$BEFORE_BAN_SRC"  ] && BAN_SRC_CHANGED=1
[ "$AFTER_GPSS_FE"  != "$BEFORE_GPSS_FE"  ] && GPSS_FE_CHANGED=1
[ "$AFTER_BAN_FE"   != "$BEFORE_BAN_FE"   ] && BAN_FE_CHANGED=1

for t in "${TARGETS[@]}"; do
  if [ "$t" = gpss ]; then c=$GPSS_SRC_CHANGED; f=$GPSS_FE_CHANGED; n=gpss
  else                     c=$BAN_SRC_CHANGED;  f=$BAN_FE_CHANGED;  n=banshan-academy; fi
  if [ "$c" = 1 ]; then
    [ "$f" = 1 ] && echo "    $n 源码有变化（含前端）" || echo "    $n 源码有变化（仅后端）"
  else
    echo "    $n 源码与线上一致（无变化）"
  fi
done

if [ "$GPSS_SRC_CHANGED" = 0 ] && [ "$BAN_SRC_CHANGED" = 0 ] && [ "$DRY_RUN" = 0 ]; then
  warn "两份源码都与线上一致，本次升级不会带来任何变化。"
fi

# ---------- 6. 构建 ----------
say "6/8 重建镜像"
if [ "$DO_BUILD" = 0 ]; then
  warn "--sync-only：跳过构建。"
  warn "容器内仍是旧产物，页面不会更新 —— 仅用于排障。"
  echo
  say "完成（未重建）"
  exit 0
fi

if [ "$DRY_RUN" = 1 ]; then
  echo "    (dry-run) docker compose build $([ "$NO_CACHE" = 1 ] && echo --no-cache) ${SVCS[*]}"
else
  BUILD_ARGS=()
  [ "$NO_CACHE" = 1 ] && BUILD_ARGS+=(--no-cache)
  "${COMPOSE[@]}" build "${BUILD_ARGS[@]}" "${SVCS[@]}"
  ok "镜像构建完成：${SVCS[*]}"
fi

# ---------- 7. 重启 ----------
say "7/8 强制替换容器"
if [ "$DRY_RUN" = 1 ]; then
  echo "    (dry-run) docker compose up -d --force-recreate ${SVCS[*]}"
else
  "${COMPOSE[@]}" up -d --force-recreate "${SVCS[@]}"
  "${COMPOSE[@]}" up -d nginx >/dev/null 2>&1 || true
  ok "容器已替换"
fi

# ---------- 8. 健康检查 ----------
say "8/8 等待服务就绪（最多 ${HEALTH_TIMEOUT} 秒）"
if [ "$DRY_RUN" = 1 ]; then
  echo "    (dry-run) 跳过健康检查"
else
  for t in "${TARGETS[@]}"; do
    if [ "$t" = gpss ]; then
      wait_ready gpss-app 3011 "毕业设计管理系统" || err "gpss-app 未就绪：${COMPOSE[*]} logs --tail=100 gpss-app"
    else
      wait_ready banshan-app 3012 "半山学堂" || err "banshan-app 未就绪：${COMPOSE[*]} logs --tail=100 banshan-app"
    fi
  done
fi

# ---------- 产物指纹核对 ----------
echo
say "核对：源码变了，容器里的产物是否真的变了"
FAILED=0
if [ "$DRY_RUN" = 0 ]; then
  AFTER_GPSS_BUNDLE=$(bundle_hash gpss-app /app/dist/index.html)
  AFTER_BAN_BUNDLE=$(bundle_hash banshan-app /app/client/dist/index.html)

  check_one() {
    local label="$1" changed="$2" before="$3" after="$4" svc="$5" path="$6"
    if [ -z "$after" ]; then
      warn "$label 读不到容器内产物（$svc:$path），无法核对"
      return
    fi
    if [ "$changed" = 1 ] && [ -n "$before" ] && [ "$before" = "$after" ]; then
      printf '    \033[31m✗ %s 前端源码变了但产物没变（%s）\033[0m\n' "$label" "${after:0:16}"
      echo "      构建很可能被缓存命中，或容器未被真正替换。"
      echo "      重试：bash $(basename "$0") $PKG ${SHA_FILE:+$SHA_FILE} --build --no-cache"
      FAILED=1
    elif [ "$changed" = 0 ]; then
      ok "$label 前端源码无变化，产物保持 ${after:0:16}（符合预期）"
    else
      ok "$label 前端产物已更新 ${before:0:16} → ${after:0:16}"
    fi
  }
  for t in "${TARGETS[@]}"; do
    if [ "$t" = gpss ]; then
      check_one "gpss-app"    "$GPSS_FE_CHANGED" "$BEFORE_GPSS_BUNDLE" "$AFTER_GPSS_BUNDLE" gpss-app    /app/dist/index.html
    else
      check_one "banshan-app" "$BAN_FE_CHANGED"  "$BEFORE_BAN_BUNDLE"  "$AFTER_BAN_BUNDLE"  banshan-app /app/client/dist/index.html
    fi
  done
fi

# ---------- 升级脚本自更新 ----------
# 包内自带一份 upgrade.sh。若与本地不同则替换，下次升级即用新版，无需手工 scp。
# 用 mv 做原子替换：进程持有的是旧 inode，正在执行的脚本不会被写坏。
if [ "$DRY_RUN" = 0 ] && [ -f "$STAGE/upgrade.sh" ] && [ -f "$DEPLOY_DIR/upgrade.sh" ]; then
  if ! cmp -s "$STAGE/upgrade.sh" "$DEPLOY_DIR/upgrade.sh"; then
    if cp "$STAGE/upgrade.sh" "$DEPLOY_DIR/.upgrade.sh.new" \
       && chmod +x "$DEPLOY_DIR/.upgrade.sh.new" \
       && mv -f "$DEPLOY_DIR/.upgrade.sh.new" "$DEPLOY_DIR/upgrade.sh"; then
      say "包内 upgrade.sh 与本地不同，已更新 $DEPLOY_DIR/upgrade.sh（下次运行生效）"
    else
      warn "升级脚本自更新失败（不影响本次升级）"
    fi
  fi
fi

# ---------- 汇总 ----------
echo
if [ "$DRY_RUN" = 1 ]; then
  echo "DRY-RUN 结束：以上为将要执行的操作，未做任何改动。"
  echo "去掉 --dry-run 即真正执行。"
  exit 0
fi

"${COMPOSE[@]}" ps
echo
echo "本次备份: $BACKUP_DIR/*-$STAMP*"
echo "回滚: 停容器 → 用备份目录覆盖源码 → 重新 build + up -d --force-recreate"
echo
if [ "$FAILED" = 1 ]; then
  printf '\033[1;31m升级未生效：源码已更新，但容器内产物没有变化。\033[0m\n'
  echo "页面仍会显示旧内容。请按上面的提示用 --no-cache 重试，并检查构建日志。"
  exit 2
fi
printf '\033[32m升级完成。\033[0m\n'
echo "  半山学堂          http://<服务器IP>/"
echo "  毕业设计管理系统  http://<服务器IP>/gpss/"
echo "浏览器请按 Cmd+Shift+R / Ctrl+F5 强制刷新一次，排除本地缓存。"
