package main

import (
    "os"

    igris "github.com/igris-inertial/go-sdk"
)

func main() {
    client := igris.NewClient(
        "https://overture.igrisinertial.com",
        os.Getenv("IGRIS_API_KEY"),
    )

    _ = client // run actions over HTTP; use the client for receipts, vault, and fleet helpers
}
