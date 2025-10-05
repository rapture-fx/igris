package cache

import (
	"context"
	"fmt"
	"math"
	"sync"
	"time"

	"github.com/rs/zerolog"
	"gopkg.in/yaml.v3"
)

// RegionConfig holds configuration for a cache region
type RegionConfig struct {
	Name    string `yaml:"name"`
	Primary struct {
		Host     string `yaml:"host"`
		Port     int    `yaml:"port"`
		DB       int    `yaml:"db"`
		PoolSize int    `yaml:"pool_size"`
		TTL      int    `yaml:"ttl"`
	} `yaml:"primary"`
	Backup *struct {
		Host     string `yaml:"host"`
		Port     int    `yaml:"port"`
		DB       int    `yaml:"db"`
		PoolSize int    `yaml:"pool_size"`
		TTL      int    `yaml:"ttl"`
	} `yaml:"backup,omitempty"`
	Coordinates struct {
		Latitude  float64 `yaml:"latitude"`
		Longitude float64 `yaml:"longitude"`
	} `yaml:"coordinates"`
}

// CacheTopologyConfig holds the complete cache topology configuration
type CacheTopologyConfig struct {
	Global struct {
		DefaultTTL       int    `yaml:"default_ttl"`
		EnableGeoRouting bool   `yaml:"enable_geo_routing"`
		FallbackStrategy string `yaml:"fallback_strategy"`
	} `yaml:"global"`
	Regions map[string]RegionConfig `yaml:"regions"`
	Central struct {
		Name       string `yaml:"name"`
		Host       string `yaml:"host"`
		Port       int    `yaml:"port"`
		DB         int    `yaml:"db"`
		PoolSize   int    `yaml:"pool_size"`
		TTL        int    `yaml:"ttl"`
		MaxRetries int    `yaml:"max_retries"`
	} `yaml:"central"`
	HealthCheck struct {
		Enabled          bool `yaml:"enabled"`
		Interval         int  `yaml:"interval"`
		Timeout          int  `yaml:"timeout"`
		FailureThreshold int  `yaml:"failure_threshold"`
	} `yaml:"health_check"`
	Affinity   map[string]string `yaml:"affinity"`
	Monitoring struct {
		EnableMetrics   bool   `yaml:"enable_metrics"`
		MetricsPort     int    `yaml:"metrics_port"`
		PrometheusPath  string `yaml:"prometheus_path"`
		LogCacheHits    bool   `yaml:"log_cache_hits"`
		LogCacheMisses  bool   `yaml:"log_cache_misses"`
	} `yaml:"monitoring"`
}

// RegionHealth tracks health status of a cache region
type RegionHealth struct {
	Region         string
	IsHealthy      bool
	LastCheck      time.Time
	FailureCount   int
	LastError      error
	mu             sync.RWMutex
}

// GeoRouter routes cache requests to the nearest available cache region
type GeoRouter struct {
	config        *CacheTopologyConfig
	regionCaches  map[string]*PredictionCache
	centralCache  *PredictionCache
	regionHealth  map[string]*RegionHealth
	logger        zerolog.Logger
	mu            sync.RWMutex
}

// NewGeoRouter creates a new geographic cache router
func NewGeoRouter(configData []byte, logger zerolog.Logger) (*GeoRouter, error) {
	var config CacheTopologyConfig
	if err := yaml.Unmarshal(configData, &config); err != nil {
		return nil, fmt.Errorf("failed to parse cache topology config: %w", err)
	}

	gr := &GeoRouter{
		config:       &config,
		regionCaches: make(map[string]*PredictionCache),
		regionHealth: make(map[string]*RegionHealth),
		logger:       logger.With().Str("component", "geo-router").Logger(),
	}

	// Initialize central cache
	centralConfig := Config{
		Address:      fmt.Sprintf("%s:%d", config.Central.Host, config.Central.Port),
		DB:           config.Central.DB,
		PoolSize:     config.Central.PoolSize,
		MaxRetries:   config.Central.MaxRetries,
		TTL:          time.Duration(config.Central.TTL) * time.Second,
	}

	centralCache, err := NewPredictionCache(centralConfig, logger)
	if err != nil {
		gr.logger.Warn().
			Err(err).
			Str("host", config.Central.Host).
			Msg("Failed to initialize central cache, will retry on demand")
		// Don't fail - central cache is optional
	} else {
		gr.centralCache = centralCache
		gr.logger.Info().Msg("Central cache initialized")
	}

	// Initialize regional caches (best effort)
	for regionKey, regionCfg := range config.Regions {
		regionConfig := Config{
			Address:    fmt.Sprintf("%s:%d", regionCfg.Primary.Host, regionCfg.Primary.Port),
			DB:         regionCfg.Primary.DB,
			PoolSize:   regionCfg.Primary.PoolSize,
			MaxRetries: 3,
			TTL:        time.Duration(regionCfg.Primary.TTL) * time.Second,
		}

		cache, err := NewPredictionCache(regionConfig, logger)
		if err != nil {
			gr.logger.Warn().
				Err(err).
				Str("region", regionKey).
				Str("host", regionCfg.Primary.Host).
				Msg("Failed to initialize regional cache, will use fallback")
			continue
		}

		gr.regionCaches[regionKey] = cache
		gr.regionHealth[regionKey] = &RegionHealth{
			Region:    regionKey,
			IsHealthy: true,
			LastCheck: time.Now(),
		}

		gr.logger.Info().
			Str("region", regionKey).
			Str("name", regionCfg.Name).
			Msg("Regional cache initialized")
	}

	// Start health check worker if enabled
	if config.HealthCheck.Enabled {
		go gr.startHealthCheckWorker()
	}

	gr.logger.Info().
		Int("regions", len(gr.regionCaches)).
		Bool("geo_routing", config.Global.EnableGeoRouting).
		Msg("Geo router initialized")

	return gr, nil
}

// RouteRequest routes a cache request to the appropriate regional cache
func (gr *GeoRouter) RouteRequest(ctx context.Context, clientRegion string) (*PredictionCache, error) {
	gr.mu.RLock()
	defer gr.mu.RUnlock()

	// If geo routing is disabled, always use central cache
	if !gr.config.Global.EnableGeoRouting {
		if gr.centralCache != nil {
			return gr.centralCache, nil
		}
		return nil, fmt.Errorf("central cache not available")
	}

	// Map client region to cache region using affinity rules
	cacheRegion := gr.config.Affinity[clientRegion]
	if cacheRegion == "" {
		// Unknown region, use central cache
		gr.logger.Debug().
			Str("client_region", clientRegion).
			Msg("No affinity mapping found, using central cache")
		if gr.centralCache != nil {
			return gr.centralCache, nil
		}
		return nil, fmt.Errorf("no cache available for region: %s", clientRegion)
	}

	// Check if regional cache is healthy
	if health, exists := gr.regionHealth[cacheRegion]; exists {
		health.mu.RLock()
		isHealthy := health.IsHealthy
		health.mu.RUnlock()

		if isHealthy {
			if cache, exists := gr.regionCaches[cacheRegion]; exists {
				gr.logger.Debug().
					Str("client_region", clientRegion).
					Str("cache_region", cacheRegion).
					Msg("Routed to regional cache")
				return cache, nil
			}
		}
	}

	// Fallback to central cache if regional cache is unavailable
	gr.logger.Debug().
		Str("client_region", clientRegion).
		Str("cache_region", cacheRegion).
		Msg("Regional cache unavailable, falling back to central")

	if gr.centralCache != nil {
		return gr.centralCache, nil
	}

	return nil, fmt.Errorf("no healthy cache available for region: %s", clientRegion)
}

// GetNearestRegion finds the nearest cache region based on coordinates
func (gr *GeoRouter) GetNearestRegion(lat, lon float64) string {
	gr.mu.RLock()
	defer gr.mu.RUnlock()

	minDistance := math.MaxFloat64
	nearestRegion := ""

	for regionKey, regionCfg := range gr.config.Regions {
		// Check if region is healthy
		if health, exists := gr.regionHealth[regionKey]; exists {
			health.mu.RLock()
			isHealthy := health.IsHealthy
			health.mu.RUnlock()

			if !isHealthy {
				continue
			}
		}

		// Calculate distance (haversine formula)
		distance := haversineDistance(
			lat, lon,
			regionCfg.Coordinates.Latitude,
			regionCfg.Coordinates.Longitude,
		)

		if distance < minDistance {
			minDistance = distance
			nearestRegion = regionKey
		}
	}

	return nearestRegion
}

// haversineDistance calculates the distance between two coordinates in kilometers
func haversineDistance(lat1, lon1, lat2, lon2 float64) float64 {
	const earthRadius = 6371.0 // Earth radius in kilometers

	// Convert to radians
	lat1Rad := lat1 * math.Pi / 180
	lon1Rad := lon1 * math.Pi / 180
	lat2Rad := lat2 * math.Pi / 180
	lon2Rad := lon2 * math.Pi / 180

	// Haversine formula
	dLat := lat2Rad - lat1Rad
	dLon := lon2Rad - lon1Rad

	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1Rad)*math.Cos(lat2Rad)*
			math.Sin(dLon/2)*math.Sin(dLon/2)

	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))

	return earthRadius * c
}

// startHealthCheckWorker runs periodic health checks on all regional caches
func (gr *GeoRouter) startHealthCheckWorker() {
	interval := time.Duration(gr.config.HealthCheck.Interval) * time.Second
	timeout := time.Duration(gr.config.HealthCheck.Timeout) * time.Second
	threshold := gr.config.HealthCheck.FailureThreshold

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	gr.logger.Info().
		Dur("interval", interval).
		Dur("timeout", timeout).
		Int("threshold", threshold).
		Msg("Started cache health check worker")

	for range ticker.C {
		for regionKey, cache := range gr.regionCaches {
			go func(region string, c *PredictionCache) {
				ctx, cancel := context.WithTimeout(context.Background(), timeout)
				defer cancel()

				err := c.Ping(ctx)

				health := gr.regionHealth[region]
				health.mu.Lock()
				defer health.mu.Unlock()

				health.LastCheck = time.Now()

				if err != nil {
					health.FailureCount++
					health.LastError = err

					if health.FailureCount >= threshold {
						if health.IsHealthy {
							health.IsHealthy = false
							gr.logger.Warn().
								Str("region", region).
								Err(err).
								Int("failures", health.FailureCount).
								Msg("Regional cache marked as unhealthy")
						}
					}
				} else {
					if !health.IsHealthy {
						gr.logger.Info().
							Str("region", region).
							Msg("Regional cache recovered")
					}
					health.IsHealthy = true
					health.FailureCount = 0
					health.LastError = nil
				}
			}(regionKey, cache)
		}
	}
}

// GetRegionHealth returns the health status of all regions
func (gr *GeoRouter) GetRegionHealth() map[string]interface{} {
	gr.mu.RLock()
	defer gr.mu.RUnlock()

	health := make(map[string]interface{})

	for regionKey, regionHealth := range gr.regionHealth {
		regionHealth.mu.RLock()
		health[regionKey] = map[string]interface{}{
			"is_healthy":    regionHealth.IsHealthy,
			"last_check":    regionHealth.LastCheck,
			"failure_count": regionHealth.FailureCount,
			"last_error":    fmt.Sprintf("%v", regionHealth.LastError),
		}
		regionHealth.mu.RUnlock()
	}

	return health
}

// Close closes all cache connections
func (gr *GeoRouter) Close() error {
	gr.mu.Lock()
	defer gr.mu.Unlock()

	var errs []error

	// Close regional caches
	for regionKey, cache := range gr.regionCaches {
		if err := cache.Close(); err != nil {
			errs = append(errs, fmt.Errorf("failed to close cache for region %s: %w", regionKey, err))
		}
	}

	// Close central cache
	if gr.centralCache != nil {
		if err := gr.centralCache.Close(); err != nil {
			errs = append(errs, fmt.Errorf("failed to close central cache: %w", err))
		}
	}

	if len(errs) > 0 {
		return fmt.Errorf("cache close errors: %v", errs)
	}

	gr.logger.Info().Msg("Geo router closed")
	return nil
}
