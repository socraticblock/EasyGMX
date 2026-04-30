"use client"

import { Component, type ReactNode } from "react"

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center space-y-4">
          <div className="text-4xl">&#x26A0;&#xFE0F;</div>
          <h2 className="text-xl font-bold">Something went wrong</h2>
          <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
            {this.state.error?.message || "An unexpected error occurred. Your funds are safe on-chain."}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null })
              window.location.reload()
            }}
            className="px-6 h-10 rounded-xl bg-[#418cf5] text-white text-sm font-semibold hover:bg-[#418cf5]/90 transition-all"
          >
            Reload
          </button>
          <a
            href="https://app.gmx.io"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#418cf5]/60 hover:text-[#418cf5]"
          >
            Manage positions on GMX &rarr;
          </a>
        </div>
      )
    }

    return this.props.children
  }
}
