package main

import (
    "context"
    "fmt"
    "log"
    "os"

    igris "github.com/igris-inertial/go-sdk"
)

func main() {
    client := igris.NewClient(
        "https://overture.igrisinertial.com",
        os.Getenv("IGRIS_API_KEY"),
    )

    resp, err := client.Infer(context.Background(), &igris.InferRequest{
        Model: "gpt-4",
        Messages: []igris.Message{
            {Role: "user", Content: "Hello"},
        },
    })
    if err != nil {
        log.Fatal(err)
    }

    fmt.Println(resp.Choices[0].Message.Content)
}
