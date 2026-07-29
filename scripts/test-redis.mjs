// Quick test of Upstash Redis connection
import Redis from 'ioredis'

const url = process.argv[2] || 'rediss://default:gQAAAAAAAfRoAAIgcDI5OThhNmQ2Y2Y4ZjE0NjViYjU4MzFhN2M4MjhmYTg5OA@adjusted-dingo-128104.upstash.io:6379'

console.log('Connecting to:', url.replace(/:\/\/[^@]*@/, '://***:***@'))

const client = new Redis(url, {
  maxRetriesPerRequest: 3,
  tls: { rejectUnauthorized: false },
})

client.on('connect', () => console.log('✓ Connected'))
client.on('error', (err) => console.error('✗ Error:', err.message))

try {
  const pong = await client.ping()
  console.log('PING:', pong)

  await client.set('xauusd:test', 'hello-from-test', 'EX', 60)
  const val = await client.get('xauusd:test')
  console.log('GET xauusd:test:', val)

  await client.del('xauusd:test')
  console.log('✓ All tests passed!')
  process.exit(0)
} catch (e) {
  console.error('✗ Test failed:', e.message)
  process.exit(1)
}
