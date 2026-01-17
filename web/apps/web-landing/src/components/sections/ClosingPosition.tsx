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
                minHeight: '300px'
              }}>
                {/* Background grad image with reduced opacity */}
                <div className="absolute inset-0" style={{
                  backgroundImage: 'url(/grd.png)',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
opacity: 0.5
                }}></div>

                {/* Spir image - right aligned, full height */}
                {/* <div className="absolute right-0 top-0 bottom-0 hidden md:flex items-center overflow-hidden">
                  <img
                    src="/spir.png"
                    alt="Spiral"
                    style={{ height: '130%', width: 'auto', opacity: 0.3 }}
                  />
                </div> */}

                <div className="w-full flex flex-row items-center justify-between relative z-10">
                   <div className="max-w-3xl text-left flex flex-col">
<h3 className="text-lg md:text-xl lg:text-2xl font-inter mb-6" style={{ color: '#000000' }}>
                              Control the decision layer.<br />Scale the rest.
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
