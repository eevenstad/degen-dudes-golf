'use client'

import { useState } from 'react'

interface HelpSection {
  title: string
  content: string | React.ReactNode
}

interface HelpButtonProps {
  title: string
  sections: HelpSection[]
}

export default function HelpButton({ title, sections }: HelpButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* ? button — fixed bottom right */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 z-40 w-10 h-10 rounded-full font-bold text-base
                   flex items-center justify-center shadow-lg active:scale-95 transition-all border"
        style={{ background: '#1A3A2A', color: '#D4A947', borderColor: '#D4A947' }}
        aria-label="Help"
      >
        ?
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.80)' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm mx-auto rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl"
            style={{ background: '#1A3A2A', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0"
              style={{ borderColor: '#2D4A1E' }}
            >
              <h2 className="font-black text-base" style={{ color: '#D4A947' }}>{title}</h2>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold
                           active:scale-90 transition-all"
                style={{ background: 'rgba(26,26,10,0.6)', color: '#9A9A50' }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
              {sections.map((section, i) => (
                <div key={i}>
                  {section.title && (
                    <h3 className="font-bold text-sm mb-2 tracking-wide uppercase" style={{ color: '#D4A947' }}>
                      {section.title}
                    </h3>
                  )}
                  {typeof section.content === 'string' ? (
                    <p className="text-sm leading-relaxed" style={{ color: '#F5E6C3' }}>
                      {section.content}
                    </p>
                  ) : (
                    section.content
                  )}
                </div>
              ))}
            </div>

            {/* Close button bottom */}
            <div className="px-5 pb-6 pt-2 flex-shrink-0">
              <button
                onClick={() => setOpen(false)}
                className="w-full py-3 rounded-xl font-bold text-sm active:scale-[0.98] transition-all border"
                style={{ borderColor: '#2D4A1E', color: '#9A9A50', background: 'rgba(26,26,10,0.5)' }}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
