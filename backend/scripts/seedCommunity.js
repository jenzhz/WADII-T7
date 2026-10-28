import 'dotenv/config'
import bcrypt from 'bcrypt'
import mongoose from 'mongoose'
import { connectDatabase } from '../config/db.js'
import Review from '../models/Review.js'
import User from '../models/User.js'
import { getCarparkAvailability } from '../services/ltaService.js'

const DEMO_PASSWORD = 'qwertyuiop'
const DEMO_NAMES = [
  'Jen',
  'Mudit',
  'Hoshi',
  'Marco',
  'Zi Cheng',
  'Zenden',
  'Aisha',
  'Daniel',
  'Mei Lin',
  'Ryan',
  'Sofia',
]

const REVIEW_COMMENTS = [
  'Easy to enter and the signs made it clear where to park.',
  'The lots are comfortable, although the turn into the carpark is a little tight.',
  'Convenient location and I found a lot quickly during my visit.',
  'The entrance was easy to miss the first time, but parking inside was straightforward.',
  'Good experience overall. The exits were clearly marked and traffic moved smoothly.',
  'A useful option for the area, especially outside the evening peak period.',
  'The ramps need a little care, but the parking levels are well organised.',
  'Lots were spacious enough for an SUV and the lift lobby was easy to find.',
  'Entry was smooth, but it took me a while to locate the correct pedestrian exit.',
  'Clear signs and a convenient walk to nearby shops and offices.',
  'It gets busy around lunchtime, though the internal traffic flow is manageable.',
  'A pleasant carpark with decent lot sizes and simple entry and exit routes.',
  'The location is excellent, but drivers should slow down around the narrow corners.',
  'I had no trouble finding the entrance and the directional signs were helpful.',
  'Parking was straightforward and the carpark felt well laid out.',
  'The exit queue can build up during peak hours, so allow a little extra time.',
  'Good for a quick stop. The route back to the main road was easy to follow.',
  'The lot markings were clear and there was enough room to open the doors comfortably.',
  'Useful parking option nearby, although the entrance signage could be more obvious.',
  'Overall a reliable carpark that I would use again when visiting the area.',
]

const REPLY_COMMENTS = [
  'Thanks for the tip. This helped on my first visit.',
  'I had a similar experience during the evening peak.',
  'The alternative entrance was easier for me too.',
  'Good to know — I will try that route next time.',
  'The signs seem clearer after the recent update.',
]

const PREFERRED_CARPARKS = [
  'RAFFLES CITY',
  'SUNTEC',
  'MARINA SQUARE',
  'VIVO',
  'PLAZA SINGAPURA',
  'ORCHARD',
  'BUGIS',
  'TAMPINES',
  'JURONG',
  'BEDOK',
  'PUNGGOL',
  'SENGKANG',
]

function emailFor(name) {
  return `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}@test.com`
}

function selectCarparks(rows, count = 12) {
  const cars = rows
    .filter(row => row.lotType === 'C' && row.name && row.carparkId)
    .sort((a, b) => a.name.localeCompare(b.name))
  const selected = []

  for (const keyword of PREFERRED_CARPARKS) {
    const match = cars.find(row => row.name.toUpperCase().includes(keyword) &&
      !selected.some(item => item.carparkId === row.carparkId))
    if (match) selected.push(match)
  }

  const step = Math.max(1, Math.floor(cars.length / count))
  for (let index = 0; selected.length < count && index < cars.length; index += step) {
    const row = cars[index]
    if (!selected.some(item => item.carparkId === row.carparkId)) selected.push(row)
  }

  if (selected.length < count) {
    for (const row of cars) {
      if (!selected.some(item => item.carparkId === row.carparkId)) selected.push(row)
      if (selected.length === count) break
    }
  }
  return selected.slice(0, count)
}

async function clearDemoData() {
  const reviewResult = await Review.deleteMany({ isDemo: true })
  const userResult = await User.deleteMany({ isDemo: true })
  return { reviews: reviewResult.deletedCount, users: userResult.deletedCount }
}

async function seedUsers() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12)
  const users = []
  for (const name of DEMO_NAMES) {
    const user = await User.findOneAndUpdate(
      { email: emailFor(name) },
      { $set: { name, passwordHash, isDemo: true } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )
    users.push(user)
  }
  return users
}

function buildReviewDocuments(users, carparks) {
  const now = Date.now()
  return Array.from({ length: 40 }, (_, index) => {
    const user = users[index % users.length]
    const carpark = carparks[index % carparks.length]
    const overallRating = [5, 4, 4, 3, 5, 4, 3, 4][index % 8]
    const createdAt = new Date(now - (index * 17 + 4) * 60 * 60 * 1000)
    const updatedAt = new Date(createdAt.getTime() + (index % 4) * 35 * 60 * 1000)
    const replies = index % 4 === 0
      ? [{
          _id: new mongoose.Types.ObjectId(),
          user: users[(index + 3) % users.length]._id,
          comment: REPLY_COMMENTS[index % REPLY_COMMENTS.length],
          createdAt: new Date(updatedAt.getTime() + 45 * 60 * 1000),
          updatedAt: new Date(updatedAt.getTime() + 45 * 60 * 1000),
        }]
      : []

    return {
      _id: new mongoose.Types.ObjectId(),
      user: user._id,
      carparkId: carpark.id,
      isDemo: true,
      overallRating,
      lotSpaciousness: Math.max(1, Math.min(5, overallRating + (index % 3 === 0 ? -1 : 0))),
      entranceExitAccessibility: Math.max(1, Math.min(5, overallRating + (index % 4 === 0 ? -1 : 0))),
      signage: Math.max(1, Math.min(5, overallRating + (index % 5 === 0 ? -1 : 0))),
      evExperience: carpark.hasEvCharger ? Math.max(3, overallRating) : null,
      comment: REVIEW_COMMENTS[index % REVIEW_COMMENTS.length],
      replies,
      createdAt,
      updatedAt: replies[0]?.updatedAt || updatedAt,
    }
  })
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not configured in backend/.env')
  await connectDatabase(process.env.MONGODB_URI)

  if (process.argv.includes('--clear')) {
    const removed = await clearDemoData()
    console.log(`Removed ${removed.reviews} demo reviews and ${removed.users} demo users.`)
    return
  }

  const availability = await getCarparkAvailability()
  const carparks = selectCarparks(availability.carparks)
  if (carparks.length < 8) throw new Error('Not enough valid carparks were returned by LTA DataMall.')

  const removed = await clearDemoData()
  const users = await seedUsers()
  const documents = buildReviewDocuments(users, carparks)
  await Review.collection.insertMany(documents)

  console.log(`Refreshed demo data (removed ${removed.reviews} reviews and ${removed.users} users).`)
  console.log(`Created ${users.length} users and ${documents.length} reviews across ${carparks.length} carparks.`)
  console.log(`Demo login password: ${DEMO_PASSWORD}`)
  console.log('Demo users:')
  for (const user of users) console.log(`- ${user.name}: ${user.email}`)
  console.log('Reviewed carparks:')
  for (const carpark of carparks) console.log(`- ${carpark.name} (${carpark.id})`)
}

main()
  .catch(error => {
    console.error(`Community seed failed: ${error.message}`)
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.disconnect()
  })
