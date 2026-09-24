"""Load official data once, validate it and expose immutable core objects."""

import hashlib
import json
from collections.abc import Mapping
from dataclasses import dataclass
from fractions import Fraction
from pathlib import Path
from types import MappingProxyType

INDICATORS = ("T1", "T2", "E1", "E2", "S1", "S2", "B1", "B2", "C1", "C2")
CATEGORIES = ("transport", "ecology", "social", "safety", "services")


def numbers(values: dict) -> Mapping[str, Fraction]:
    return MappingProxyType({k: Fraction(str(v)) for k, v in values.items()})


@dataclass(frozen=True)
class DistrictData:
    id: str
    name: str
    population_share: Fraction
    indicators: Mapping[str, Fraction]
    profile: str


@dataclass(frozen=True)
class MeasureData:
    id: str
    name: str
    category: str
    scope: str
    cost: int
    lag: int
    effects: Mapping[str, Fraction]


@dataclass(frozen=True)
class SynergyRule:
    measures: tuple[str, str]
    district_from: str
    effects: Mapping[str, Fraction]


@dataclass(frozen=True)
class ConflictRule:
    measures: tuple[str, str]
    scope: str
    reason: str


@dataclass(frozen=True)
class Catalog:
    districts: Mapping[str, DistrictData]
    measures: Mapping[str, MeasureData]
    weights: Mapping[str, Fraction]
    indicator_categories: Mapping[str, str]
    indicator_names: Mapping[str, str]
    synergies: tuple[SynergyRule, ...]
    conflicts: tuple[ConflictRule, ...]
    version: str
    checksum: str
    budget: int
    decision_count: int
    max_per_category: int
    horizon: int
    critical_threshold: Fraction
    critical_penalty: Fraction
    city_weight: Fraction
    weakest_weight: Fraction
    notice: str


def load_catalog(directory: Path | None = None) -> Catalog:
    directory = directory or Path(__file__).resolve().parents[3] / "shared"
    raw = {
        name: (directory / name).read_bytes() for name in ("districts.json", "measures.json", "model.json")
    }
    data = {name: json.loads(content) for name, content in raw.items()}
    model = data["model.json"]
    district_rows = data["districts.json"]
    measure_rows = data["measures.json"]
    districts = {
        d["id"]: DistrictData(
            d["id"],
            d["name"],
            Fraction(str(d["population_share"])),
            numbers(d["indicators"]),
            d["profile"],
        )
        for d in district_rows
    }
    measures = {
        m["id"]: MeasureData(
            m["id"],
            m["name"],
            m["category"],
            m["scope"],
            m["cost"],
            m["lag"],
            numbers(m["effects"]),
        )
        for m in measure_rows
    }
    weights = numbers({i["id"]: i["weight"] for i in model["indicators"]})

    def require(condition: bool, message: str) -> None:
        if not condition:
            raise ValueError(f"Invalid official dataset: {message}")

    require(len(districts) == len(district_rows) == 5, "five unique districts required")
    require(set(districts) == {"esil", "almaty", "saryarka", "baikonur", "nura"}, "district IDs")
    require(len(measures) == len(measure_rows) == 14, "fourteen unique measures required")
    require(set(measures) == {f"M{i}" for i in range(1, 15)}, "measure IDs")
    require(set(weights) == set(INDICATORS) and sum(weights.values()) == 1, "indicator weights")
    require(sum(d.population_share for d in districts.values()) == 1, "population weights")
    require(model["horizon_quarters"] > 0, "positive horizon required")
    require(
        Fraction(str(model["city_weight"])) + Fraction(str(model["weakest_weight"])) == 1, "score weights"
    )
    for district in districts.values():
        require(0 < district.population_share <= 1, "population range")
        require(set(district.indicators) == set(INDICATORS), "all ten indicators required")
        require(all(0 <= n <= 100 for n in district.indicators.values()), "indicator range")
    for measure in measures.values():
        require(measure.scope in ("district", "city"), "measure scope")
        require(measure.category in CATEGORIES, "measure category")
        require(type(measure.cost) is int and measure.cost > 0, "measure cost")
        require(type(measure.lag) is int and 0 <= measure.lag <= model["horizon_quarters"], "lag")
        require(bool(measure.effects) and set(measure.effects) <= set(INDICATORS), "effects")
    synergies = tuple(
        SynergyRule(tuple(s["measures"]), s["district_from"], numbers(s["effects"]))
        for s in model["synergies"]
    )
    conflicts = tuple(
        ConflictRule(tuple(c["measures"]), c["scope"], c["reason"]) for c in model["incompatibilities"]
    )
    for rule in (*synergies, *conflicts):
        require(len(rule.measures) == 2 and len(set(rule.measures)) == 2, "rule pair")
        require(set(rule.measures) <= set(measures), "rule measure IDs")
    for rule in synergies:
        require(
            rule.district_from in rule.measures and measures[rule.district_from].scope == "district",
            "synergy target",
        )
        require(set(rule.effects) <= set(INDICATORS), "synergy indicators")
    for rule in conflicts:
        require(rule.scope in ("global", "same_district"), "conflict scope")
    canonical = json.dumps(data, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return Catalog(
        MappingProxyType(districts),
        MappingProxyType(measures),
        weights,
        MappingProxyType({i["id"]: i["category"] for i in model["indicators"]}),
        MappingProxyType({i["id"]: i["name"] for i in model["indicators"]}),
        synergies,
        conflicts,
        model["model_version"],
        hashlib.sha256(canonical.encode()).hexdigest(),
        model["budget"],
        model["decision_count"],
        model["max_per_category"],
        model["horizon_quarters"],
        Fraction(str(model["critical_threshold"])),
        Fraction(str(model["critical_penalty"])),
        Fraction(str(model["city_weight"])),
        Fraction(str(model["weakest_weight"])),
        model["data_notice"],
    )
