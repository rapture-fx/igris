package internal

import (
	"fmt"
	"runtime"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/mem"
)

// GetSystemMetrics collects current system metrics
func GetSystemMetrics() (ResourceMetrics, error) {
	var metrics ResourceMetrics

	// CPU usage
	cpuPercent, err := cpu.Percent(0, false)
	if err == nil && len(cpuPercent) > 0 {
		metrics.CPUPercent = cpuPercent[0]
	}

	// Memory usage
	memStats, err := mem.VirtualMemory()
	if err == nil {
		metrics.MemoryMB = float64(memStats.Used) / 1024 / 1024
		metrics.MemoryPercent = memStats.UsedPercent
	}

	// Goroutines
	metrics.Goroutines = runtime.NumGoroutine()

	return metrics, nil
}

// FormatResourceUsage formats resource metrics as a string
func FormatResourceUsage(r ResourceMetrics) string {
	return fmt.Sprintf("CPU: %.1f%%, Memory: %.1fMB (%.1f%%), Goroutines: %d",
		r.CPUPercent, r.MemoryMB, r.MemoryPercent, r.Goroutines)
}
