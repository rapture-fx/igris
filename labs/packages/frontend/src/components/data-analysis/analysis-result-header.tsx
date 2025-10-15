'use client'

import { BarChart3, CheckCircle2, Shield, TrendingUp } from "lucide-react";

export const AnalysisResultHeader = ({ analysis }) => {
    if (!analysis) return null;

    const stats = [
        { name: 'Total Records', value: analysis.summary.total_records.toLocaleString(), icon: BarChart3 },
        { name: 'Data Quality Score', value: `${analysis.summary.quality_score}%`, icon: TrendingUp },
        { name: 'PII Detected', value: analysis.summary.pii_detected.toLocaleString(), icon: Shield },
        { name: 'Issues Found', value: analysis.summary.issues_found.toLocaleString(), icon: CheckCircle2 },
    ];

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200/80 p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Analysis Overview</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map(stat => (
                    <div key={stat.name} className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex items-center space-x-3">
                            <div className="bg-white p-2 rounded-md">
                                <stat.icon className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">{stat.name}</p>
                                <p className="text-xl font-bold text-gray-800">{stat.value}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
} 