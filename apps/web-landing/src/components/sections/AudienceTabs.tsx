'use client'

import React, { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import Link from 'next/link'
import { Code, MousePointerClick, Terminal, Zap, Book, Github, Upload, Download, MousePointer, Copy, ArrowRight } from 'lucide-react'
import HeroGridBackground from '../ui/HeroGridBackground'

export default function AudienceTabs() {
  

  return (
    <section className="py-16 md:py-24 bg-white dark:bg-black">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-semibold text-gray-900 dark:text-white mb-4">
            Who Uses Schlep Engine?
          </h2>
          <p className="text-lg text-gray-700 dark:text-gray-300 max-w-3xl mx-auto">
            Data processing tools for different roles working with data preparation and analysis.
          </p>
        </div>

        <Tabs defaultValue="data-scientists" className="max-w-4xl mx-auto">
          <TabsList className="grid w-full grid-cols-3 h-auto bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
            <TabsTrigger 
              value="data-scientists" 
              className="py-2 px-4 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-gray-900 dark:data-[state=active]:bg-white dark:data-[state=active]:text-black"
            >
              Data Scientists
            </TabsTrigger>
            <TabsTrigger 
              value="ml-engineers" 
              className="py-2 px-4 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-gray-900 dark:data-[state=active]:bg-white dark:data-[state=active]:text-black"
            >
              ML Engineers
            </TabsTrigger>
            <TabsTrigger 
              value="business-analysts" 
              className="py-2 px-4 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-gray-900 dark:data-[state=active]:bg-white dark:data-[state=active]:text-black"
            >
              Business Analysts
            </TabsTrigger>
          </TabsList>
          <TabsContent value="data-scientists" className="mt-8 bg-gray-50 dark:bg-gray-800 p-6 rounded-xl shadow-lg">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">For Data Scientists</h3>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              Automate common data preparation tasks like cleaning, validation, and format conversion. Use the Python SDK to integrate data processing into your existing analysis workflows and notebooks.
            </p>
          </TabsContent>
          <TabsContent value="ml-engineers" className="mt-8 bg-gray-50 dark:bg-gray-800 p-6 rounded-xl shadow-lg">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">For ML Engineers</h3>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              Process data at scale using APIs and SDKs. Handle data validation and preprocessing steps as part of your ML pipeline infrastructure and model training workflows.
            </p>
          </TabsContent>
          <TabsContent value="business-analysts" className="mt-8 bg-gray-50 dark:bg-gray-800 p-6 rounded-xl shadow-lg">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">For Business Analysts</h3>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              Clean and standardize data for reporting and analysis. Use web interface or API to process datasets and export clean data in formats compatible with your BI tools.
            </p>
          </TabsContent>
        </Tabs>
      </div>
    </section>
  )
}