# BirdScope 数据库快照

当前快照：`birdscope.dump`

- PostgreSQL custom format
- 由 PostgreSQL 18.4 导出
- 约 307 MB
- 本地恢复建议使用 PostgreSQL 18 + PostGIS 3.6

从仓库根目录恢复：

```powershell
$env:PGPASSWORD="你的 postgres 密码"
createdb -h localhost -U postgres birdscope
pg_restore -h localhost -U postgres -d birdscope `
  --no-owner --no-privileges `
  deploy/dump/birdscope.dump
```

完整步骤见 [deploy/README.md](../README.md)。
