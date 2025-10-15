'use client'

import { Job } from './types'
import { JobCard } from './job-card'

export const JobsList = ({ jobs, onSelectJob }: { jobs: Job[], onSelectJob: (job: Job) => void }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
      {jobs.map(job => (
        <JobCard key={job.id} job={job} onSelect={onSelectJob} />
      ))}
    </div>
  )
} 