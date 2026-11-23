"""即時成績核心（docs/live-core.js）：分段計時、名次、團體計分。
以 node 執行 tests/live_core_check.js，再逐項核對。
"""
import json, pathlib, shutil, subprocess

import pytest

ROOT = pathlib.Path(__file__).resolve().parents[1]


@pytest.fixture(scope="module")
def R():
    node = shutil.which("node")
    if not node:
        pytest.skip("未安裝 node")
    p = subprocess.run([node, str(ROOT / "tests/live_core_check.js")], capture_output=True, text=True, encoding="utf-8", check=True)
    return json.loads(p.stdout)


def test_team_champions_match_official(R):
    g = R["regression"]
    assert g["checked"] >= 36 and g["agree"] == g["checked"], g["bad"]


def test_five_laps_finish(R):
    assert R["fiveLaps"] == {"fin": True, "laps": 5, "t": 1250000, "splits": [250000] + [250000] * 4}


def test_duplicate_and_after_finish_ignored(R):
    assert R["dup"] == {"laps": 2, "ignored": ["dup"]}  # 3 秒後重複被忽略；force 的保留
    assert R["after"] == {"laps": 5, "ignored": ["after"]}


def test_mid_race_order(R):
    # 1001 已完成兩圈（完賽）最前；2001 第二圈；其後一圈者按經過次序
    assert R["midOrder"] == [[1001, 2, True, 1], [2001, 2, True, 2], [2002, 1, False, 3], [1003, 1, False, 4]]


def test_unfinished_have_no_place_when_done(R):
    assert R["dnf"] == [[1001, 1, False], [2001, None, True]]


def test_slots_anon_and_manual_finish(R):
    assert R["slots"]["slots"] == 1
    assert R["slots"]["runners"] == [["anon", True, 1], [1002, True, 2], [1001, False, 3]]


def test_group_by_public_key(R):
    assert R["byKey"] == {"n": 1, "fin": True}


def test_team_projection_mid_race(R):
    # 甲：1+3+4+6=14（已有 4 人在榜，未完賽＝暫計）；乙：2+5+7＋補位 8=22
    assert R["teamMid"] == [["甲", 1, 14, 14, False, 0], ["乙", 2, 14, 22, False, 1]]


def test_eta(R):
    assert R["eta"] == 750


def test_heats_merged_by_time(R):
    # C2 四人（490–495 秒）快過 C1 全部，合併排第 1–4；分組名次各自計算；C1 只跑一圈的 5 號在 C1 完成後列未完成
    assert R["heats"] == [[6, 1, 1, False], [7, 2, 2, False], [8, 3, 3, False], [9, 4, 4, False],
                          [1, 5, 1, False], [2, 6, 2, False], [3, 7, 3, False], [4, 8, 4, False], [5, None, None, True]]


def test_heats_team_pending_until_all_done(R):
    # 未完成全部分組：即使已有 4 人完賽亦只屬暫計
    assert R["heatTeams"]["pending"] == [["乙", 10, False], ["甲", 26, False]]
    assert R["heatTeams"]["final"] == [["乙", 1, 10, True], ["甲", 2, 26, True]]
