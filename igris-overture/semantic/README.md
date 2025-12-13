# Semantic Routing - ONNX Runtime Issues

## Status: Temporarily Disabled

The semantic classification package uses ONNX Runtime for ML-based intent classification.
Currently disabled due to API compatibility issues with the onnxruntime_go library.

## Required Fixes:
1. Update github.com/yalue/onnxruntime_go to latest version
2. Fix NewAdvancedSession API (signature changed - now requires different parameters)
3. Fix session.Run() return values (changed from 2 values to 1)
4. Test with DistilBERT model

## Workaround:
The cognitive layer and SLO enforcer work without semantic routing.
Semantic router is passed as nil to the cognitive worker.

## To Re-enable:
1. Run: go get -u github.com/yalue/onnxruntime_go
2. Update onnx_classifier.go to match new API
3. Remove //go:build ignore tags from semantic/*.go files
4. Rebuild project

