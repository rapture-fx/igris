
'use client'

import React from 'react';

const Card = ({ title, description, cta, ctaLink }) => (
  <div className="bg-white rounded-lg shadow-md p-6 flex flex-col">
    <h3 className="text-xl font-semibold text-gray-800 mb-2">{title}</h3>
    <p className="text-gray-600 flex-grow">{description}</p>
    <a href={ctaLink} className="text-blue-500 hover:text-blue-600 font-semibold mt-4 self-start">
      {cta}
    </a>
  </div>
);

const CardSection = () => {
  const cards = [
    {
      title: 'For MLOps Engineers',
      description: 'Optimize ML inference routing and reduce infrastructure overhead. We handle the complex orchestration so you can focus on model performance.',
      cta: 'See Architecture',
      ctaLink: '/architecture'
    },
    {
      title: 'For DevOps Teams',
      description: 'Deploy scalable inference infrastructure with auto-scaling, resilience, and real-time observability.',
      cta: 'View Deployment Guide',
      ctaLink: '/deployment'
    },
    {
      title: 'For CTOs & Architects',
      description: 'Build enterprise-grade AI infrastructure that scales automatically and optimizes costs in real-time.',
      cta: 'Explore Infrastructure',
      ctaLink: '/infrastructure'
    }
  ];

  return (
    <section className="py-16 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {cards.map((card, index) => (
            <Card key={index} {...card} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default CardSection;
