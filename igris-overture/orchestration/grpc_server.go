// Package orchestration provides gRPC-based distributed inference routing (Simatic Layer)
package orchestration

import (
	"context"
	"fmt"
	"log"
	"net"

	pb "github.com/Igris-inertial/system/proto/orchestration"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"
)

// Server implements the gRPC InferenceRouterService
type Server struct {
	pb.UnimplementedInferenceRouterServiceServer
	grpcServer *grpc.Server
	listener   net.Listener
	port       string
}

// NewServer creates a new orchestration server
func NewServer(port string) *Server {
	if port == "" {
		port = "50051"
	}
	return &Server{port: port}
}

// Start starts the gRPC server
func (s *Server) Start() error {
	lis, err := net.Listen("tcp", ":"+s.port)
	if err != nil {
		return fmt.Errorf("failed to listen on port %s: %w", s.port, err)
	}
	s.listener = lis

	s.grpcServer = grpc.NewServer()
	pb.RegisterInferenceRouterServiceServer(s.grpcServer, s)
	reflection.Register(s.grpcServer)

	log.Printf("[Orchestration] gRPC server listening on :%s", s.port)

	go func() {
		if err := s.grpcServer.Serve(lis); err != nil {
			log.Printf("[Orchestration] gRPC server error: %v", err)
		}
	}()

	return nil
}

// Stop gracefully stops the gRPC server
func (s *Server) Stop() {
	if s.grpcServer != nil {
		s.grpcServer.GracefulStop()
	}
}

// RouteInference implements the RouteInference RPC method
func (s *Server) RouteInference(ctx context.Context, req *pb.RouteInferenceRequest) (*pb.RouteInferenceResponse, error) {
	log.Println("[Orchestration] RouteInference called")
	return &pb.RouteInferenceResponse{}, nil
}
