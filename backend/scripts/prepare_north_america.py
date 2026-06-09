"""
prepare_north_america.py — 北美洲 eBird 数据两步降采样

输入：D:/EBIRD/North Amarica/0011005-260519110011954.csv（21.8GB，约 4380 万条）
输出：backend/data/na_thinned.tsv（无表头，约 90 万条）

两步降采样策略（同 prepare_global.py，参考 Inman et al. 2021；Boakes et al. 2010）：
  Step 1：0.1°×0.1° 网格去重（与全球文件完全对称，每格×物种×月份保留 gbifID 最大的记录）
  Step 2：面积配额子采样，目标 900_000 条（总目标 500 万 × 北美面积占比 18.09%）
          使用纬度带（10° 间隔）分层随机，防止加拿大北部/阿拉斯加等高纬稀疏区被全局比例清空

合并到全球文件后导入：
  Get-Content backend\\data\\na_thinned.tsv | Add-Content backend\\data\\global_thinned.tsv
  python scripts/import_to_pg.py --input backend/data/global_thinned.tsv

运行：
  cd backend
  python scripts/prepare_north_america.py
  python scripts/prepare_north_america.py --input "D:/EBIRD/North Amarica/0011005-260519110011954.csv" --output data/na_thinned.tsv
"""

import argparse
import os
import sys
import time

import duckdb

# ---------------------------------------------------------------------------
# 配置
# ---------------------------------------------------------------------------

DEFAULT_INPUT  = "D:/EBIRD/North Amarica/0011005-260519110011954.csv"
DEFAULT_OUTPUT = "data/na_thinned.tsv"

# 北美面积配额：总目标 500 万 × (2471万km² / 13655万km²) = 18.09% ≈ 90 万
NA_TARGET = 900_000

# 输出的 20 列（与 occurrence_clean / global_thinned.tsv 完全一致）
OUTPUT_COLS = [
    "gbifID", "speciesKey", "taxonKey", "order", "family", "genus",
    "species", "scientificName", "countryCode", "stateProvince", "locality",
    "individualCount", "decimalLatitude", "decimalLongitude", "eventDate",
    "year", "month", "day", "license", "issue",
]


# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------

def main(input_path: str, output_path: str) -> None:
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    print(f"[prepare_north_america] 输入：{input_path}")
    print(f"[prepare_north_america] 输出：{output_path}")
    print(f"[prepare_north_america] 目标条数：{NA_TARGET:,}")

    con = duckdb.connect(database=":memory:", config={"threads": 4, "memory_limit": "6GB"})

    # ── Step 1：0.1°×0.1° 网格去重 ─────────────────────────────────────────
    print("\n[Step 1] 网格去重（0.1°×0.1°）…")
    t0 = time.time()

    cols_sql = ", ".join(f'"{c}"' if c == "order" else c for c in OUTPUT_COLS)

    con.execute(f"""
        CREATE TABLE na_step1 AS
        SELECT {cols_sql}
        FROM (
            SELECT *,
                ROW_NUMBER() OVER (
                    PARTITION BY
                        round(CAST(decimalLongitude AS DOUBLE), 1),
                        round(CAST(decimalLatitude  AS DOUBLE), 1),
                        speciesKey,
                        month
                    ORDER BY CAST(gbifID AS BIGINT) DESC
                ) AS rn
            FROM read_csv(
                '{input_path}',
                delim='\\t',
                header=true,
                nullstr='',
                ignore_errors=true
            )
            WHERE basisOfRecord = 'HUMAN_OBSERVATION'
              AND decimalLatitude  IS NOT NULL
              AND decimalLongitude IS NOT NULL
        ) t
        WHERE rn = 1
    """)

    step1_count = con.execute("SELECT count(*) FROM na_step1").fetchone()[0]
    elapsed = time.time() - t0
    print(f"[Step 1] 完成，{step1_count:,} 条，耗时 {elapsed:.0f}s")

    # ── Step 2：分层随机子采样（按 10° 纬度带） ─────────────────────────────
    print(f"\n[Step 2] 分层随机子采样（目标 {NA_TARGET:,} 条）…")
    t0 = time.time()

    rate = min(1.0, NA_TARGET / step1_count) if step1_count > 0 else 0.0
    print(f"  Step1 输出 {step1_count:,} 条，全局采样率 {rate:.3%}")

    # 统计各纬度带
    band_stats = con.execute("""
        SELECT floor(CAST(decimalLatitude AS DOUBLE) / 10) * 10 AS band_start,
               count(*) AS n
        FROM na_step1
        GROUP BY 1
        ORDER BY 1
    """).fetchall()

    print(f"\n  {'纬度带':^12} {'Step1条数':>10} {'保留估算':>10}")
    print("  " + "-" * 36)
    for band, n in band_stats:
        kept = int(n * rate) + 1
        print(f"  {band:+.0f}° ~ {band+10:+.0f}°   {n:>10,} {kept:>10,}")

    # 分层随机采样并输出（HEADER false — 无表头，追加到 global_thinned.tsv）
    col_select = ", ".join(f'"{c}"' if c == "order" else c for c in OUTPUT_COLS)
    con.execute(f"""
        COPY (
            SELECT {col_select}
            FROM (
                SELECT *,
                    ROW_NUMBER() OVER (
                        PARTITION BY floor(CAST(decimalLatitude AS DOUBLE) / 10)
                        ORDER BY random()
                    ) AS _rn2,
                    COUNT(*) OVER (
                        PARTITION BY floor(CAST(decimalLatitude AS DOUBLE) / 10)
                    ) AS _band_total
                FROM na_step1
            ) t
            WHERE _rn2 <= CAST(_band_total * {rate} AS INTEGER) + 1
        ) TO '{output_path}'
        (DELIMITER '\\t', HEADER false)
    """)

    # 统计最终输出行数
    with open(output_path, encoding="utf-8") as f:
        final_count = sum(1 for _ in f)

    elapsed = time.time() - t0
    print(f"\n[Step 2] 完成，耗时 {elapsed:.0f}s")
    print(f"[prepare_north_america] 最终输出：{final_count:,} 条 → {output_path}")
    print(f"\n合并命令（PowerShell）：")
    print(f"  Get-Content {output_path} | Add-Content data/global_thinned.tsv")
    con.close()


# ---------------------------------------------------------------------------
# CLI 入口
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="北美洲 eBird 数据两步降采样")
    parser.add_argument("--input",  default=DEFAULT_INPUT,  help="原始 TSV/CSV 路径")
    parser.add_argument("--output", default=DEFAULT_OUTPUT, help="输出 TSV 路径（无表头）")
    parser.add_argument("--target", type=int, default=NA_TARGET,
                        help=f"目标条数（默认 {NA_TARGET:,}）")
    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(f"错误：输入文件不存在 → {args.input}", file=sys.stderr)
        sys.exit(1)

    main(args.input, args.output)
