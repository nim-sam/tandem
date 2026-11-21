package domain

// FeatureVector is the numeric description of one candidate route that the
// ranker scores. Keys are feature names; the same keys are used for weights.
//
// The routing API does the pathfinding. Ranking only decides which of the
// candidate itineraries it returned is shown first for this user.
type FeatureVector map[string]float64

// Feature names. All are scaled to roughly 0..1 so weights are comparable.
const (
	FeatDuration     = "duration"     // total minutes / 60
	FeatTransfers    = "transfers"    // transfer count / 3
	FeatWalk         = "walk"         // walking minutes / 30
	FeatOverWalk     = "over_walk"    // walking minutes beyond the user's max / 15
	FeatCO2Saved     = "co2_saved"    // fraction of car-trip emissions avoided
	FeatNature       = "nature"       // share of walking that is in/along green space
	FeatBus          = "bus"          // share of trip time on a bus
	FeatMetro        = "metro"        // share of trip time on the metro
	FeatREM          = "rem"          // share of trip time on the REM
	FeatTrain        = "train"        // share of trip time on commuter rail
	FeatInaccessible = "inaccessible" // 1 if any leg is not step-free
	FeatTight        = "tight"        // 1 if it does not fit between the two events
)

// PriorWeights turns the user's explicit settings into starting weights.
// This is the cold-start policy: it is what ranks routes before any feedback
// exists, and what the backend falls back to when the ML agent is offline.
// The ML agent only learns a per-user correction on top of these.
func PriorWeights(prefs UserPreferences, natureMode bool) FeatureVector {
	w := FeatureVector{
		FeatDuration:     -3.0, // 10 extra minutes costs 0.5
		FeatTransfers:    -1.5, // one transfer costs 0.5 (about 10 minutes)
		FeatWalk:         0,
		FeatOverWalk:     -1.5,
		FeatCO2Saved:     1.0,
		FeatNature:       0.5,
		FeatBus:          0,
		FeatMetro:        0,
		FeatREM:          0,
		FeatTrain:        0,
		FeatInaccessible: -0.5,
		FeatTight:        -4.0,
	}
	if natureMode {
		w[FeatNature] = 2.0
	}
	if prefs.RequireElevator {
		w[FeatInaccessible] = -6.0
	}

	modeFeature := map[TransitMode]string{
		ModeWalk: FeatWalk, ModeBus: FeatBus, ModeMetro: FeatMetro, ModeREM: FeatREM, ModeTrain: FeatTrain,
	}
	// Earlier in the priority list = larger bonus.
	for rank, m := range prefs.PrioritizedModes {
		if f, ok := modeFeature[m]; ok {
			if bonus := 0.6 - 0.2*float64(rank); bonus > 0 {
				w[f] += bonus
			}
		}
	}
	for _, m := range prefs.AvoidedModes {
		if f, ok := modeFeature[m]; ok {
			w[f] = -3.0
		}
	}
	return w
}

// Dot returns the weighted score of a feature vector.
func (w FeatureVector) Dot(x FeatureVector) float64 {
	s := 0.0
	for k, v := range x {
		s += w[k] * v
	}
	return s
}
