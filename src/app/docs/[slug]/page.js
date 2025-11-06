'use client'

import { useState, useEffect, use } from 'react'
import ReactMarkdown from 'react-markdown'
import { Prose } from '@/components/Prose'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import { Callout } from '@/components/Callout'

const renderers = {
  h1: ({ node, ...props }) => (
    <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white" {...props} />
  ),
  h2: ({ node, ...props }) => (
    <h2 className="mt-8 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white" {...props} />
  ),
  h3: ({ node, ...props }) => (
    <h3 className="mt-6 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white" {...props} />
  ),
  callout: ({ children, type }) => (
    <Callout type={type}>{children}</Callout>
  ),
}

export default function Page({ params }) {
  const { slug } = use(params)
  const decodedSlug = decodeURIComponent(slug)
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/docs/' + decodedSlug)
      .then(res => {
        if (!res.ok) {
          throw new Error(`API returned ${res.status}: ${res.statusText}`)
        }
        return res.json()
      })
      .then(data => {
        setTitle(data.title)
        setContent(data.content)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [decodedSlug])

  if (loading) {
    return (
      <div className="min-w-0 max-w-3xl flex-auto px-4 py-16 lg:ml-0 lg:mr-auto lg:px-8 lg:pt-0">
        <div className="flex items-center justify-center min-h-[60vh]">
          <img src="/images/gif/pre-loader.gif" alt="Loading..." />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-w-0 max-w-3xl flex-auto px-4 py-16 lg:ml-0 lg:mr-auto lg:px-8 lg:pt-0">
        <h1>Error loading page</h1>
        <p>{error}</p>
        <p>Slug: {slug}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900">
      <Prose className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
          {title}
        </h1>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
          components={renderers}
        >
          {content}
        </ReactMarkdown>
      </Prose>
    </div>
  )
}