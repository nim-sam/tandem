package places

import (
	"fmt"
	"math"
	"sort"
	"strings"

	"github.com/nim-sam/tandem/backend/internal/domain"
)

// Words a search can be narrowed down with, per category. Each is a test on
// what OpenStreetMap records about a place; there is no price information
// there, so "quick bite" (counter service) is the nearest thing to "cheap".
var cuisineGroups = map[string][]string{
	"coffee":         {"coffee_shop", "coffee"},
	"bubble_tea":     {"bubble_tea", "tea"},
	"bakery":         {"bakery", "pastry", "bagel", "breakfast", "donut"},
	"pizza":          {"pizza"},
	"burgers":        {"burger"},
	"sushi":          {"sushi", "poke"},
	"asian":          {"asian", "chinese", "vietnamese", "thai", "japanese", "korean", "ramen", "noodle", "indian"},
	"italian":        {"italian", "pasta"},
	"mexican":        {"mexican", "tacos", "burrito"},
	"middle_eastern": {"lebanese", "kebab", "middle_eastern", "shawarma", "falafel", "mediterranean", "greek"},
}

func hasCuisine(p domain.ThirdPlace, group string) bool {
	for _, word := range cuisineGroups[group] {
		if strings.Contains(p.Cuisine, word) {
			return true
		}
	}
	return false
}

// matches reports whether a place belongs to the category and passes every
// word it is narrowed down with.
func matches(p domain.ThirdPlace, category string, refine []string) bool {
	switch category {
	case "cafe":
		// a library is a place to sit and work too, so "study" lets it in
		if p.Type != "cafe" && !(p.Type == "library" && contains(refine, "study")) {
			return false
		}
	case "restaurant":
		if p.Type != "restaurant" && p.Type != "fast_food" {
			return false
		}
	default:
		return false
	}
	for _, r := range refine {
		switch r {
		case "study":
			if !p.HasWifi {
				return false
			}
		case "terrace":
			if !p.OutdoorSeating {
				return false
			}
		case "vegetarian":
			if !p.Vegetarian {
				return false
			}
		case "quick_bite":
			if p.Type != "fast_food" {
				return false
			}
		case "sit_down":
			if p.Type != "restaurant" {
				return false
			}
		default:
			if _, known := cuisineGroups[r]; known && !hasCuisine(p, r) {
				return false
			}
		}
	}
	return true
}

func contains(list []string, s string) bool {
	for _, v := range list {
		if v == s {
			return true
		}
	}
	return false
}

// kindOf says what a place is, in a couple of words.
func kindOf(p domain.ThirdPlace) string {
	first := strings.FieldsFunc(p.Cuisine, func(r rune) bool { return r == ';' || r == ',' })
	cuisine := ""
	if len(first) > 0 {
		cuisine = strings.ReplaceAll(strings.TrimSpace(first[0]), "_", " ")
	}
	switch p.Type {
	case "library":
		return "Library"
	case "cafe":
		if cuisine != "" && cuisine != "coffee shop" {
			return "Café · " + cuisine
		}
		return "Café"
	case "fast_food":
		if cuisine != "" {
			return "Quick bite · " + cuisine
		}
		return "Quick bite"
	default:
		if cuisine != "" {
			return "Restaurant · " + cuisine
		}
		return "Restaurant"
	}
}

func nearby(id, name, category, kind string, lat, lon, fromLat, fromLon float64) domain.NearbyPlace {
	km := haversineDistance(fromLat, fromLon, lat, lon)
	return domain.NearbyPlace{
		ID: id, Name: name, Category: category, Kind: kind,
		Location:       domain.Location{Name: name, Latitude: lat, Longitude: lon},
		DistanceMeters: int(math.Round(km * 1000)),
		WalkMinutes:    int(math.Ceil(km * 12)),
	}
}

// Near lists the cafés or restaurants closest to a point, nearest first.
// category is "cafe" or "restaurant"; refine narrows it down (see matches).
func (c *ThirdPlaceCatalog) Near(lat, lon float64, category string, refine []string, limit int) []domain.NearbyPlace {
	out := []domain.NearbyPlace{}
	for _, p := range c.places {
		if !matches(p, category, refine) {
			continue
		}
		out = append(out, nearby(p.ID, p.Name, category, kindOf(p), p.Location.Latitude, p.Location.Longitude, lat, lon))
	}
	sort.Slice(out, func(i, j int) bool { return out[i].DistanceMeters < out[j].DistanceMeters })
	if len(out) > limit {
		out = out[:limit]
	}
	return out
}

// Near lists the parks closest to a point, nearest first. refine may hold
// "large" (at least 4 hectares) or "small" (under 1 hectare).
func (g *GreenSpaceIndex) Near(lat, lon float64, refine []string, limit int) []domain.NearbyPlace {
	out := []domain.NearbyPlace{}
	for i, s := range g.spaces {
		cLat, cLon := (s.minLat+s.maxLat)/2, (s.minLon+s.maxLon)/2
		area := (s.maxLat - s.minLat) * 111320 * (s.maxLon - s.minLon) * 111320 * math.Cos(cLat*math.Pi/180)
		if contains(refine, "large") && area < 40000 {
			continue
		}
		if contains(refine, "small") && area >= 10000 {
			continue
		}
		kind := "Park"
		if area >= 40000 {
			kind = "Large park"
		} else if area < 10000 {
			kind = "Small park"
		}
		out = append(out, nearby(fmt.Sprintf("park-%d", i), s.name, "nature", kind, cLat, cLon, lat, lon))
	}
	sort.Slice(out, func(i, j int) bool { return out[i].DistanceMeters < out[j].DistanceMeters })
	if len(out) > limit {
		out = out[:limit]
	}
	return out
}
