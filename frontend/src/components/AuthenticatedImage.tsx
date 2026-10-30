import { useEffect, useState } from 'react'

import { API_BASE_URL, apiClient } from '@/api/client'
import { cn } from '@/lib/cn'

interface AuthenticatedImageProps {
  path: string | null
  alt: string
  className?: string
  fallbackClassName?: string
}

export const AuthenticatedImage = ({
  path,
  alt,
  className,
  fallbackClassName,
}: AuthenticatedImageProps) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!path) {
      setObjectUrl(null)
      return
    }

    let objectUrlCreated: string | null = null
    const controller = new AbortController()
    const relativePath = path.startsWith(API_BASE_URL)
      ? path.slice(API_BASE_URL.length)
      : path.replace(/^\/api\/v1/, '')

    apiClient
      .get(relativePath, { responseType: 'blob', signal: controller.signal })
      .then((response) => {
        objectUrlCreated = URL.createObjectURL(response.data)
        setObjectUrl(objectUrlCreated)
      })
      .catch(() => setObjectUrl(null))

    return () => {
      controller.abort()
      if (objectUrlCreated) URL.revokeObjectURL(objectUrlCreated)
    }
  }, [path])

  if (!objectUrl) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-slate-50 text-[10px] text-slate-400',
          fallbackClassName ?? className,
        )}
      >
        Sin imagen
      </div>
    )
  }

  return <img src={objectUrl} alt={alt} className={className} />
}
