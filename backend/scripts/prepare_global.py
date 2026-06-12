"""
prepare_global.py — 全球（非北美）eBird 数据两步降采样

输入：D:/EBIRD/0009321-260519110011954.csv（15GB，约 2762 万条）
输出：backend/data/global_thinned.tsv（含表头，约 300–410 万条）

两步降采样策略（参考 Inman et al. 2021 Ecosphere；Boakes et al. 2010 PLoS ONE）：
  Step 1：0.1°×0.1° 网格去重，每(lon格,lat格,speciesKey,month)保留 gbifID 最大的一条
  Step 2：按大洲面积配额随机子采样，使各洲最终密度与陆地面积成正比
          （若某洲 Step1 输出 ≤ 配额，全部保留，不强制删减）

运行：
  cd backend
  python scripts/prepare_global.py
  python scripts/prepare_global.py --input D:/EBIRD/0009321-260519110011954.csv --output data/global_thinned.tsv
"""

import argparse
import os
import sys
import time

import duckdb

# ---------------------------------------------------------------------------
# 配置
# ---------------------------------------------------------------------------

DEFAULT_INPUT  = "D:/EBIRD/0009321-260519110011954.csv"
DEFAULT_OUTPUT = "data/global_thinned.tsv"

# 大洲面积配额（总目标 500 万条，按各洲陆地面积比例分配）
# 面积来源：Britannica / UN Statistics；总面积 136.55 万 km²（不含北美）
# 非洲 22.24%、亚洲 32.65%、大洋洲 6.24%、欧洲 7.71%、南美洲 13.07%
# 北美 18.09% 由 prepare_north_america.py 单独处理
CONTINENT_QUOTA: dict[str, int] = {
    "Africa":        1_110_000,
    "Asia":          1_630_000,
    "Oceania":         312_000,
    "Europe":          385_000,
    "South America":   654_000,
}

# ISO 3166-1 alpha-2 → 大洲
# 覆盖 eBird GBIF 数据中出现的主要国家码
COUNTRY_TO_CONTINENT: dict[str, str] = {
    # ── Africa ──────────────────────────────────────────────────────────────
    "DZ": "Africa", "AO": "Africa", "BJ": "Africa", "BW": "Africa",
    "BF": "Africa", "BI": "Africa", "CM": "Africa", "CV": "Africa",
    "CF": "Africa", "TD": "Africa", "KM": "Africa", "CG": "Africa",
    "CD": "Africa", "CI": "Africa", "DJ": "Africa", "EG": "Africa",
    "GQ": "Africa", "ER": "Africa", "ET": "Africa", "GA": "Africa",
    "GM": "Africa", "GH": "Africa", "GN": "Africa", "GW": "Africa",
    "KE": "Africa", "LS": "Africa", "LR": "Africa", "LY": "Africa",
    "MG": "Africa", "MW": "Africa", "ML": "Africa", "MR": "Africa",
    "MU": "Africa", "YT": "Africa", "MA": "Africa", "MZ": "Africa",
    "NA": "Africa", "NE": "Africa", "NG": "Africa", "RE": "Africa",
    "RW": "Africa", "SH": "Africa", "ST": "Africa", "SN": "Africa",
    "SC": "Africa", "SL": "Africa", "SO": "Africa", "ZA": "Africa",
    "SS": "Africa", "SD": "Africa", "SZ": "Africa", "TZ": "Africa",
    "TG": "Africa", "TN": "Africa", "UG": "Africa", "EH": "Africa",
    "ZM": "Africa", "ZW": "Africa",
    # ── Asia ─────────────────────────────────────────────────────────────────
    "AF": "Asia", "AM": "Asia", "AZ": "Asia", "BH": "Asia",
    "BD": "Asia", "BT": "Asia", "BN": "Asia", "KH": "Asia",
    "CN": "Asia", "CY": "Asia", "GE": "Asia", "HK": "Asia",
    "IN": "Asia", "ID": "Asia", "IR": "Asia", "IQ": "Asia",
    "IL": "Asia", "JP": "Asia", "JO": "Asia", "KZ": "Asia",
    "KW": "Asia", "KG": "Asia", "LA": "Asia", "LB": "Asia",
    "MO": "Asia", "MY": "Asia", "MV": "Asia", "MN": "Asia",
    "MM": "Asia", "NP": "Asia", "KP": "Asia", "OM": "Asia",
    "PK": "Asia", "PS": "Asia", "PH": "Asia", "QA": "Asia",
    "SA": "Asia", "SG": "Asia", "KR": "Asia", "LK": "Asia",
    "SY": "Asia", "TW": "Asia", "TJ": "Asia", "TH": "Asia",
    "TL": "Asia", "TR": "Asia", "TM": "Asia", "AE": "Asia",
    "UZ": "Asia", "VN": "Asia", "YE": "Asia",
    # ── Europe ───────────────────────────────────────────────────────────────
    "AL": "Europe", "AD": "Europe", "AT": "Europe", "BY": "Europe",
    "BE": "Europe", "BA": "Europe", "BG": "Europe", "HR": "Europe",
    "CZ": "Europe", "DK": "Europe", "EE": "Europe", "FI": "Europe",
    "FR": "Europe", "DE": "Europe", "GR": "Europe", "HU": "Europe",
    "IS": "Europe", "IE": "Europe", "IT": "Europe", "XK": "Europe",
    "LV": "Europe", "LI": "Europe", "LT": "Europe", "LU": "Europe",
    "MT": "Europe", "MD": "Europe", "MC": "Europe", "ME": "Europe",
    "NL": "Europe", "MK": "Europe", "NO": "Europe", "PL": "Europe",
    "PT": "Europe", "RO": "Europe", "RU": "Europe", "SM": "Europe",
    "RS": "Europe", "SK": "Europe", "SI": "Europe", "ES": "Europe",
    "SE": "Europe", "CH": "Europe", "UA": "Europe", "GB": "Europe",
    "VA": "Europe", "GI": "Europe", "FO": "Europe", "AX": "Europe",
    "GL": "Europe", "SJ": "Europe",
    # ── Oceania ──────────────────────────────────────────────────────────────
    "AU": "Oceania", "FJ": "Oceania", "KI": "Oceania", "MH": "Oceania",
    "FM": "Oceania", "NR": "Oceania", "NZ": "Oceania", "PW": "Oceania",
    "PG": "Oceania", "WS": "Oceania", "SB": "Oceania", "TO": "Oceania",
    "TV": "Oceania", "VU": "Oceania", "CK": "Oceania", "PF": "Oceania",
    "GU": "Oceania", "NC": "Oceania", "NU": "Oceania", "NF": "Oceania",
    "MP": "Oceania", "PN": "Oceania", "TK": "Oceania", "WF": "Oceania",
    "AS": "Oceania", "CX": "Oceania", "CC": "Oceania", "UM": "Oceania",
    # ── South America ────────────────────────────────────────────────────────
    "AR": "South America", "BO": "South America", "BR": "South America",
    "CL": "South America", "CO": "South America", "EC": "South America",
    "FK": "South America", "GF": "South America", "GY": "South America",
    "PY": "South America", "PE": "South America", "SR": "South America",
    "UY": "South America", "VE": "South America",
}

# 输出的 20 列（与 occurrence_clean 完全一致）
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
    print(f"[prepare_global] 输入：{input_path}")
    print(f"[prepare_global] 输出：{output_path}")

    con = duckdb.connect(database=":memory:", config={"threads": 4, "memory_limit": "6GB"})

    # ── Step 1：0.1°×0.1° 网格去重 ─────────────────────────────────────────
    print("\n[Step 1] 网格去重（0.1°×0.1°）…")
    t0 = time.time()

    cols_sql = ", ".join(f'"{c}"' if c == "order" else c for c in OUTPUT_COLS)

    con.execute(f"""
        CREATE TABLE step1 AS
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

    step1_count = con.execute("SELECT count(*) FROM step1").fetchone()[0]
    print(f"[Step 1] 完成，{step1_count:,} 条，耗时 {time.time()-t0:.0f}s")

    # ── Step 2：大洲面积配额子采样 ─────────────────────────────────────────
    print("\n[Step 2] 按大洲面积配额子采样…")
    t0 = time.time()

    # 将国家码→大洲映射写入 DuckDB 临时表
    con.execute("CREATE TABLE cc_map (countryCode VARCHAR, continent VARCHAR)")
    rows = [(cc, cont) for cc, cont in COUNTRY_TO_CONTINENT.items()]
    con.executemany("INSERT INTO cc_map VALUES (?, ?)", rows)

    # 计算各洲实际 Step1 条目数及采样率
    continent_stats = con.execute("""
        SELECT m.continent,
               count(*) AS n
        FROM step1 s
        JOIN cc_map m ON s.countryCode = m.countryCode
        GROUP BY m.continent
    """).fetchall()

    print(f"  {'大洲':<15} {'Step1条数':>12} {'配额':>12} {'采样率':>8}")
    print("  " + "-" * 55)

    rates: dict[str, float] = {}
    for continent, n in continent_stats:
        quota = CONTINENT_QUOTA.get(continent, n)  # 未知大洲全留
        rate  = min(1.0, quota / n) if n > 0 else 0.0
        rates[continent] = rate
        kept = min(n, quota)
        print(f"  {continent:<15} {n:>12,} {quota:>12,} {rate:>8.2%}  → 保留 {kept:,}")

    # 将采样率写入 DuckDB
    con.execute("CREATE TABLE continent_rate (continent VARCHAR, rate DOUBLE)")
    con.executemany("INSERT INTO continent_rate VALUES (?, ?)", list(rates.items()))

    # 未匹配国家码的记录（全留，避免漏掉）
    unmatched = con.execute("""
        SELECT count(*) FROM step1 s
        WHERE NOT EXISTS (SELECT 1 FROM cc_map m WHERE m.countryCode = s.countryCode)
    """).fetchone()[0]
    if unmatched:
        print(f"\n  注意：{unmatched:,} 条记录国家码未匹配大洲，将全部保留。")

    # 执行子采样并写出 TSV
    col_select = ", ".join(f't."{c}"' if c == "order" else f"t.{c}" for c in OUTPUT_COLS)
    con.execute(f"""
        COPY (
            SELECT {col_select}
            FROM (
                SELECT s.*,
                    coalesce(r.rate, 1.0) AS _rate,
                    ROW_NUMBER() OVER (
                        PARTITION BY coalesce(m.continent, 'Unknown')
                        ORDER BY random()
                    ) AS _rn,
                    COUNT(*) OVER (
                        PARTITION BY coalesce(m.continent, 'Unknown')
                    ) AS _band_total
                FROM step1 s
                LEFT JOIN cc_map m ON s.countryCode = m.countryCode
                LEFT JOIN continent_rate r ON coalesce(m.continent,'Unknown') = r.continent
            ) t
            WHERE _rn <= CAST(_band_total * _rate AS INTEGER) + 1
        ) TO '{output_path}'
        (DELIMITER '\\t', HEADER true)
    """)

    final_count = con.execute(f"""
        SELECT count(*) FROM read_csv('{output_path}', delim='\\t', header=true)
    """).fetchone()[0]

    print(f"\n[Step 2] 完成，耗时 {time.time()-t0:.0f}s")
    print(f"[prepare_global] 最终输出：{final_count:,} 条 → {output_path}")
    con.close()


# ---------------------------------------------------------------------------
# CLI 入口
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="全球 eBird 数据两步降采样")
    parser.add_argument("--input",  default=DEFAULT_INPUT,  help="原始 TSV/CSV 路径")
    parser.add_argument("--output", default=DEFAULT_OUTPUT, help="输出 TSV 路径")
    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(f"错误：输入文件不存在 → {args.input}", file=sys.stderr)
        sys.exit(1)

    main(args.input, args.output)
