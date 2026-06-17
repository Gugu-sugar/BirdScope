# BirdScope 数据库快照

当前快照：`birdscope.dump`

- PostgreSQL custom format
- 由 PostgreSQL 18.4 导出
- 约 327 MB
- 本地恢复建议使用 PostgreSQL 18 + PostGIS 3.6
- 含 `occurrence_stats_monthly` 预聚合表（2026-06-16 新增，用于时间序列/物种排行图表）

从仓库根目录恢复：

```powershell
$env:PGPASSWORD="你的 postgres 密码"
createdb -h localhost -U postgres birdscope
pg_restore -h localhost -U postgres -d birdscope `
  --no-owner --no-privileges `
  deploy/dump/birdscope.dump
```

完整步骤见 [deploy/README.md](../README.md)。
