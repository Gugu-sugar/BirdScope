# 把数据库 dump 放这里

这个目录用来存放 BirdScope 数据库的快照文件：

```
deploy/dump/birdscope.dump
```

- 文件名必须是 **`birdscope.dump`**（`initdb/20-restore.sh` 按这个名字找）。
- 文件约几百 MB，**不在 git 仓库里**，由后端同学通过网盘/U盘单独发给你。
- 把下载到的 `birdscope.dump` 直接拷进这个目录即可，然后回到 `deploy/` 执行
  `docker compose up -d`，首次启动会自动把数据导入数据库。

> 这是 PostgreSQL 18 自定义格式（`pg_dump -Fc`）的压缩备份，只能由 compose 里
> `postgis/postgis:18-3.6` 镜像（PG 18）恢复，请勿改动数据库镜像主版本号。
