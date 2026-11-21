package domain

// TransitModeCO2GramsPerKm provides standard carbon emission baselines.
// ICE Car average: ~170g CO2/km
// Bus average: ~68g CO2/km
// Metro / REM (Quebec Hydroelectric grid): ~10g CO2/km
// Walk / Bike: 0g CO2/km
var TransitModeCO2GramsPerKm = map[TransitMode]float64{
	ModeWalk:  0.0,
	ModeBike:  0.0,
	ModeMetro: 10.0,
	ModeREM:   8.0,
	ModeBus:   68.0,
	ModeTrain: 45.0, // diesel commuter rail, rough per-passenger estimate
}

const BaselineCarCO2GramsPerKm = 171.0
