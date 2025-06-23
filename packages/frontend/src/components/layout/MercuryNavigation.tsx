'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, ChevronDown, Zap, Database, Shield, Users } from 'lucide-react'

const navigationItems = [
  {
    name: 'Products',
    href: '#',
    hasDropdown: true,
    dropdownItems: [
      { name: 'Data Intelligence', href: '/products/intelligence', icon: Database },
      { name: 'AI Processing', href: '/products/ai', icon: Zap },
      { name: 'Security Suite', href: '/products/security', icon: Shield },
    ]
  },
  {
    name: 'Solutions',
    href: '#',
    hasDropdown: true,
    dropdownItems: [
      { name: 'Enterprise', href: '/solutions/enterprise', icon: Users },
      { name: 'Startups', href: '/solutions/startups', icon: Zap },
      { name: 'Data Teams', href: '/solutions/data-teams', icon: Database },
    ]
  },
  { name: 'Pricing', href: '/pricing' },
  { name: 'Documentation', href: '/documentation' },
  { name: 'About', href: '/about' },
]

interface DropdownProps {
  items: Array<{
    name: string
    href: string
    icon: React.ElementType
  }>
  isOpen: boolean
  onClose: () => void
}

function Dropdown({ items, isOpen, onClose }: DropdownProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="absolute top-full left-0 mt-2 w-64 bg-mercury-surface/95 backdrop-blur-md rounded-lg border border-gray-200 shadow-large z-50"
        >
          <div className="p-2">
            {items.map((item, index) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={onClose}
                  className="flex items-center space-x-3 px-3 py-2 rounded-md text-gray-700 hover:text-mercury-primary hover:bg-gray-50 transition-all duration-200"
                >
                  <Icon className="w-4 h-4" />
                  <span className="font-medium">{item.name}</span>
                </Link>
              )
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

interface NavItemProps {
  item: typeof navigationItems[0]
  pathname: string
  isMobile?: boolean
  onMobileClose?: () => void
}

function NavItem({ item, pathname, isMobile = false, onMobileClose }: NavItemProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const isActive = pathname === item.href

  const handleClick = () => {
    if (isMobile && onMobileClose) {
      onMobileClose()
    }
  }

  if (item.hasDropdown) {
    return (
      <div 
        className="relative"
        onMouseEnter={() => !isMobile && setIsDropdownOpen(true)}
        onMouseLeave={() => !isMobile && setIsDropdownOpen(false)}
      >
        <button
          onClick={() => isMobile && setIsDropdownOpen(!isDropdownOpen)}
          className={`flex items-center space-x-1 px-3 py-2 rounded-md font-medium transition-all duration-200 ${
            isActive 
              ? 'text-mercury-primary bg-gray-50' 
              : 'text-gray-600 hover:text-mercury-primary hover:bg-gray-50'
          }`}
        >
          <span>{item.name}</span>
          <ChevronDown 
            className={`w-4 h-4 transition-transform duration-200 ${
              isDropdownOpen ? 'rotate-180' : ''
            }`} 
          />
        </button>
        
        {item.dropdownItems && (
          <Dropdown
            items={item.dropdownItems}
            isOpen={isDropdownOpen}
            onClose={() => setIsDropdownOpen(false)}
          />
        )}
      </div>
    )
  }

  return (
    <Link
      href={item.href}
      onClick={handleClick}
      className={`px-3 py-2 rounded-md font-medium transition-all duration-200 ${
        isActive 
          ? 'text-mercury-primary bg-gray-50' 
          : 'text-gray-600 hover:text-mercury-primary hover:bg-gray-50'
      }`}
    >
      {item.name}
    </Link>
  )
}

export default function MercuryNavigation() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled 
          ? 'bg-mercury-surface/95 backdrop-blur-xl border-b border-gray-200/50 shadow-soft' 
          : 'bg-transparent'
      }`}
    >
      <div className="container-mercury">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2 group">
            <div className="w-8 h-8 bg-gradient-mercury-accent rounded-lg flex items-center justify-center">
              <Database className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold text-mercury-primary group-hover:text-mercury-accent transition-colors duration-200">
              Pollarbase
            </span>
            <span className="text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full font-medium">
              DEV
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            {navigationItems.map((item) => (
              <NavItem key={item.name} item={item} pathname={pathname} />
            ))}
          </nav>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center space-x-4">
            <Link
              href="/auth/signin"
              className="text-gray-600 hover:text-mercury-primary font-medium transition-colors duration-200"
            >
              Sign In
            </Link>
            <Link
              href="/auth/signup"
              className="btn-primary px-4 py-2 text-sm"
            >
              Get Started
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-md text-gray-600 hover:text-mercury-primary hover:bg-gray-50 transition-all duration-200"
          >
            {isMobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="md:hidden border-t border-gray-200 bg-mercury-surface/95 backdrop-blur-md"
            >
              <div className="px-4 py-4 space-y-2">
                {navigationItems.map((item) => (
                  <NavItem 
                    key={item.name} 
                    item={item} 
                    pathname={pathname} 
                    isMobile={true}
                    onMobileClose={() => setIsMobileMenuOpen(false)}
                  />
                ))}
                
                <div className="pt-4 border-t border-gray-200 space-y-2">
                  <Link
                    href="/auth/signin"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block px-3 py-2 text-gray-600 hover:text-mercury-primary font-medium transition-colors duration-200"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/auth/signup"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block btn-primary px-3 py-2 text-center"
                  >
                    Get Started
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.header>
  )
} 