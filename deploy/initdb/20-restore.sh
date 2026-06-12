#!/bin/bash
# 首次启动（数据卷为空）时自动恢复 birdscope 数据。
# postgis 官方镜像的 10_postgis.sh 会先在目标库启用 postgis 扩展，本脚本编号 20 在其后执行。
# 注意：此文件必须使用 LF 换行（Linux 容器内执行）。
set -e

DUMP=/dump/birdscope.dump

if [ -f "$DUMP" ]; then
  echo ">>> Restoring birdscope from $DUMP ..."
  # pg_restore 默认不 exit-on-error，末尾 || true 容忍「扩展已存在」等非致命告警
  pg_restore --no-owner --no-privileges -d birdscope "$DUMP" || true
  echo ">>> Restore done."
else
  echo ">>> No dump found at $DUMP — starting with empty database (schema only via init_db.sql if present)."
fi
