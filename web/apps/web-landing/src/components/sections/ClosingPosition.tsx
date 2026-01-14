import React from 'react'
import Link from 'next/link'

export default function ClosingPosition() {
  return (
     <>
        <section className="dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4' }}>
           <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
             <div className="relative px-4 md:px-8 lg:px-12 flex flex-col justify-center" style={{
                borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
                backgroundColor: '#f6f6f4',
                minHeight: '400px'
              }}>
                <div className="w-full">
                   <div className="max-w-3xl text-left flex flex-col">
                         <h3 className="text-lg md:text-xl lg:text-2xl font-inter mb-6" style={{ color: '#000000' }}>
                             Start with decisions.<br />Scale to execution.
                          </h3>

                        <div className="flex flex-col sm:flex-row gap-4 pl-0 md:pl-0 lg:pl-0">
                          <Link href="https://docs.igrisinertial.com/">
                              <button
                                     className="inline-flex items-center justify-center bg-black text-white px-4 py-2 hover:bg-gray-800 transition-all duration-200 text-xs font-medium font-inter"
                                 >
                                    Get Started
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
