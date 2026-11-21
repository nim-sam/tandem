package places

import (
	_ "embed"
	"encoding/json"
	"math"
	"sort"
)

// Bundled OpenStreetMap parks / gardens / nature reserves for greater Montreal,
// as bounding boxes. Regenerate with scripts/fetch_green_spaces.py.
// Data (c) OpenStreetMap contributors, ODbL.
//
//go:embed data/green_spaces.json
var greenSpacesJSON []byte

type greenSpace struct {
	name                           string
	minLat, minLon, maxLat, maxLon float64
}

// GreenSpaceIndex answers "how much of this walk is in or beside a park?".
type GreenSpaceIndex struct {
	spaces []greenSpace // sorted by minLat
}

func NewGreenSpaceIndex() *GreenSpaceIndex {
	var rows [][]any
	_ = json.Unmarshal(greenSpacesJSON, &rows)
	idx := &GreenSpaceIndex{}
	for _, r := range rows {
		if len(r) != 5 {
			continue
		}
		name, _ := r[0].(string)
		f := func(i int) float64 { v, _ := r[i].(float64); return v }
		idx.spaces = append(idx.spaces, greenSpace{name, f(1), f(2), f(3), f(4)})
	}
	sort.Slice(idx.spaces, func(i, j int) bool { return idx.spaces[i].minLat < idx.spaces[j].minLat })
	return idx
}

// Len is the number of green spaces loaded.
func (g *GreenSpaceIndex) Len() int { return len(g.spaces) }

// marginDeg is how close (about 40 m) a point must be to count as "along" a park.
const marginDeg = 0.00036

// Score returns the share (0..1) of the given path points that lie in or right
// beside a green space, and the names of the spaces touched (largest share first).
// Bounding boxes overestimate irregular parks slightly; good enough to compare
// candidate walks against each other.
func (g *GreenSpaceIndex) Score(lats, lons []float64) (float64, []string) {
	if len(lats) == 0 {
		return 0, nil
	}
	lonMargin := marginDeg / math.Cos(lats[0]*math.Pi/180)
	hits := 0
	touched := map[string]int{}
	for i := range lats {
		// spaces are sorted by minLat: stop once boxes start north of the point
		end := sort.Search(len(g.spaces), func(j int) bool { return g.spaces[j].minLat > lats[i]+marginDeg })
		inside := false
		for _, s := range g.spaces[:end] {
			if lats[i] <= s.maxLat+marginDeg && lons[i] >= s.minLon-lonMargin && lons[i] <= s.maxLon+lonMargin {
				inside = true
				touched[s.name]++
			}
		}
		if inside {
			hits++
		}
	}
	names := make([]string, 0, len(touched))
	for n := range touched {
		names = append(names, n)
	}
	sort.Slice(names, func(i, j int) bool {
		if touched[names[i]] != touched[names[j]] {
			return touched[names[i]] > touched[names[j]]
		}
		return names[i] < names[j]
	})
	if len(names) > 3 {
		names = names[:3]
	}
	return float64(hits) / float64(len(lats)), names
}

// Park is a green space with its centre and approximate size.
type Park struct {
	Name     string
	Lat, Lon float64
	AreaM2   float64
	DetourKm float64 // extra straight-line distance vs. going direct
}

// BestParkBetween picks the largest park (at least 1 hectare) that can be
// walked through between two points with at most maxDetourKm of extra
// straight-line distance. ok is false when there is none.
func (g *GreenSpaceIndex) BestParkBetween(lat1, lon1, lat2, lon2, maxDetourKm float64) (Park, bool) {
	direct := haversineDistance(lat1, lon1, lat2, lon2)
	var best Park
	found := false
	for _, s := range g.spaces {
		cLat, cLon := (s.minLat+s.maxLat)/2, (s.minLon+s.maxLon)/2
		detour := haversineDistance(lat1, lon1, cLat, cLon) + haversineDistance(cLat, cLon, lat2, lon2) - direct
		if detour > maxDetourKm {
			continue
		}
		h := (s.maxLat - s.minLat) * 111320
		w := (s.maxLon - s.minLon) * 111320 * math.Cos(cLat*math.Pi/180)
		area := h * w
		if area < 10000 {
			continue
		}
		if !found || area > best.AreaM2 {
			best, found = Park{Name: s.name, Lat: cLat, Lon: cLon, AreaM2: area, DetourKm: detour}, true
		}
	}
	return best, found
}
