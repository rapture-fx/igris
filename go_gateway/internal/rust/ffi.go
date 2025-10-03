package rust

/*
#cgo LDFLAGS: -L${SRCDIR}/../../lib -lschlep_kernel
#include <stdlib.h>

extern int rust_add(int x, int y);
extern char* rust_hello(const char* name);
extern void rust_free_string(char* s);
*/
import "C"
import "unsafe"

// Add calls the Rust kernel to add two integers via FFI
// Expected latency: <1 microsecond
func Add(x, y int) int {
	result := C.rust_add(C.int(x), C.int(y))
	return int(result)
}

// HelloFrom calls the Rust kernel to generate a greeting
// Demonstrates string handling across FFI boundary
func HelloFrom(name string) string {
	cName := C.CString(name)
	defer C.free(unsafe.Pointer(cName))

	cResult := C.rust_hello(cName)
	defer C.rust_free_string(cResult)

	return C.GoString(cResult)
}
