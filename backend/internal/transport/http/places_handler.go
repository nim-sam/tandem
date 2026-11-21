package http

import (
	"encoding/json"
	"net/http"

	"github.com/nim-sam/codejam16/backend/internal/domain"
)

func (s *Server) handleGetCollections(w http.ResponseWriter, r *http.Request) {
	cols := s.placeService.GetCollections(r.Context())
	respondJSON(w, http.StatusOK, map[string]interface{}{"collections": cols})
}

func (s *Server) handleCreateCollection(w http.ResponseWriter, r *http.Request) {
	var col domain.Collection
	if err := json.NewDecoder(r.Body).Decode(&col); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid collection payload")
		return
	}

	created := s.placeService.CreateCollection(r.Context(), col)
	respondJSON(w, http.StatusCreated, created)
}

func (s *Server) handleUpdateCollection(w http.ResponseWriter, r *http.Request) {
	var patch domain.Collection
	if err := json.NewDecoder(r.Body).Decode(&patch); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid collection payload")
		return
	}
	col, err := s.placeService.UpdateCollection(r.Context(), r.PathValue("id"), patch)
	if err != nil {
		respondError(w, http.StatusNotFound, "Collection not found")
		return
	}
	respondJSON(w, http.StatusOK, col)
}

func (s *Server) handleDeleteCollection(w http.ResponseWriter, r *http.Request) {
	if !s.placeService.DeleteCollection(r.Context(), r.PathValue("id")) {
		respondError(w, http.StatusNotFound, "Collection not found")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func (s *Server) handleAddPlaceToCollection(w http.ResponseWriter, r *http.Request) {
	colID := r.PathValue("id")
	var place domain.SavedPlace
	if err := json.NewDecoder(r.Body).Decode(&place); err != nil || place.Name == "" {
		respondError(w, http.StatusBadRequest, "Invalid place payload: name is required")
		return
	}

	// Places typed in by address get coordinates so they can be routed to.
	if place.Location.Latitude == 0 && place.Location.Longitude == 0 && place.Address != "" {
		if loc, err := s.calendarService.Geocode(r.Context(), place.Address); err == nil {
			place.Location.Latitude, place.Location.Longitude = loc.Latitude, loc.Longitude
		}
	}
	if place.Location.Name == "" {
		place.Location.Name = place.Name
	}
	if place.Location.Address == "" {
		place.Location.Address = place.Address
	}

	if !s.placeService.AddPlaceToCollection(r.Context(), colID, place) {
		respondError(w, http.StatusNotFound, "Collection not found")
		return
	}
	respondJSON(w, http.StatusCreated, map[string]string{"status": "place_added", "collection_id": colID})
}

func (s *Server) handleRemovePlace(w http.ResponseWriter, r *http.Request) {
	if !s.placeService.RemovePlace(r.Context(), r.PathValue("id"), r.PathValue("placeId")) {
		respondError(w, http.StatusNotFound, "Place not found")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func (s *Server) handleMovePlace(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ToCollectionID string `json:"to_collection_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ToCollectionID == "" {
		respondError(w, http.StatusBadRequest, "to_collection_id is required")
		return
	}
	if !s.placeService.MovePlace(r.Context(), r.PathValue("id"), r.PathValue("placeId"), req.ToCollectionID) {
		respondError(w, http.StatusNotFound, "Place or collection not found")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "moved", "collection_id": req.ToCollectionID})
}
