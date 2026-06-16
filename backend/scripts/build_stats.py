"""
build_stats.py — 从 occurrence_clean 生成图表月度事实表 occurrence_stats_monthly

按 (year, month, country_code, state_province, species_key) 聚合记录数、个体数与
经纬度坐标和，供 /stats/monthly、/stats/province、/stats/migration、/species/rank
四个图表接口按需 SUM 上卷，避免对约 400 万行明细实时全表扫描。

设计说明见 backend-docs/data_pipeline.md。重心（migration）由 sum_lon/sum_lat 与
record_count 还原加权平均，与明细 AVG(ST_X/ST_Y) 口径一致。

幂等：每次运行先 TRUNCATE 整表再重建（当前仅 2024 单年，全量重建最简单）。

用法：
    cd backend
    python scripts/build_stats.py
"""
import os
import sys
import time

import psycopg2
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

DB_DSN = (
    f"host={os.getenv('DB_HOST', 'localhost')} "
    f"port={os.getenv('DB_PORT', '5432')} "
    f"dbname={os.getenv('DB_NAME', 'birdscope')} "
    f"user={os.getenv('DB_USER', 'postgres')} "
    f"password={os.getenv('DB_PASSWORD', '')}"
)


def build(conn) -> int:
    """重建事实表，返回写入行数。"""
    cur = conn.cursor()

    # 幂等：整表清空再重建（RESTART IDENTITY 复位自增主键）
    cur.execute("TRUNCATE occurrence_stats_monthly RESTART IDENTITY")

    # individual_count 可能为 NULL → SUM 自动跳过，全 NULL 时返回 NULL（符合规则，不填 0）
    # geom 非空（明细均带坐标），sum_lon/sum_lat 用于还原 migration 重心
    cur.execute(
        """
        INSERT INTO occurrence_stats_monthly
            (year, month, country_code, state_province, species_key,
             record_count, individual_sum, sum_lon, sum_lat)
        SELECT
            year, month, country_code, state_province, species_key,
            count(*)              AS record_count,
            sum(individual_count) AS individual_sum,
            sum(ST_X(geom))       AS sum_lon,
            sum(ST_Y(geom))       AS sum_lat
        FROM occurrence_clean
        WHERE year IS NOT NULL AND month IS NOT NULL
        GROUP BY year, month, country_code, state_province, species_key
        """
    )
    n = cur.rowcount
    conn.commit()
    cur.close()
    return n


def main():
    print("连接数据库...")
    conn = psycopg2.connect(DB_DSN)

    cur = conn.cursor()
    cur.execute("SELECT count(*) FROM occurrence_clean")
    src = cur.fetchone()[0]
    cur.close()
    print(f"occurrence_clean 源数据：{src:,} 条")
    if src == 0:
        print("源表为空，先运行 import_to_pg.py 导入数据。")
        conn.close()
        sys.exit(1)

    print("聚合中...")
    t0 = time.time()
    n = build(conn)
    print(f"完成，写入 {n:,} 行事实，耗时 {time.time() - t0:.1f}s")

    conn.close()
    print("全部完成。")


if __name__ == "__main__":
    main()
