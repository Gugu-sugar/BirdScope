"""图表接口真实情景模拟测试（端到端，依赖本地真实数据库）。

复现前端三种典型操作流，验证预聚合事实表 occurrence_stats_monthly 接入后：
  1. 响应正确（状态码 + 结构 + 口径 sanity）
  2. 延迟在可接受范围内（预聚合后应远快于明细实时扫描）

与 test_app.py（mock 冒烟）不同，本测试直接打真实 DB。无数据库或事实表为空的
环境（如 CI）会自动 skipTest，不会失败。

运行：
    cd backend
    python -m unittest tests.test_chart_scenarios -v
"""
import sys
import time
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app

API = "/api/v1"
# 端到端（含 FastAPI 序列化 + 真实查询）单接口软上限；预聚合后实际远低于此
LATENCY_BUDGET_MS = 800.0


class ChartScenarioTests(unittest.TestCase):
    """前端图表面板的真实操作流模拟。"""

    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(app)
        # 前置探测：事实表必须有数据，否则整组跳过（非失败）
        try:
            resp = cls.client.get(f"{API}/stats/monthly", params={"year": 2024})
        except Exception as exc:  # 数据库不可达
            raise unittest.SkipTest(f"数据库不可达，跳过真实情景测试：{exc}")
        if resp.status_code != 200 or not resp.json():
            raise unittest.SkipTest("occurrence_stats_monthly 为空，先运行 build_stats.py")

    def _timed_get(self, path: str, params: dict) -> tuple[object, float]:
        """发起 GET 并返回 (json, 毫秒延迟)，同时断言 200 与延迟预算。"""
        t0 = time.perf_counter()
        resp = self.client.get(f"{API}{path}", params=params)
        elapsed = (time.perf_counter() - t0) * 1000
        self.assertEqual(resp.status_code, 200, f"{path} 返回 {resp.status_code}：{resp.text[:200]}")
        self.assertLess(
            elapsed, LATENCY_BUDGET_MS,
            f"{path} 延迟 {elapsed:.0f}ms 超过预算 {LATENCY_BUDGET_MS:.0f}ms",
        )
        print(f"  {path:<22} {str(params):<48} {elapsed:6.1f} ms")
        return resp.json(), elapsed

    def test_scenario_1_initial_dashboard_load(self) -> None:
        """情景1：打开页面，全局视角并发加载三个图表（全种、无月份过滤）。"""
        print("\n[情景1] 页面初始加载 — 全局视角全种聚合")

        trend, _ = self._timed_get("/stats/monthly", {"year": 2024})
        self.assertGreater(len(trend), 0)
        months = [row["month"] for row in trend]
        self.assertEqual(months, sorted(months), "月度趋势应按 month 升序")
        for row in trend:
            self.assertGreater(row["record_count"], 0)
            # individual_sum 可能为 NULL（规则：不静默填 0），但若有值须为正
            self.assertTrue(row["individual_sum"] is None or row["individual_sum"] > 0)

        rank, _ = self._timed_get("/species/rank", {"year": 2024, "limit": 8})
        self.assertLessEqual(len(rank), 8)
        self.assertGreater(len(rank), 0)
        counts = [row["record_count"] for row in rank]
        self.assertEqual(counts, sorted(counts, reverse=True), "物种排行应按 record_count 降序")
        for row in rank:
            self.assertTrue(row["species"], "展示名不应为空（fallback 到 scientific_name / key）")

        province, _ = self._timed_get("/stats/province", {"year": 2024})
        self.assertGreater(len(province), 0)
        self.assertLessEqual(len(province), 50)
        for row in province:
            self.assertIsNotNone(row["state_province"])

    def test_scenario_2_select_species_timeseries(self) -> None:
        """情景2：用户选中排行第一的物种，联动加载该物种的月度趋势与迁徙时间序列。"""
        print("\n[情景2] 选中物种 — 月度趋势 + 迁徙重心时间序列联动")

        rank, _ = self._timed_get("/species/rank", {"year": 2024, "limit": 1})
        self.assertTrue(rank, "排行为空，无法选种")
        species_key = rank[0]["species_key"]

        trend, _ = self._timed_get("/stats/monthly", {"year": 2024, "species_key": species_key})
        self.assertGreater(len(trend), 0)
        # 单种月度记录数总和不应超过全种 top1 排行的记录数
        self.assertLessEqual(sum(r["record_count"] for r in trend), rank[0]["record_count"])

        migration, _ = self._timed_get("/stats/migration", {"year": 2024, "species_key": species_key})
        self.assertGreater(len(migration), 0)
        self.assertLessEqual(len(migration), 12)
        for pt in migration:
            self.assertTrue(-180 <= pt["center_lon"] <= 180, "重心经度越界")
            self.assertTrue(-90 <= pt["center_lat"] <= 90, "重心纬度越界")
            self.assertGreater(pt["record_count"], 0)

    def test_scenario_3_time_slider_month_filter(self) -> None:
        """情景3：拖动时间滑块到某月，排行与地域分布按该月过滤刷新。"""
        print("\n[情景3] 时间滑块按月过滤 — 排行 + 地域分布刷新")

        # 取一个有数据的月份（用全种趋势的最后一个月）
        trend, _ = self._timed_get("/stats/monthly", {"year": 2024})
        target_month = trend[-1]["month"]

        rank_month, _ = self._timed_get(
            "/species/rank", {"year": 2024, "month": target_month, "limit": 8}
        )
        self.assertGreater(len(rank_month), 0)

        rank_all, _ = self._timed_get("/species/rank", {"year": 2024, "limit": 8})
        # 单月 top1 记录数不应超过全年 top1（同物种全年 ≥ 单月）
        self.assertLessEqual(rank_month[0]["record_count"], rank_all[0]["record_count"])

        province_month, _ = self._timed_get(
            "/stats/province", {"year": 2024, "month": target_month}
        )
        self.assertGreater(len(province_month), 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
