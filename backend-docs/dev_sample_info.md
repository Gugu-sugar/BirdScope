# dev_sample.tsv 说明

## 基本信息

| 项目 | 值 |
|------|-----|
| 行数 | 2000（不含表头）|
| 列数 | 20（occurrence_clean 所需全部字段）|
| 来源 | 原始 TSV 前 300 万行采样 |
| 格式 | UTF-8，制表符分隔 |

## 覆盖范围

**10 个国家 × 4 个月份 × 每桶 50 条 = 2000 条**

| 国家 | 说明 |
|------|------|
| AU | 澳大利亚（观测量最大） |
| IN | 印度 |
| GB | 英国 |
| BR | 巴西 |
| CN | 中国 |
| TW | 台湾 |
| ZA | 南非 |
| DE | 德国 |
| CO | 哥伦比亚 |
| AR | 阿根廷 |

月份：8、9、10、11（2024 年迁徙季）

## 边界情况（用于测试 NULL 处理）

| 情况 | 数量 |
|------|------|
| `species` 为空（仅有 scientificName） | 29 条（1.4%）|
| `individualCount` 为 NULL | 108 条（5.4%）|
| `order` 为空 | 8 条 |

## 与旧版 cn_sample_records.tsv 的区别

| 旧版 | 新版 |
|------|------|
| 500 条，仅中国 | 2000 条，10 国全球覆盖 |
| 10 列（缺 speciesKey/family 等）| 20 列（与 occurrence_clean 完全对应）|
| 无 NULL 边界情况 | 含 NULL species / NULL individualCount |
| 月份混合 | 4 个月份各桶均衡 |

## 使用方式

```python
import csv
with open('backend/test_data/dev_sample.tsv', encoding='utf-8', newline='') as f:
    reader = csv.DictReader(f, delimiter='\t')
    for row in reader:
        ...
```

直接用 `scripts/import_to_pg.py` 导入即可验证全套 API。
