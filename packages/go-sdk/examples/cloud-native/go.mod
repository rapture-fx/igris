module github.com/schlep-engine/go-sdk/examples/cloud-native

go 1.21

require (
	github.com/prometheus/client_golang v1.17.0
	github.com/schlep-engine/go-sdk v0.1.0
	go.opentelemetry.io/otel v1.21.0
	go.opentelemetry.io/otel/trace v1.21.0
)

// Use local SDK for development
replace github.com/schlep-engine/go-sdk => ../../