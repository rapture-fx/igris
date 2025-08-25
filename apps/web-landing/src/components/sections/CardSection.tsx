
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
      title: 'For Developers',
      description: 'Integrate our API in minutes. Robust, scalable, and well-documented.',
      cta: 'Read the Docs',
      ctaLink: '/docs'
    },
    {
      title: 'For Product Managers',
      description: 'Focus on building great products, not on infrastructure. We handle the heavy lifting.',
      cta: 'Explore Features',
      ctaLink: '/solutions'
    },
    {
      title: 'For Data Scientists',
      description: 'Leverage our powerful models to build your own AI-powered applications.',
      cta: 'See Use Cases',
      ctaLink: '/case-studies'
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
