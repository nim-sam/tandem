package service

import (
	"context"
	"math"

	"github.com/nim-sam/codejam16/backend/internal/domain"
)

type EcoService struct{}

func NewEcoService() *EcoService {
	return &EcoService{}
}

// CalculateCO2Savings evaluates emissions for a commute against an equivalent solo ICE car trip.
func (s *EcoService) CalculateCO2Savings(ctx context.Context, route domain.Route) domain.EcoMetric {
	totalKm := float64(route.TotalDistanceMeters) / 1000.0
	baselineCarCO2 := totalKm * domain.BaselineCarCO2GramsPerKm
	savedGrams := math.Max(0, baselineCarCO2-route.CO2EmissionsGrams)

	percentage := 0.0
	if baselineCarCO2 > 0 {
		percentage = (savedGrams / baselineCarCO2) * 100.0
	}

	// 1 mature urban tree absorbs approximately 60g of CO2 daily
	treesEquivalent := savedGrams / 60.0

	return domain.EcoMetric{
		BaselineCarCO2Grams:    round(baselineCarCO2),
		ActualRouteCO2Grams:    round(route.CO2EmissionsGrams),
		CO2SavedGrams:          round(savedGrams),
		CO2SavedPercentage:     round(percentage),
		EquivalentTreesPlanted: round(treesEquivalent),
	}
}

func round(val float64) float64 {
	return float64(int(val*100)) / 100.0
}
