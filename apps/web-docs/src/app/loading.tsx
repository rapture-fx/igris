export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 mb-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
        
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Loading...
        </h2>
        
        <p className="text-gray-600">
          Please wait while we load the documentation.
        </p>
      </div>
    </div>
  )
}