'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { 
  Cpu, 
  Factory,
   
  ShoppingCart, 
  Building2,
  Activity,
  ArrowRight,
  
  Terminal,
  Zap,
  Globe,
  BarChart3,
  User,
  LogOut,
  Webhook,
  Shield,
  TestTube
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../src/lib/auth/context'
import LoginModal from '../src/components/auth/LoginModal'
import WebhookTester from '../src/components/console/WebhookTester'
import EssentialsDropdown from '../src/components/console/EssentialsDropdown'

interface IndustryCardProps {
  title: string
  description: string
  icon: React.ReactNode
  link: string
  apiCount: number
  features: string[]
  color: string
  bgGradient: string
}

const IndustryCard: React.FC<IndustryCardProps> = ({
  title,
  description,
  icon,
  link,
  apiCount,
  features,
  color,
  bgGradient
}) => {
  return (
    <Link href={link} className="group">
      <div className={`relative overflow-hidden rounded-sm border bg-white px-3 py-3 shadow-md transition-all duration-300 hover:shadow-md dark:bg-gray-800 flex items-center`} style={{ borderColor: '#a0c0f0' }}>
        
        
        {/* Content */}
        <div className="relative z-10 flex items-center w-full">
          {/* Icon and header */}
          <div className="flex items-center space-x-2">
            <div className="flex items-center justify-center">
              <div className={`w-5 h-5 flex items-center justify-center`} style={{ color: '#1f53d0' }}>
                {icon}
              </div>
            </div>
            <h3 className="text-sm font-normal text-gray-700 dark:text-gray-300 my-0 font-mono">
              {title}
            </h3>
          </div>
          
        </div>
      </div>
    </Link>
  )
}

const AuthButton: React.FC = () => {
  const { isAuthenticated, user, logout } = useAuth()
  const [showLoginModal, setShowLoginModal] = useState(false)

  if (isAuthenticated && user) {
    return (
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2 px-3 py-1 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-full text-sm">
          <User className="w-4 h-4" />
          <span>{user.name}</span>
        </div>
        <button
          onClick={logout}
          className="flex items-center space-x-1 px-3 py-1 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign out</span>
        </button>
      </div>
    )
  }

  return (
    <>
      <button
        onClick={() => setShowLoginModal(true)}
        className="text-sm text-gray-500 dark:text-gray-500 dark:hover:text-blue-400 transition-colors font-mono hover:text-blue-600"
      >
        Dashboard
      </button>
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
    </>
  )
}




export default function ConsolePage() {
  const [showWebhookTester, setShowWebhookTester] = useState(false)
  const router = useRouter()
  

  const essentials = [
    { title: "Dashboard", onClick: () => {
        const authButton = document.querySelector('button[class*="text-gray-500"]');
        if (authButton) authButton.click();
      }, icon: <BarChart3 className="w-4 h-4" /> },
    { title: "API Console", link: "/console", icon: <Terminal className="w-4 h-4" /> },
    { title: "SDKs", link: "http://localhost:3005", icon: <Globe className="w-4 h-4" /> },
    { title: "Security Console", link: "/security", icon: <Shield className="w-4 h-4" /> },
    { title: "Test Collections", link: "/testing", icon: <TestTube className="w-4 h-4" /> },
    { title: "Webhook Tester", onClick: () => setShowWebhookTester(true), icon: <Webhook className="w-4 h-4" /> }
  ]

  return (
    <div className="min-h-screen flex flex-col dark:bg-gray-900" style={{
      backgroundColor: '#f6f6f4',
      backgroundImage: `repeating-linear-gradient(
        45deg,
        transparent,
        transparent 2px,
        rgba(0,0,0,0.02) 2px,
        rgba(0,0,0,0.02) 4px
      )`
    }}>
      {/* Main Content Area */}
      <div className="flex-grow flex justify-center items-center relative">
        {/* Essentials Stack */}
        <div className="p-6">
          <div className="flex justify-center">
            <EssentialsDropdown
              essentials={essentials}
              onSelect={(item) => {
                if (item.link) {
                  router.push(item.link)
                } else if (item.onClick) {
                  item.onClick()
                }
              }}
            />
          </div>
        </div>

        {/* Hidden AuthButton for Dashboard functionality */}
        <div className="hidden">
          <AuthButton />
        </div>

        {/* Webhook Tester Modal */}
        <WebhookTester
          isOpen={showWebhookTester}
          onClose={() => setShowWebhookTester(false)}
        />
      </div>

      {/* Logo */}
      <div className="flex justify-center pb-32">
        <Link href="http://localhost:3000">
          <img src="/Docs Schlep-engne.svg" alt="Schlep-engine Logo" className="w-[24px] h-[24px]" />
        </Link>
      </div>
    </div>
  )
}