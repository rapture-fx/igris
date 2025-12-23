'use client';

export default function GettingStarted() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-beige-primary">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Getting Started</h1>
        <p className="text-gray-600 mb-8">Welcome to the Overture Developer Console!</p>
        <div className="space-y-4">
          <p>This page will help you set up your API keys and configure your first inference requests.</p>
          <p>In the meantime, you can also try visiting the <a href="/dashboard" className="text-overture-blue hover:underline">dashboard</a>.</p>
        </div>
      </div>
    </div>
  );
}
