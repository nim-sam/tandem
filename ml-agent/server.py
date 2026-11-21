"""
HTTP API for the route-ranking agent. See agent/ranker.py for the model.

The Go backend is the only client. It keeps working (settings-only ranking)
when this service is not running.
"""

import os

from fastapi import FastAPI
from pydantic import BaseModel

from agent.ranker import PreferenceLearner

app = FastAPI(title="Route ranking agent", version="2.0.0")
learner = PreferenceLearner(os.getenv("WEIGHTS_PATH", "data/weights.json"))

Vector = dict[str, float]


class Candidate(BaseModel):
    id: str
    features: Vector


class RankPayload(BaseModel):
    user_id: str
    prior_weights: Vector
    candidates: list[Candidate]


class FeedbackPayload(BaseModel):
    user_id: str
    prior_weights: Vector
    chosen: Vector
    rejected: list[Vector]


@app.get("/health")
def health():
    return {"status": "ok", "agent": "route-ranker", "policy": "pairwise-logistic"}


@app.post("/rank")
def rank(payload: RankPayload):
    """Score candidates with prior + learned weights. Higher is better."""
    return {
        "scores": learner.rank(payload.user_id, payload.prior_weights, {c.id: c.features for c in payload.candidates}),
        "weights": learner.weights(payload.user_id, payload.prior_weights),
        "feedback_count": learner.feedback_count(payload.user_id),
    }


@app.post("/feedback")
def feedback(payload: FeedbackPayload):
    """The user picked `chosen` over every route in `rejected`."""
    delta = learner.learn(payload.user_id, payload.prior_weights, payload.chosen, payload.rejected)
    return {"learned_delta": delta, "feedback_count": learner.feedback_count(payload.user_id)}


@app.get("/weights/{user_id}")
def weights(user_id: str):
    """What has been learned for a user (for the demo / a 'why' screen)."""
    return {"learned_delta": learner.delta(user_id), "feedback_count": learner.feedback_count(user_id)}


@app.delete("/weights/{user_id}")
def reset(user_id: str):
    learner.reset(user_id)
    return {"status": "reset"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("server:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
