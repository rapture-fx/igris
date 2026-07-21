'use client';

import Header from '../src/components/sections/Header'
import Vision from '../src/components/sections/Vision'
import LandingScrollManager from '../src/components/LandingScrollManager'

export default function HomePage() {
  return (
    <div className="igris-grain min-h-screen bg-white dark:bg-[#110f0f] transition-colors duration-200">
      <LandingScrollManager />
      <Header />
      <main className="pt-16">
        <Vision />
      </main>
    </div>
  );
}
