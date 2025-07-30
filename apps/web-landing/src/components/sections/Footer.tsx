'use client'

import Link from 'next/link'

export default function Footer() {
  const footerSections = [
    {
      title: "Product",
      links: [
        { name: "High-Performance Processing", href: "#high-performance-processing" },
        { name: "Multi-format Support", href: "#multi-format-support" },
        { name: "Document Extraction API", href: "#document-extraction-api" },
        { name: "Data Quality API", href: "#data-quality-api" },
        { name: "ML Pipeline API", href: "#ml-pipeline-api" },
        { name: "File Storage API", href: "#storage-api" },
        { name: "Validation API", href: "#validation-api" },
      ]
    },
    {
      title: "Resources",
      links: [
        { name: "Blog", href: "#blog" },
        { name: "Case Studies", href: "#cases" },
        { name: "Help Center", href: "#help" },
        { name: "Community", href: "#community" }
      ]
    },
    {
      title: "Guide",
      links: [
        { name: "Getting Started", href: "#getting-started" },
        { name: "API Reference", href: "#api-reference" },
        { name: "Tutorials", href: "#tutorials" },
        { name: "Best Practices", href: "#best-practices" }
      ]
    },
    {
      title: "Integration",
      links: [
        { name: "AWS SageMaker", href: "#aws-sagemaker" },
        { name: "Google Cloud AI", href: "#google-cloud-ai" },
        { name: "Azure ML", href: "#azure-ml" },
        { name: "Jupyter Notebooks", href: "#jupyter" },
        { name: "TensorFlow", href: "#tensorflow" },
        { name: "PyTorch", href: "#pytorch" },
        { name: "scikit-learn", href: "#scikit-learn" },
        { name: "Databricks", href: "#databricks" },
        { name: "Snowflake", href: "#snowflake" }
      ]
    },
    {
      title: "Security",
      links: [
        { name: "Security Overview", href: "#security-overview" },
        { name: "Data Encryption", href: "#data-encryption" },
        { name: "Access Control", href: "#access-control" },
        { name: "Compliance", href: "#compliance" },
        { name: "Audit Logs", href: "#audit-logs" },
        { name: "Vulnerability Reports", href: "#vulnerability-reports" }
      ]
    },
    {
      title: "Legal",
      links: [
        { name: "Privacy Policy", href: "#privacy" },
        { name: "Terms of Service", href: "#terms" },
        { name: "Contact", href: "#contact" }
      ]
    }
  ]

  return (
    <footer className="bg-[#161616] text-beige-secondary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-16">
          <div className="grid grid-cols-1 lg:grid-cols-6 gap-12">
            

            <div className="lg:col-span-6">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 max-w-7xl mx-auto">
                {footerSections.map((section, index) => (
                  <div key={index}>
                    <h3 className="text-lg font-semibold mb-4 text-beige-secondary">
                      {section.title}
                    </h3>
                    <ul className="space-y-2">
                      {section.links.map((link, linkIndex) => (
                        <li key={linkIndex}>
                          <Link
                            href={link.href}
                            className="text-beige-secondary hover:text-white transition-colors duration-200 text-sm"
                          >
                            {link.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-gray-800">
            <div className="flex flex-col md:flex-row items-center justify-between">
              <div className="text-beige-secondary mb-4 md:mb-0 text-sm">
                <p>&copy; 2024 Schlep-engine. All rights reserved.</p>
              </div>
              
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}