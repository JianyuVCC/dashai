import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Bot, User, Loader2 } from 'lucide-react'
import { cn } from '../lib/utils'
import type { ChatMessage } from '../lib/types'

interface Props {
  onSend: (message: string, history: ChatMessage[]) => Promise<{ message: string }>
  title?: string
  placeholder?: string
}

export function ChatWidget({ onSend, title = 'Ask about your data', placeholder = 'Ask anything about your data…' }: Props) {
  const [open, setOpen] = useState(false)
  const [history, setHistory] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history, loading])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: ChatMessage = { role: 'user', content: text }
    setHistory((h) => [...h, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await onSend(text, [...history, userMsg])
      setHistory((h) => [...h, { role: 'assistant', content: res.message }])
    } catch {
      setHistory((h) => [...h, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full shadow-2xl transition-all duration-200 flex items-center justify-center',
          open
            ? 'bg-surface-3 text-slate-400 hover:text-white'
            : 'bg-violet-600 hover:bg-violet-700 text-white'
        )}
        aria-label="Toggle chat"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
        {!open && history.length === 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full text-[9px] flex items-center justify-center font-bold">
            AI
          </span>
        )}
      </button>

      {/* Chat panel */}
      <div
        className={cn(
          'fixed bottom-24 right-6 z-40 w-[360px] max-h-[560px] card flex flex-col shadow-2xl transition-all duration-200 origin-bottom-right',
          open ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-violet-600/30 flex items-center justify-center">
            <Bot size={16} className="text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">{title}</p>
            <p className="text-xs text-slate-500">Powered by Claude</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
          {history.length === 0 && (
            <div className="text-center py-8">
              <Bot size={32} className="text-violet-500/50 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Ask me anything about your data.</p>
              <div className="mt-3 space-y-1">
                {[
                  'What are the top 5 values?',
                  'Show me trends over time',
                  'Which category has the most records?',
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => { setInput(q); inputRef.current?.focus() }}
                    className="block w-full text-xs text-left text-slate-400 hover:text-violet-400 bg-surface-3 hover:bg-surface-4 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {history.map((msg, i) => (
            <div key={i} className={cn('flex gap-2', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                msg.role === 'user' ? 'bg-violet-600' : 'bg-surface-3'
              )}>
                {msg.role === 'user'
                  ? <User size={12} className="text-white" />
                  : <Bot size={12} className="text-violet-400" />}
              </div>
              <div className={cn(
                'max-w-[80%] rounded-xl px-3 py-2 text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'bg-violet-600 text-white rounded-tr-sm'
                  : 'bg-surface-3 text-slate-200 rounded-tl-sm'
              )}>
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-2">
              <div className="w-6 h-6 rounded-full bg-surface-3 flex items-center justify-center flex-shrink-0">
                <Bot size={12} className="text-violet-400" />
              </div>
              <div className="bg-surface-3 rounded-xl rounded-tl-sm px-3 py-2">
                <Loader2 size={14} className="text-violet-400 animate-spin" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-3 py-3 border-t border-border flex-shrink-0">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={placeholder}
              rows={1}
              className="flex-1 bg-surface-3 border border-border text-slate-100 placeholder-slate-500 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent max-h-24 overflow-auto"
              style={{ lineHeight: '1.4' }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="w-9 h-9 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg flex items-center justify-center transition-colors flex-shrink-0"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
