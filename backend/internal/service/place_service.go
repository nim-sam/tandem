package service

import (
	"context"
	"fmt"
	"time"

	"github.com/nim-sam/codejam16/backend/internal/adapter/repository"
	"github.com/nim-sam/codejam16/backend/internal/domain"
)

type PlaceService struct {
	repo *repository.Repository
}

func NewPlaceService(repo *repository.Repository) *PlaceService {
	return &PlaceService{repo: repo}
}

func (s *PlaceService) GetCollections(ctx context.Context) []domain.Collection {
	return s.repo.GetCollections()
}

func (s *PlaceService) CreateCollection(ctx context.Context, col domain.Collection) domain.Collection {
	if col.ID == "" {
		col.ID = fmt.Sprintf("col-%d", time.Now().UnixNano())
	}
	col.CreatedAt = time.Now()
	s.repo.SaveCollection(col)
	return col
}

func (s *PlaceService) AddPlaceToCollection(ctx context.Context, colID string, place domain.SavedPlace) bool {
	if place.ID == "" {
		place.ID = fmt.Sprintf("sp-%d", time.Now().UnixNano())
	}
	place.CreatedAt = time.Now()
	return s.repo.AddPlaceToCollection(colID, place)
}

// UpdateCollection changes a collection's name, description, icon and colour.
func (s *PlaceService) UpdateCollection(ctx context.Context, id string, patch domain.Collection) (domain.Collection, error) {
	col, ok := s.repo.GetCollection(id)
	if !ok {
		return domain.Collection{}, ErrNotFound
	}
	if patch.Name != "" {
		col.Name = patch.Name
	}
	col.Description = patch.Description
	if patch.Icon != "" {
		col.Icon = patch.Icon
	}
	if patch.Color != "" {
		col.Color = patch.Color
	}
	s.repo.SaveCollection(col)
	return col, nil
}

func (s *PlaceService) DeleteCollection(ctx context.Context, id string) bool {
	return s.repo.DeleteCollection(id)
}

func (s *PlaceService) RemovePlace(ctx context.Context, colID, placeID string) bool {
	_, ok := s.repo.RemovePlace(colID, placeID)
	return ok
}

func (s *PlaceService) MovePlace(ctx context.Context, fromID, placeID, toID string) bool {
	return s.repo.MovePlace(fromID, placeID, toID)
}
