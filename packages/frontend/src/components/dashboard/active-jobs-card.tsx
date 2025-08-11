'use client'

import Link from 'next/link'
import { ChevronRight, Zap } from 'lucide-react'

interface ActiveJob {
    job_id: string;
    investigation_name: string;
    status: string;
    progress_percentage: number | null;
    estimated_completion: string | null;
  }

export const ActiveJobsCard = ({ jobs }) => (
    <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-sky-100 rounded-xl flex items-center justify-center">
            <Zap className="w-5 h-5 text-sky-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Active Jobs</h2>
            <p className="text-sm text-gray-600">Live processing tasks</p>
          </div>
        </div>
        <Link href="/dashboard/jobs">
          <button className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700">
            View All
            <ChevronRight className="w-4 h-4 ml-1" />
          </button>
        </Link>
      </div>
      <div className="space-y-4">
        {jobs.map((job: ActiveJob) => (
          <div key={job.job_id}>
            <div className="flex justify-between items-center mb-1">
              <p className="font-medium text-gray-800">{job.investigation_name}</p>
              <p className="text-sm font-semibold text-gray-800">{job.progress_percentage || 0}%</p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full"
                style={{ width: `${job.progress_percentage || 0}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  ); 