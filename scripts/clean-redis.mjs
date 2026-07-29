// Clean test data from Upstash Redis before Vercel deployment
import Redis from 'ioredis'

const url = 'rediss://default:gQAAAAAAAfRoAAIgcDI5OThhNmQ2Y2Y4ZjE0NjViYjU4MzFhN2M4MjhmYTg5OA@adjusted-dingo-128104.upstash.io:6379'

const client = new Redis(url, { tls: { rejectUnauthorized: false } })

console.log('Cleaning test data from Upstash Redis...')

const keys = await client.keys('xauusd:*')
console.log('Found keys:', keys)

if (keys.length > 0) {
  await client.del(...keys)
  console.log('✓ Deleted', keys.length, 'keys')
} else {
  console.log('✓ No keys to delete (already clean)')
}

const remaining = await client.keys('xauusd:*')
console.log('Remaining xauusd keys:', remaining.length)
console.log('✓ Redis is clean — ready for Vercel deployment')

process.exit(0)
