package transit

import "math"

// Point is a lat/lon pair.
type Point struct{ Lat, Lon float64 }

// DecodePolyline decodes a Google-style encoded polyline. precision is the
// number of decimal digits (5 for Google, 6 for MOTIS/Valhalla).
func DecodePolyline(encoded string, precision int) []Point {
	if precision <= 0 {
		precision = 5
	}
	factor := math.Pow10(precision)
	var pts []Point
	lat, lon := 0, 0
	for i := 0; i < len(encoded); {
		for _, target := range []*int{&lat, &lon} {
			result, shift := 0, uint(0)
			for i < len(encoded) {
				b := int(encoded[i]) - 63
				i++
				result |= (b & 0x1f) << shift
				shift += 5
				if b < 0x20 {
					break
				}
			}
			if result&1 != 0 {
				*target += ^(result >> 1)
			} else {
				*target += result >> 1
			}
		}
		pts = append(pts, Point{float64(lat) / factor, float64(lon) / factor})
	}
	return pts
}

// HaversineMeters is the great-circle distance between two points.
func HaversineMeters(lat1, lon1, lat2, lon2 float64) float64 {
	const r = 6371000.0
	rad := math.Pi / 180
	dLat, dLon := (lat2-lat1)*rad, (lon2-lon1)*rad
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*rad)*math.Cos(lat2*rad)*math.Sin(dLon/2)*math.Sin(dLon/2)
	return 2 * r * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
}

// PathMeters is the length of a decoded polyline.
func PathMeters(pts []Point) float64 {
	total := 0.0
	for i := 1; i < len(pts); i++ {
		total += HaversineMeters(pts[i-1].Lat, pts[i-1].Lon, pts[i].Lat, pts[i].Lon)
	}
	return total
}
