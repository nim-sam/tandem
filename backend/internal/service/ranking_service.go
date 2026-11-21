package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/nim-sam/tandem/backend/internal/domain"
)

// Ranker scores candidate routes. Scoring is always weights . features.
//
//   - Without the ML agent, weights are the prior derived from the user's
//     settings (domain.PriorWeights).
//   - With the ML agent, weights are prior + a per-user correction it has
//     learned from which alternatives the user actually picked.
//
// The agent is optional by design: if it is down, slow or returns nonsense the
// app behaves exactly like a preferences-only planner.
type Ranker struct {
	agentURL string
	http     *http.Client

	mu        sync.Mutex
	downUntil time.Time // skip the agent until then after a failure
}

func NewRanker(agentURL string) *Ranker {
	return &Ranker{agentURL: agentURL, http: &http.Client{Timeout: 1500 * time.Millisecond}}
}

// RankResult is the outcome of scoring one set of candidates.
type RankResult struct {
	Scores        []float64            // same order as the candidates passed in
	Weights       domain.FeatureVector // the weights that produced the scores
	RankedBy      string               // "ml-agent" or "preferences"
	FeedbackCount int                  // choices the agent has learned from for this user
}

type rankCandidate struct {
	ID       string               `json:"id"`
	Features domain.FeatureVector `json:"features"`
}

// Rank scores candidates for a user.
func (r *Ranker) Rank(ctx context.Context, userID string, prior domain.FeatureVector, candidates []domain.FeatureVector) RankResult {
	fallback := RankResult{Weights: prior, RankedBy: "preferences", Scores: make([]float64, len(candidates))}
	for i, c := range candidates {
		fallback.Scores[i] = prior.Dot(c)
	}

	payload := map[string]any{"user_id": userID, "prior_weights": prior}
	cands := make([]rankCandidate, len(candidates))
	for i, c := range candidates {
		cands[i] = rankCandidate{ID: fmt.Sprint(i), Features: c}
	}
	payload["candidates"] = cands

	var resp struct {
		Scores        map[string]float64   `json:"scores"`
		Weights       domain.FeatureVector `json:"weights"`
		FeedbackCount int                  `json:"feedback_count"`
	}
	if err := r.post(ctx, "/rank", payload, &resp); err != nil || len(resp.Scores) != len(candidates) {
		return fallback
	}
	// With nothing learned yet the agent's weights equal the prior, so the
	// ranking is still purely the user's settings: say so.
	rankedBy := "preferences"
	if resp.FeedbackCount > 0 {
		rankedBy = "ml-agent"
	}
	out := RankResult{Weights: resp.Weights, RankedBy: rankedBy, FeedbackCount: resp.FeedbackCount, Scores: make([]float64, len(candidates))}
	for i := range candidates {
		out.Scores[i] = resp.Scores[fmt.Sprint(i)]
	}
	return out
}

// Feedback tells the agent the user picked `chosen` over `rejected`.
func (r *Ranker) Feedback(ctx context.Context, userID string, prior, chosen domain.FeatureVector, rejected []domain.FeatureVector) error {
	payload := map[string]any{"user_id": userID, "prior_weights": prior, "chosen": chosen, "rejected": rejected}
	return r.post(ctx, "/feedback", payload, nil)
}

// Available reports whether the agent answered its health check.
func (r *Ranker) Available(ctx context.Context) bool {
	ctx, cancel := context.WithTimeout(ctx, time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, r.agentURL+"/health", nil)
	if err != nil {
		return false
	}
	resp, err := r.http.Do(req)
	if err != nil {
		return false
	}
	resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}

func (r *Ranker) post(ctx context.Context, path string, payload, out any) error {
	r.mu.Lock()
	down := time.Now().Before(r.downUntil)
	r.mu.Unlock()
	if down || r.agentURL == "" {
		return fmt.Errorf("ml agent unavailable")
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, r.agentURL+path, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := r.http.Do(req)
	if err != nil {
		// Don't pay the timeout on every request while the agent is down.
		r.mu.Lock()
		r.downUntil = time.Now().Add(30 * time.Second)
		r.mu.Unlock()
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("ml agent %s: HTTP %d", path, resp.StatusCode)
	}
	if out == nil {
		return nil
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

// Learned returns what the agent has learned for a user: the per-feature
// correction to the prior weights, and how many choices it has seen.
func (r *Ranker) Learned(ctx context.Context, userID string) (domain.FeatureVector, int, error) {
	if r.agentURL == "" {
		return nil, 0, fmt.Errorf("ml agent unavailable")
	}
	var out struct {
		LearnedDelta  domain.FeatureVector `json:"learned_delta"`
		FeedbackCount int                  `json:"feedback_count"`
	}
	if err := r.request(ctx, http.MethodGet, "/weights/"+userID, &out); err != nil {
		return nil, 0, err
	}
	return out.LearnedDelta, out.FeedbackCount, nil
}

// Forget erases everything the agent learned for a user.
func (r *Ranker) Forget(ctx context.Context, userID string) error {
	if r.agentURL == "" {
		return fmt.Errorf("ml agent unavailable")
	}
	return r.request(ctx, http.MethodDelete, "/weights/"+userID, nil)
}

func (r *Ranker) request(ctx context.Context, method, path string, out any) error {
	req, err := http.NewRequestWithContext(ctx, method, r.agentURL+path, nil)
	if err != nil {
		return err
	}
	resp, err := r.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("ml agent %s: HTTP %d", path, resp.StatusCode)
	}
	if out == nil {
		return nil
	}
	return json.NewDecoder(resp.Body).Decode(out)
}
