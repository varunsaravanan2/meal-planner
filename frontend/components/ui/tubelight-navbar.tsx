"use client"

import React, { useEffect, useState } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface NavItem {
  name: string
  url: string
  icon: LucideIcon
}

interface NavBarProps {
  items: NavItem[]
  className?: string
}

export function NavBar({ items, className }: NavBarProps) {
  const pathname = usePathname()
  const activeItem = items.find(item => pathname === item.url || (item.url !== '/dashboard' && pathname.startsWith(item.url)))
  const [activeTab, setActiveTab] = useState(activeItem?.name ?? items[0].name)

  useEffect(() => {
    if (activeItem) setActiveTab(activeItem.name)
  }, [pathname, activeItem])

  return (
    <div className={cn("fixed bottom-0 sm:top-0 left-0 right-0 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-50 pb-[calc(env(safe-area-inset-bottom)+12px)] sm:pb-0 sm:pt-6 pointer-events-none px-3 sm:px-0", className)}>
      <style>{`.nav-scroll::-webkit-scrollbar { display: none; }`}</style>
      <div className="nav-scroll pointer-events-auto flex items-center gap-1 sm:gap-3 bg-background/5 border border-border backdrop-blur-lg py-1 px-1 rounded-full shadow-lg mx-auto sm:mx-0"
        style={{ background: 'rgba(10,10,14,0.85)', borderColor: 'rgba(255,255,255,0.08)', maxWidth: '100%', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {items.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.name

          return (
            <Link
              key={item.name}
              href={item.url}
              onClick={() => setActiveTab(item.name)}
              className={cn(
                "relative cursor-pointer text-sm font-semibold px-3.5 py-2.5 sm:px-6 sm:py-2 rounded-full transition-colors overflow-hidden flex-shrink-0",
                "hover:text-white",
                isActive ? "text-white" : "text-white/40",
              )}
            >
              <span className="hidden md:inline">{item.name}</span>
              <span className="md:hidden">
                <Icon size={18} strokeWidth={2.5} />
              </span>
              {isActive && (
                <motion.div
                  layoutId="lamp"
                  className="absolute inset-0 w-full rounded-full -z-10"
                  style={{ background: 'rgba(99,102,241,0.18)' }}
                  initial={false}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
