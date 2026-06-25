const dotenv = require('dotenv')
const path = require('path')
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args))

dotenv.config({ path: path.join(__dirname, '../.env') })

const DAILY_API_KEY = process.env.DAILY_API_KEY
console.log('DAILY_API_KEY loaded:', DAILY_API_KEY ? 'Yes' : 'No')

async function run() {
  if (!DAILY_API_KEY) {
    console.error('No DAILY_API_KEY found in .env')
    return
  }

  const response = await fetch('https://api.daily.co/v1/rooms', {
    headers: {
      Authorization: `Bearer ${DAILY_API_KEY}`
    }
  })

  console.log('Response status:', response.status)
  const json = await response.json()
  console.log('Daily.co rooms response:', JSON.stringify(json, null, 2))
}

run().catch(console.error)
