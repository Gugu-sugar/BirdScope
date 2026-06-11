"""
build_grid.py — 从 occurrence_clean 生成预聚合热力网格表 occurrence_grid_monthly

按 (year, month, 网格) 聚合记录数与个体数，供 /stats/grid 无 species_key 时直接查询，
以及后续 GeoServer WMS 全球热力图发布使用。

默认生成 1.0 度网格；可通过 --grid-size 追加 0.5 / 0.1 度等更细网格
（同一张表用 grid_size 字段区分，互不覆盖）。

幂等：每次运行先删除该 grid_size 的旧行，再重新聚合写入。

用法：
    cd backend
    python scripts/build_grid.py                 # 默认 1.0 度
    python scripts/build_grid.py --grid-size 0.5 # 追加 0.5 度网格
    python scripts/build_grid.py --grid-size 1.0 --grid-size 0.5  # 一次生成多个
"""
import argparse
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


def build_one(conn, grid_size: float) -> int:
    """为给定网格尺寸（度）重建聚合行，返回写入行数。"""
    cur = conn.cursor()

    # 幂等：先清掉该 grid_size 的旧聚合
    cur.execute(
        "DELETE FROM occurrence_grid_monthly WHERE grid_size = %s",
        (grid_size,),
    )

    # 网格对齐：floor(coord / gs) * gs 得到格子左下角；中心 = 左下角 + gs/2
    # individual_count 可能为 NULL → SUM 自动跳过；全 NULL 时返回 NULL（符合规则，不填 0）
    cur.execute(
        """
        INSERT INTO occurrence_grid_monthly
            (year, month, grid_size, record_count, individual_sum,
             center_lon, center_lat, geom)
        SELECT
            year,
            month,
            %(gs)s AS grid_size,
            count(*)                       AS record_count,
            sum(individual_count)          AS individual_sum,
            floor(ST_X(geom) / %(gs)s) * %(gs)s + %(gs)s / 2 AS center_lon,
            floor(ST_Y(geom) / %(gs)s) * %(gs)s + %(gs)s / 2 AS center_lat,
            ST_MakeEnvelope(
                floor(ST_X(geom) / %(gs)s) * %(gs)s,
                floor(ST_Y(geom) / %(gs)s) * %(gs)s,
                floor(ST_X(geom) / %(gs)s) * %(gs)s + %(gs)s,
                floor(ST_Y(geom) / %(gs)s) * %(gs)s + %(gs)s,
                4326
            ) AS geom
        FROM occurrence_clean
        WHERE year IS NOT NULL AND month IS NOT NULL
        GROUP BY
            year, month,
            floor(ST_X(geom) / %(gs)s),
            floor(ST_Y(geom) / %(gs)s)
        """,
        {"gs": grid_size},
    )
    n = cur.rowcount
    conn.commit()
    cur.close()
    return n


def main():
    parser = argparse.ArgumentParser(description="生成预聚合热力网格表")
    parser.add_argument(
        "--grid-size",
        type=float,
        action="append",
        help="网格尺寸（度），可重复指定生成多个；默认 1.0",
    )
    args = parser.parse_args()
    grid_sizes = args.grid_size or [1.0]

    print("连接数据库...")
    conn = psycopg2.connect(DB_DSN)

    # 预检查：占位样本数据时给出提醒
    cur = conn.cursor()
    cur.execute("SELECT count(*) FROM occurrence_clean")
    src = cur.fetchone()[0]
    cur.close()
    print(f"occurrence_clean 源数据：{src:,} 条")
    if src == 0:
        print("源表为空，先运行 import_to_pg.py 导入数据。")
        conn.close()
        sys.exit(1)

    for gs in grid_sizes:
        print(f"\n[grid_size={gs}] 聚合中...")
        t0 = time.time()
        n = build_one(conn, gs)
        print(f"[grid_size={gs}] 完成，写入 {n:,} 个网格单元，耗时 {time.time() - t0:.1f}s")

    conn.close()
    print("\n全部完成。")


if __name__ == "__main__":
    main()
