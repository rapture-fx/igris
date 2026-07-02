package igrisclient

import (
    "os"

    igris "github.com/igris-inertial/go-sdk"
)

func New() *igris.Client {
    baseURL := os.Getenv("IGRIS_BASE_URL")
    if baseURL == "" {
        baseURL = "https://overture.igrisinertial.com"
    }

    apiKey := os.Getenv("IGRIS_API_KEY")
    if apiKey == "" {
        panic("IGRIS_API_KEY is required")
    }

    return igris.NewClient(baseURL, apiKey)
}
