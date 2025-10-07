package ml

// #cgo CFLAGS: -I/usr/local/include/onnxruntime
// #cgo LDFLAGS: -L/usr/local/lib -lonnxruntime
// #include <onnxruntime_c_api.h>
// #include <stdlib.h>
import "C"

import (
	"fmt"
	"log"
	"sync"
	"unsafe"
)

// ONNXRuntimeCGO provides direct CGO binding to ONNX Runtime C API
type ONNXRuntimeCGO struct {
	env           *C.OrtEnv
	sessionOpts   *C.OrtSessionOptions
	session       *C.OrtSession
	allocator     *C.OrtAllocator
	api           *C.OrtApi

	// Model metadata
	modelPath     string
	inputNames    []string
	outputNames   []string

	// Performance settings
	intraOpThreads int
	interOpThreads int
	graphOptLevel  int

	// GPU settings
	cudaDeviceID   int
	useCUDA        bool

	mu             sync.RWMutex
	initialized    bool
}

// ONNXConfig holds ONNX Runtime configuration
type ONNXConfig struct {
	ModelPath        string
	IntraOpThreads   int
	InterOpThreads   int
	GraphOptLevel    int  // ORT_DISABLE_ALL=0, ORT_ENABLE_BASIC=1, ORT_ENABLE_EXTENDED=2, ORT_ENABLE_ALL=3
	CUDADeviceID     int
	UseCUDA          bool
	EnableProfiling  bool
}

// DefaultONNXConfig returns recommended ONNX Runtime defaults
var DefaultONNXConfig = ONNXConfig{
	IntraOpThreads:  4,
	InterOpThreads:  2,
	GraphOptLevel:   3, // ORT_ENABLE_ALL
	CUDADeviceID:    0,
	UseCUDA:         true,
	EnableProfiling: false,
}

// NewONNXRuntimeCGO creates a new ONNX Runtime instance with direct CGO binding
func NewONNXRuntimeCGO(config ONNXConfig) (*ONNXRuntimeCGO, error) {
	runtime := &ONNXRuntimeCGO{
		modelPath:      config.ModelPath,
		intraOpThreads: config.IntraOpThreads,
		interOpThreads: config.InterOpThreads,
		graphOptLevel:  config.GraphOptLevel,
		cudaDeviceID:   config.CUDADeviceID,
		useCUDA:        config.UseCUDA,
	}

	// Get ONNX Runtime API
	runtime.api = C.OrtGetApiBase().GetApi(C.uint(C.ORT_API_VERSION))
	if runtime.api == nil {
		return nil, fmt.Errorf("failed to get ONNX Runtime API")
	}

	// Create environment
	var status *C.OrtStatus
	envName := C.CString("schlep-engine-onnx")
	defer C.free(unsafe.Pointer(envName))

	status = runtime.api.CreateEnv(C.ORT_LOGGING_LEVEL_WARNING, envName, &runtime.env)
	if status != nil {
		return nil, runtime.getErrorMessage(status)
	}

	// Create session options
	status = runtime.api.CreateSessionOptions(&runtime.sessionOpts)
	if status != nil {
		return nil, runtime.getErrorMessage(status)
	}

	// Set thread count
	status = runtime.api.SetIntraOpNumThreads(runtime.sessionOpts, C.int(config.IntraOpThreads))
	if status != nil {
		return nil, runtime.getErrorMessage(status)
	}

	status = runtime.api.SetInterOpNumThreads(runtime.sessionOpts, C.int(config.InterOpThreads))
	if status != nil {
		return nil, runtime.getErrorMessage(status)
	}

	// Set graph optimization level
	status = runtime.api.SetSessionGraphOptimizationLevel(
		runtime.sessionOpts,
		C.GraphOptimizationLevel(config.GraphOptLevel),
	)
	if status != nil {
		return nil, runtime.getErrorMessage(status)
	}

	// Enable CUDA if requested
	if config.UseCUDA {
		err := runtime.enableCUDA()
		if err != nil {
			log.Printf("[ONNXRuntime] CUDA initialization failed: %v, falling back to CPU", err)
			runtime.useCUDA = false
		}
	}

	// Load model
	if config.ModelPath != "" {
		err := runtime.LoadModel(config.ModelPath)
		if err != nil {
			runtime.Cleanup()
			return nil, fmt.Errorf("failed to load model: %w", err)
		}
	}

	// Get default allocator
	status = runtime.api.GetAllocatorWithDefaultOptions(&runtime.allocator)
	if status != nil {
		runtime.Cleanup()
		return nil, runtime.getErrorMessage(status)
	}

	runtime.initialized = true
	log.Printf("[ONNXRuntime] Initialized (CUDA: %v, threads: %d/%d, opt: %d)",
		runtime.useCUDA, config.IntraOpThreads, config.InterOpThreads, config.GraphOptLevel)

	return runtime, nil
}

// enableCUDA enables CUDA execution provider
func (o *ONNXRuntimeCGO) enableCUDA() error {
	var cudaOptions C.OrtCUDAProviderOptions

	// Set CUDA device ID
	cudaOptions.device_id = C.int(o.cudaDeviceID)

	// Set memory configuration
	cudaOptions.arena_extend_strategy = C.OrtArenaExtendStrategy(0) // kNextPowerOfTwo
	cudaOptions.gpu_mem_limit = C.size_t(2 * 1024 * 1024 * 1024)     // 2GB
	cudaOptions.cudnn_conv_algo_search = C.OrtCudnnConvAlgoSearch(0) // EXHAUSTIVE
	cudaOptions.do_copy_in_default_stream = 1

	status := C.OrtSessionOptionsAppendExecutionProvider_CUDA(o.sessionOpts, &cudaOptions)
	if status != nil {
		return o.getErrorMessage(status)
	}

	log.Printf("[ONNXRuntime] CUDA enabled on device %d", o.cudaDeviceID)
	return nil
}

// LoadModel loads an ONNX model from file
func (o *ONNXRuntimeCGO) LoadModel(modelPath string) error {
	o.mu.Lock()
	defer o.mu.Unlock()

	// Convert path to wide string (Windows) or regular string (Unix)
	cPath := C.CString(modelPath)
	defer C.free(unsafe.Pointer(cPath))

	// Create session
	status := o.api.CreateSession(o.env, cPath, o.sessionOpts, &o.session)
	if status != nil {
		return o.getErrorMessage(status)
	}

	o.modelPath = modelPath

	// Get input/output metadata
	err := o.loadMetadata()
	if err != nil {
		return fmt.Errorf("failed to load model metadata: %w", err)
	}

	log.Printf("[ONNXRuntime] Model loaded: %s (inputs: %d, outputs: %d)",
		modelPath, len(o.inputNames), len(o.outputNames))

	return nil
}

// loadMetadata extracts input/output names from the model
func (o *ONNXRuntimeCGO) loadMetadata() error {
	var numInputs, numOutputs C.size_t

	// Get input count
	status := o.api.SessionGetInputCount(o.session, &numInputs)
	if status != nil {
		return o.getErrorMessage(status)
	}

	// Get output count
	status = o.api.SessionGetOutputCount(o.session, &numOutputs)
	if status != nil {
		return o.getErrorMessage(status)
	}

	// Get input names
	o.inputNames = make([]string, numInputs)
	for i := C.size_t(0); i < numInputs; i++ {
		var namePtr *C.char
		status = o.api.SessionGetInputName(o.session, i, o.allocator, &namePtr)
		if status != nil {
			return o.getErrorMessage(status)
		}
		o.inputNames[i] = C.GoString(namePtr)
		o.api.AllocatorFree(o.allocator, unsafe.Pointer(namePtr))
	}

	// Get output names
	o.outputNames = make([]string, numOutputs)
	for i := C.size_t(0); i < numOutputs; i++ {
		var namePtr *C.char
		status = o.api.SessionGetOutputName(o.session, i, o.allocator, &namePtr)
		if status != nil {
			return o.getErrorMessage(status)
		}
		o.outputNames[i] = C.GoString(namePtr)
		o.api.AllocatorFree(o.allocator, unsafe.Pointer(namePtr))
	}

	return nil
}

// Run executes inference with the loaded model
func (o *ONNXRuntimeCGO) Run(inputData []float32, inputShape []int64) ([]float32, error) {
	o.mu.RLock()
	defer o.mu.RUnlock()

	if !o.initialized || o.session == nil {
		return nil, fmt.Errorf("runtime not initialized or model not loaded")
	}

	// Create input tensor
	inputTensor, err := o.createTensor(inputData, inputShape)
	if err != nil {
		return nil, fmt.Errorf("failed to create input tensor: %w", err)
	}
	defer o.api.ReleaseValue(inputTensor)

	// Prepare input/output names
	inputNamesCStr := make([]*C.char, len(o.inputNames))
	for i, name := range o.inputNames {
		inputNamesCStr[i] = C.CString(name)
		defer C.free(unsafe.Pointer(inputNamesCStr[i]))
	}

	outputNamesCStr := make([]*C.char, len(o.outputNames))
	for i, name := range o.outputNames {
		outputNamesCStr[i] = C.CString(name)
		defer C.free(unsafe.Pointer(outputNamesCStr[i]))
	}

	// Run inference
	var outputTensor *C.OrtValue
	runOptions := (*C.OrtRunOptions)(nil) // Use default run options

	status := o.api.Run(
		o.session,
		runOptions,
		&inputNamesCStr[0],
		&inputTensor,
		C.size_t(len(o.inputNames)),
		&outputNamesCStr[0],
		C.size_t(len(o.outputNames)),
		&outputTensor,
	)

	if status != nil {
		return nil, o.getErrorMessage(status)
	}
	defer o.api.ReleaseValue(outputTensor)

	// Extract output data
	outputData, err := o.extractTensorData(outputTensor)
	if err != nil {
		return nil, fmt.Errorf("failed to extract output: %w", err)
	}

	return outputData, nil
}

// createTensor creates an ONNX tensor from Go data
func (o *ONNXRuntimeCGO) createTensor(data []float32, shape []int64) (*C.OrtValue, error) {
	// Calculate total size
	totalSize := int64(1)
	for _, dim := range shape {
		totalSize *= dim
	}

	if int64(len(data)) != totalSize {
		return nil, fmt.Errorf("data length %d does not match shape %v (total: %d)",
			len(data), shape, totalSize)
	}

	// Create memory info (CPU)
	var memoryInfo *C.OrtMemoryInfo
	status := o.api.CreateCpuMemoryInfo(
		C.OrtAllocatorType(C.OrtArenaAllocator),
		C.OrtMemType(C.OrtMemTypeDefault),
		&memoryInfo,
	)
	if status != nil {
		return nil, o.getErrorMessage(status)
	}
	defer o.api.ReleaseMemoryInfo(memoryInfo)

	// Convert shape to C array
	cShape := make([]C.int64_t, len(shape))
	for i, dim := range shape {
		cShape[i] = C.int64_t(dim)
	}

	// Create tensor
	var tensor *C.OrtValue
	status = o.api.CreateTensorWithDataAsOrtValue(
		memoryInfo,
		unsafe.Pointer(&data[0]),
		C.size_t(len(data)*4), // 4 bytes per float32
		&cShape[0],
		C.size_t(len(shape)),
		C.ONNXTensorElementDataType(C.ONNX_TENSOR_ELEMENT_DATA_TYPE_FLOAT),
		&tensor,
	)

	if status != nil {
		return nil, o.getErrorMessage(status)
	}

	return tensor, nil
}

// extractTensorData extracts float32 data from ONNX tensor
func (o *ONNXRuntimeCGO) extractTensorData(tensor *C.OrtValue) ([]float32, error) {
	// Get tensor type info
	var typeInfo *C.OrtTypeInfo
	status := o.api.GetTypeInfo(tensor, &typeInfo)
	if status != nil {
		return nil, o.getErrorMessage(status)
	}
	defer o.api.ReleaseTypeInfo(typeInfo)

	// Get tensor data pointer
	var dataPtr unsafe.Pointer
	status = o.api.GetTensorMutableData(tensor, &dataPtr)
	if status != nil {
		return nil, o.getErrorMessage(status)
	}

	// Get tensor shape
	var shapeInfo *C.OrtTensorTypeAndShapeInfo
	status = o.api.CastTypeInfoToTensorInfo(typeInfo, &shapeInfo)
	if status != nil {
		return nil, o.getErrorMessage(status)
	}

	var numDims C.size_t
	status = o.api.GetDimensionsCount(shapeInfo, &numDims)
	if status != nil {
		return nil, o.getErrorMessage(status)
	}

	dims := make([]C.int64_t, numDims)
	status = o.api.GetDimensions(shapeInfo, &dims[0], numDims)
	if status != nil {
		return nil, o.getErrorMessage(status)
	}

	// Calculate total size
	totalSize := int64(1)
	for _, dim := range dims {
		totalSize *= int64(dim)
	}

	// Copy data to Go slice
	output := make([]float32, totalSize)
	dataSlice := (*[1 << 30]float32)(dataPtr)[:totalSize:totalSize]
	copy(output, dataSlice)

	return output, nil
}

// getErrorMessage extracts error message from ORT status
func (o *ONNXRuntimeCGO) getErrorMessage(status *C.OrtStatus) error {
	if status == nil {
		return nil
	}

	msgPtr := o.api.GetErrorMessage(status)
	msg := C.GoString(msgPtr)
	o.api.ReleaseStatus(status)

	return fmt.Errorf("ONNX Runtime error: %s", msg)
}

// GetInputNames returns model input names
func (o *ONNXRuntimeCGO) GetInputNames() []string {
	o.mu.RLock()
	defer o.mu.RUnlock()
	return o.inputNames
}

// GetOutputNames returns model output names
func (o *ONNXRuntimeCGO) GetOutputNames() []string {
	o.mu.RLock()
	defer o.mu.RUnlock()
	return o.outputNames
}

// IsUsingCUDA returns whether CUDA is enabled
func (o *ONNXRuntimeCGO) IsUsingCUDA() bool {
	return o.useCUDA
}

// Cleanup releases all ONNX Runtime resources
func (o *ONNXRuntimeCGO) Cleanup() {
	o.mu.Lock()
	defer o.mu.Unlock()

	if o.session != nil {
		o.api.ReleaseSession(o.session)
		o.session = nil
	}

	if o.sessionOpts != nil {
		o.api.ReleaseSessionOptions(o.sessionOpts)
		o.sessionOpts = nil
	}

	if o.env != nil {
		o.api.ReleaseEnv(o.env)
		o.env = nil
	}

	o.initialized = false
	log.Printf("[ONNXRuntime] Cleanup complete")
}
