#!/usr/bin/env node
process.env.NODE_ENV = "production"
await import("../.next/standalone/server.js")
