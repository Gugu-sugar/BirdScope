"""
将 dev_sample.tsv（或全量 global_thinned.tsv）批量导入 PostgreSQL。

用法：
    # 导入开发样本（默认）
    python scripts/import_to_pg.py

    # 导入全量降采样文件
    python scripts/import_to_pg.py --input backend/data/global_thinned.tsv
"""
import argparse
import csv
import os
import sys
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

DB_DSN = (
    f"host={os.getenv('DB_HOST','localhost')} "
    f"port={os.getenv('DB_PORT','5432')} "
    f"dbname={os.getenv('DB_NAME','birdscope')} "
    f"user={os.getenv('DB_USER','postgres')} "
    f"password={os.getenv('DB_PASSWORD','')}"
)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_INPUT = os.path.join(SCRIPT_DIR, "..", "test_data", "dev_sample.tsv")

BATCH = 5000


def parse_int(v: str) -> int | None:
    return int(v) if v.strip() else None


def parse_date(v: str) -> str | None:
    return v.strip() if v.strip() else None


def import_occurrences(conn, path: str) -> int:
    cur = conn.cursor()
    count = 0
    batch = []

    with open(path, encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for row in reader:
            lat = row.get("decimalLatitude", "").strip()
            lon = row.get("decimalLongitude", "").strip()
            if not lat or not lon:
                continue
            try:
                lat_f, lon_f = float(lat), float(lon)
            except ValueError:
                continue

            batch.append((
                parse_int(row.get("gbifID", "")),
                parse_int(row.get("speciesKey", "")),
                parse_int(row.get("taxonKey", "")),
                row.get("order", "") or None,
                row.get("family", "") or None,
                row.get("genus", "") or None,
                row.get("species", "") or None,
                row.get("scientificName", "") or None,
                row.get("countryCode", "") or None,
                row.get("stateProvince", "") or None,
                row.get("locality", "") or None,
                parse_int(row.get("individualCount", "")),
                parse_date(row.get("eventDate", "")),
                parse_int(row.get("year", "")),
                parse_int(row.get("month", "")),
                parse_int(row.get("day", "")),
                row.get("license", "") or None,
                row.get("issue", "") or None,
                lon_f,
                lat_f,
            ))

            if len(batch) >= BATCH:
                _insert_batch(cur, batch)
                count += len(batch)
                batch = []
                print(f"  inserted {count}...", end="\r")

    if batch:
        _insert_batch(cur, batch)
        count += len(batch)

    conn.commit()
    cur.close()
    return count


def _insert_batch(cur, batch):
    # execute_values 把整批拼成单条多行 INSERT，比 executemany 快一个数量级。
    # 每行末尾的 (lon, lat) 由模板内的 ST_MakePoint 计算为 geom。
    execute_values(
        cur,
        """
        INSERT INTO occurrence_clean (
            gbif_id, species_key, taxon_key, bird_order, family, genus,
            species, scientific_name, country_code, state_province, locality,
            individual_count, event_date, year, month, day, license, issue, geom
        ) VALUES %s
        ON CONFLICT (gbif_id) DO NOTHING
        """,
        batch,
        template="""(
            %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s, %s,
            ST_SetSRID(ST_MakePoint(%s, %s), 4326)
        )""",
        page_size=BATCH,
    )


def build_species_lookup(conn) -> int:
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO species_lookup (
            species_key, taxon_key, bird_order, family, genus,
            species, scientific_name, record_count
        )
        SELECT
            species_key,
            MAX(taxon_key),
            MAX(bird_order),
            MAX(family),
            MAX(genus),
            MAX(species),
            MAX(scientific_name),
            COUNT(*)::int
        FROM occurrence_clean
        WHERE species_key IS NOT NULL
        GROUP BY species_key
        ON CONFLICT (species_key) DO UPDATE
            SET record_count = EXCLUDED.record_count,
                scientific_name = COALESCE(EXCLUDED.scientific_name, species_lookup.scientific_name),
                species = COALESCE(EXCLUDED.species, species_lookup.species)
    """)
    count = cur.rowcount
    conn.commit()
    cur.close()
    return count


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default=DEFAULT_INPUT, help="TSV 文件路径")
    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(f"文件不存在: {args.input}")
        sys.exit(1)

    print(f"连接数据库...")
    conn = psycopg2.connect(DB_DSN)

    print(f"导入 occurrence_clean: {args.input}")
    n = import_occurrences(conn, args.input)
    print(f"  [OK] 导入 {n} 条记录")

    print("构建 species_lookup...")
    s = build_species_lookup(conn)
    print(f"  [OK] 写入 {s} 个物种")

    conn.close()
    print("完成。")


if __name__ == "__main__":
    main()
