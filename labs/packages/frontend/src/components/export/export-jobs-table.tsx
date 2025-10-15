'use client'

import { ExportJob, ExportJobRow } from './export-job-row'
import { ChevronRight } from 'lucide-react'

export const ExportJobsTable = ({ jobs }: { jobs: ExportJob[] }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
         <h2 className="text-lg font-semibold text-gray-800">Recent Exports</h2>
         <p className="text-sm text-gray-600 mt-1">View the status and details of your most recent export jobs.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-50">
            <tr className="text-sm font-semibold text-gray-600">
              <th className="p-4">Source</th>
              <th className="p-4">Format</th>
              <th className="p-4">Status</th>
              <th className="p-4">Created</th>
              <th className="p-4">Size</th>
              <th className="p-4">Destination</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {jobs.map(job => (
              <ExportJobRow key={job.id} job={job} />
            ))}
          </tbody>
        </table>
      </div>
      {jobs.length > 0 && (
        <div className="p-4 border-t border-gray-200 flex justify-end">
          <button className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700">
              View all exports <ChevronRight className="w-4 h-4 ml-1"/>
          </button>
        </div>
      )}
    </div>
  )
} 