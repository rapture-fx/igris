import React from 'react'
import Link from 'next/link'

export default function ClosingPosition() {
  return (
    <>
       <section className="dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4', borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)' }}>
         <div className="mx-auto max-w-[1200px] px-4 md:px-8 lg:px-12">
           <div className="relative px-4 md:px-8 lg:px-12" style={{
             borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
             borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
            backgroundColor: '#f6f6f4',
            minHeight: '400px',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'flex-start'
          }}>
             <div className="w-full px-4 md:px-8 lg:px-12">
               <div className="max-w-3xl mx-auto text-left flex flex-col items-start">
                  <h3 className="text-xl md:text-2xl lg:text-3xl font-inter mb-6" style={{ color: '#000000', fontFamily: 'Roboto Mono, monospace' }}>
                    Start with decisions. Scale to execution.
                  </h3>

                 <div className="flex flex-col sm:flex-row gap-4 justify-center">
                   <Link href="https://docs.igrisinertial.com/">
                      <button
                        className="inline-flex items-center justify-center bg-black text-white px-5 py-2.5 rounded-lg hover:bg-gray-800 transition-all duration-200 text-sm font-medium font-inter"
                        style={{ fontFamily: 'Roboto Mono, monospace' }}
                      >
                       Explore Documentation
                     </button>
                   </Link>
                 </div>
               </div>
             </div>
          </div>
        </div>
      </section>
    </>
  )
}
