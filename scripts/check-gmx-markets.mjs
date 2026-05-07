import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const { GmxApiSdk } = require("@gmx-io/sdk/v2")

const MARKETS = {
  "ETH/USD": "0x70d95587d40A2caf56bd97485aB3Eec10Bee6336",
  "BTC/USD": "0x47c031236e19d024b42f8AE6780E44A573170703",
  "SOL/USD": "0x09400D9DB990D5ed3f35D7be61DfAEB900Af03C9",
  "ARB/USD": "0xC25cEf6061Cf5dE5eb761b50E4743c1F5D7E5407",
}

const sdk = new GmxApiSdk({ chainId: 42161 })
const markets = await sdk.fetchMarketsInfo()
const found = new Set(markets.map((m) => String(m.marketTokenAddress).toLowerCase()))

const missing = Object.entries(MARKETS).filter(([, address]) => !found.has(address.toLowerCase()))

if (missing.length > 0) {
  console.error("Configured GMX markets were not found in fetchMarketsInfo():")
  for (const [key, address] of missing) console.error(`- ${key}: ${address}`)
  process.exit(1)
}

console.log("GMX launch markets verified.")
