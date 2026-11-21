"""
Preference learner for route ranking.

What this is (and is not)
-------------------------
Pathfinding is done by the transit API. The backend turns each candidate
itinerary into a small feature vector (duration, transfers, walking, CO2,
green space, mode shares, accessibility, schedule fit) and a vector of
*prior weights* derived from the user's settings.

This module learns a per-user correction to those weights from the routes the
user actually picks:

    score(route) = (prior + delta_user) . features(route)

Each time the user picks route c over the alternatives r1..rn that were shown
with it, we take one gradient step of pairwise logistic regression
(Bradley-Terry / RankNet with a linear scorer) on every pair (c, r):

    p     = sigmoid(w . (x_c - x_r))        # model's belief that c beats r
    delta += lr * (1 - p) * (x_c - x_r)     # move toward the observed choice

followed by a small decay of delta toward zero so stale habits fade and the
explicit settings stay the anchor. With no feedback delta is zero and the
ranking is exactly the settings-only ranking, so the cold start is sane.
"""

from __future__ import annotations

import json
import math
import threading
from pathlib import Path

Vector = dict[str, float]

LEARNING_RATE = 0.6
DECAY = 0.02  # fraction of delta forgotten per feedback event
MAX_DELTA = 4.0  # cap so a few taps can't override e.g. the elevator requirement (-6)


def dot(w: Vector, x: Vector) -> float:
    return sum(w.get(k, 0.0) * v for k, v in x.items())


def _sigmoid(z: float) -> float:
    if z >= 0:
        return 1.0 / (1.0 + math.exp(-z))
    e = math.exp(z)
    return e / (1.0 + e)


class PreferenceLearner:
    """Per-user weight corrections, persisted to a JSON file."""

    def __init__(self, store_path: str | Path | None = None):
        self._path = Path(store_path) if store_path else None
        self._lock = threading.Lock()
        self._users: dict[str, dict] = {}
        if self._path and self._path.exists():
            self._users = json.loads(self._path.read_text())

    # -- reading -----------------------------------------------------------
    def delta(self, user_id: str) -> Vector:
        return dict(self._users.get(user_id, {}).get("delta", {}))

    def feedback_count(self, user_id: str) -> int:
        return int(self._users.get(user_id, {}).get("count", 0))

    def weights(self, user_id: str, prior: Vector) -> Vector:
        delta = self.delta(user_id)
        return {k: prior.get(k, 0.0) + delta.get(k, 0.0) for k in set(prior) | set(delta)}

    def rank(self, user_id: str, prior: Vector, candidates: dict[str, Vector]) -> dict[str, float]:
        w = self.weights(user_id, prior)
        return {cid: dot(w, x) for cid, x in candidates.items()}

    # -- learning ----------------------------------------------------------
    def learn(self, user_id: str, prior: Vector, chosen: Vector, rejected: list[Vector]) -> Vector:
        with self._lock:
            state = self._users.setdefault(user_id, {"delta": {}, "count": 0})
            delta: Vector = state["delta"]
            for other in rejected:
                diff = {k: chosen.get(k, 0.0) - other.get(k, 0.0) for k in set(chosen) | set(other)}
                w = {k: prior.get(k, 0.0) + delta.get(k, 0.0) for k in set(prior) | set(delta) | set(diff)}
                step = LEARNING_RATE * (1.0 - _sigmoid(dot(w, diff)))
                for k, d in diff.items():
                    if d:
                        delta[k] = delta.get(k, 0.0) + step * d
            for k in list(delta):
                delta[k] = max(-MAX_DELTA, min(MAX_DELTA, delta[k] * (1.0 - DECAY)))
            state["count"] += 1
            self._save()
            return dict(delta)

    def reset(self, user_id: str) -> None:
        with self._lock:
            self._users.pop(user_id, None)
            self._save()

    def _save(self) -> None:
        if self._path:
            self._path.parent.mkdir(parents=True, exist_ok=True)
            self._path.write_text(json.dumps(self._users, indent=1))
