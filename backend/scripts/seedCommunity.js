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

const REPLY_COMMENTS = [
  'Thanks for the tip. This helped on my first visit.',
  'I had a similar experience during the evening peak.',
  'The alternative entrance was easier for me too.',
  'Good to know — I will try that route next time.',
  'The signs seem clearer after the recent update.',
]

const SMU_CONNEXION = {
  name: 'SMU Connexion',
  latitude: 1.295583924813692,
  longitude: 103.8493312274774,
}

const BEDOK_MALL = {
  name: 'Bedok Mall',
  latitude: 1.324736327847299,
  longitude: 103.929256259998,
}

const DEMO_CARPARKS = [
  {
    id: 'URA:A0011:C',
    name: 'Armenian Street Off Street',
    reviews: [
      ['moderate', 'Very close to SMU Connexion. The entrance needs some attention on a first visit, but the parking area is manageable once inside.'],
      ['beginner-friendly', 'I arrived outside the peak period and found the layout simple. The open parking area made it easy to judge the available space.'],
      ['moderate', 'Convenient for a short visit to SMU. Slow down near the approach because the turn-in can be missed if you are watching traffic.'],
      ['moderate', 'The lots were comfortable for my sedan, although moving around other waiting cars required a little patience.'],
      ['challenging', 'Busy when I visited and the approach felt tight with cars entering and leaving together. New drivers may want to avoid peak time.'],
      ['beginner-friendly', 'Straightforward parking during the morning. I could see the lot markings clearly and did not need to make any tight ramp turns.'],
      ['moderate', 'Good location, but check the route before driving over. The final approach was less obvious than parking itself.'],
      ['moderate', 'Parking was fine in a compact car. Larger vehicles may need an extra adjustment when the neighbouring lots are occupied.'],
      ['beginner-friendly', 'A practical option near campus. I found a lot quickly and the exit back towards the main road was easy to follow.'],
      ['challenging', 'The carpark felt crowded around lunchtime and there was limited room to pause while choosing a lot. Better for confident drivers then.'],
    ],
  },
  {
    id: 'HDB:WCB:C',
    name: 'Waterloo Centre Basement Car Park',
    reviews: [
      ['challenging', 'The basement entrance is visible, but I took the ramp slowly. Once downstairs, the directional arrows were helpful.'],
      ['challenging', 'Some turns felt narrow in my SUV and the pillars reduced the room for correction. I would take extra care on a first visit.'],
      ['moderate', 'The lots are usable, although reversing in needed one adjustment. It is a convenient walk to the SMU area.'],
      ['challenging', 'Entry was manageable outside peak time. Following the arrows made the internal route much clearer.'],
      ['challenging', 'The combination of the ramp and basement pillars may be stressful for a brand-new driver, especially when another car is behind.'],
      ['moderate', 'I drove a small hatchback and had no major problem. Keep close watch on the corners and take them slowly.'],
      ['beginner-friendly', 'Quiet on a weekend morning, so I had plenty of time to position the car. The lot I used was straightforward.'],
      ['challenging', 'Tight when several vehicles were circulating. I needed an extra turn to line up properly between the neighbouring cars.'],
      ['moderate', 'The exit route was clearer than I expected. The main difficulty was judging the space beside the pillars.'],
      ['challenging', 'Reasonable city-centre basement parking. Not difficult if you slow down, but less forgiving than an open-air carpark.'],
    ],
  },
  {
    id: 'LTA:3:C',
    name: 'Raffles City',
    reviews: [
      ['beginner-friendly', 'Clear signs guided me from the entrance to the parking levels. The route felt organised even on my first visit.'],
      ['moderate', 'Easy to locate, but traffic builds up at busy periods. Leave more following distance so you can read the lane signs.'],
      ['beginner-friendly', 'The lot markings were clear and I had enough room to reverse into the space without multiple corrections.'],
      ['moderate', 'Most of the drive was straightforward, though a few internal turns needed care in a larger vehicle.'],
      ['beginner-friendly', 'A comfortable choice for someone unfamiliar with the area. The signs towards the exit were especially useful.'],
      ['moderate', 'Parking itself was easy; the busier part was joining the queue near the entrance during the evening peak.'],
      ['beginner-friendly', 'Good lighting and visible arrows helped me plan each turn. I would recommend it to a less experienced driver off peak.'],
      ['moderate', 'Plenty of guidance inside, but remember your parking level because the carpark is large and has several sections.'],
      ['beginner-friendly', 'I used a family car and the selected lot had comfortable door space. Entry and exit were both predictable.'],
      ['beginner-friendly', 'Generally manageable, with the main challenge coming from other traffic rather than the physical parking layout.'],
    ],
  },
  {
    id: 'LTA:10:C',
    name: 'The Cathay',
    reviews: [
      ['challenging', 'The entrance was easy enough to find, but I slowed down for the ramp and watched the kerbs around the bends.'],
      ['challenging', 'The curved sections required careful steering in my SUV. A new driver may prefer a quieter time for the first visit.'],
      ['moderate', 'I managed comfortably in a compact car. Keep to a low speed and set up early before each turn.'],
      ['moderate', 'The signs were useful and the lots were acceptable. The ramp was the part that needed the most attention.'],
      ['challenging', 'Meeting another vehicle near a bend made the route feel tight. Be prepared to pause and give each other room.'],
      ['challenging', 'Convenient for SMU and Dhoby Ghaut. Parking was fine once I reached the level and found an open row.'],
      ['challenging', 'I needed an extra correction when reversing beside a pillar. Larger cars should choose their lot carefully.'],
      ['moderate', 'Not as difficult as expected outside peak time. The arrows made the circulation route easy to understand.'],
      ['beginner-friendly', 'A quiet weekday morning made this straightforward. I had enough time and space to park without pressure.'],
      ['challenging', 'The bends and surrounding traffic may feel demanding for a learner. I would practise in a smaller car or visit off peak.'],
    ],
  },
  {
    id: 'HDB:BBB:C',
    name: 'Bras Basah Complex Basement Car Park',
    reviews: [
      ['moderate', 'The basement route was manageable when taken slowly. Watch the directional arrows before committing to a lane.'],
      ['moderate', 'A useful option near SMU. Some corners need attention, but the lot I used had enough room for a sedan.'],
      ['challenging', 'The pillars made the reversing angle harder to judge in my larger car. I needed two adjustments to centre it.'],
      ['moderate', 'Entry was straightforward after checking the map beforehand. Inside, following the marked flow helped a lot.'],
      ['beginner-friendly', 'It was quiet in the morning and I could choose a clear lot away from the busier section.'],
      ['challenging', 'The carpark felt tight when vehicles were passing in both directions. Less experienced drivers should avoid rushing.'],
      ['moderate', 'Lighting and markings were adequate. I took the corners slowly and had no issue reaching the exit.'],
      ['moderate', 'Compact-car friendly, though an SUV driver may want to look for a lot with more space beside the pillars.'],
      ['beginner-friendly', 'My visit was smooth because there were several open spaces. Reversing into the selected lot was simple.'],
      ['challenging', 'Peak-period circulation was the hardest part. Cars waiting for lots reduced the available turning space.'],
    ],
  },
  {
    id: 'LTA:66:C',
    name: 'Funan Mall',
    reviews: [
      ['beginner-friendly', 'Clear signs from the entrance made this easy on my first visit. The parking levels felt well organised.'],
      ['beginner-friendly', 'The lot was comfortable for my sedan and I had enough room to open the doors after parking.'],
      ['moderate', 'The layout is clear, but I slowed down at the busier junctions inside because cars were changing rows.'],
      ['beginner-friendly', 'Good lighting, visible arrows, and a straightforward exit route. Suitable for a newer driver outside peak hours.'],
      ['moderate', 'Parking was easy, although the queue entering the carpark added some pressure during lunchtime.'],
      ['beginner-friendly', 'I drove an SUV and still found the selected lot manageable. The signs towards the lifts were helpful too.'],
      ['beginner-friendly', 'A predictable modern carpark experience. I did not encounter any unusually tight ramps or confusing turns.'],
      ['moderate', 'The physical layout was fine; just be alert for pedestrians and other cars near the lift-lobby sections.'],
      ['beginner-friendly', 'I would choose this again when bringing a less experienced driver. There was time and room to line up properly.'],
      ['beginner-friendly', 'Easy entry, clear markings, and a simple drive out. The main consideration is avoiding the busiest arrival times.'],
    ],
  },
  {
    id: 'LTA:65:C',
    name: 'Bedok Mall',
    reviews: [
      ['beginner-friendly', 'The entrance signs were clear and I could follow the arrows to an available level without second-guessing the route.'],
      ['moderate', 'Parking was manageable, but the queue and surrounding traffic made the approach feel busier during the evening peak.'],
      ['beginner-friendly', 'I found the lot markings clear and had enough room to reverse my sedan in with one smooth attempt.'],
      ['moderate', 'The internal route is organised, although I slowed down at the bends and watched for cars leaving their rows.'],
      ['moderate', 'Convenient for the mall and transport interchange. The main challenge was staying in the correct lane on the approach.'],
      ['beginner-friendly', 'A comfortable first visit outside peak hours. The signs towards the exit were easy to spot after parking.'],
      ['challenging', 'It felt pressured when several cars were waiting behind me. New drivers may prefer a quieter weekday period.'],
      ['moderate', 'The lot itself was fine for an SUV, but I needed to take the turns slowly and set up early.'],
      ['beginner-friendly', 'Good lighting and visible directional arrows helped me plan where to turn and where to stop.'],
      ['moderate', 'Generally straightforward once inside. Give yourself extra time when traffic around Bedok Central is heavy.'],
    ],
  },
  {
    id: 'HDB:B8B:C',
    name: 'Block 222 Bedok North Drive',
    reviews: [
      ['beginner-friendly', 'The parking area was easy to understand and I could see several available lots before choosing one.'],
      ['beginner-friendly', 'Straightforward for my first visit. I had enough space to line up and reverse without feeling rushed.'],
      ['moderate', 'The route was simple, though I paid attention to pedestrians and vehicles crossing between the nearby blocks.'],
      ['beginner-friendly', 'Clear lot markings and a predictable exit made this a comfortable option for a newer driver.'],
      ['beginner-friendly', 'I drove a family car and still had reasonable space on both sides after parking.'],
      ['moderate', 'It became busier around meal time, so I needed more patience while waiting for another car to leave.'],
      ['beginner-friendly', 'No complicated ramps or confusing internal route during my visit. Parking felt calm and manageable.'],
      ['beginner-friendly', 'The approach from Bedok North Drive was easy to follow after checking the map once.'],
      ['moderate', 'A few occupied rows made circulation tighter, but taking the corners slowly was enough.'],
      ['beginner-friendly', 'A useful alternative to mall parking. I found a lot quickly and left without difficulty.'],
    ],
  },
  {
    id: 'HDB:B8:C',
    name: 'Blocks 201/203 Bedok North Street 1',
    reviews: [
      ['moderate', 'The carpark is close to Bedok Mall, but I needed to watch the lane flow carefully near the block entrances.'],
      ['challenging', 'Several parked vehicles reduced my view around a corner, so I moved slowly and prepared to stop.'],
      ['moderate', 'The lot size was acceptable for a sedan. Reversing took one correction when neighbouring cars were present.'],
      ['beginner-friendly', 'Quiet in the morning and easy to navigate. I had enough time to choose a comfortable lot.'],
      ['challenging', 'The busy period made the available turning room feel limited, especially with cars waiting for spaces.'],
      ['moderate', 'The route made sense after the first turn, though the entrance was less obvious than the mall carpark.'],
      ['beginner-friendly', 'I used a compact car and found the parking straightforward outside the peak period.'],
      ['moderate', 'Good location for nearby shops. Stay alert for pedestrians and take extra care when leaving the row.'],
      ['challenging', 'Larger vehicles may need more than one adjustment when the surrounding lots are fully occupied.'],
      ['moderate', 'Overall manageable with patience. The difficulty changes a lot depending on traffic and how full the rows are.'],
    ],
  },
  {
    id: 'LTA:43:C',
    name: 'Westgate',
    reviews: [
      ['beginner-friendly', 'Clear entrance signs and bright lighting made the route easy to follow on my first visit.'],
      ['moderate', 'The parking levels were organised, but I slowed down around the bends in my larger vehicle.'],
      ['moderate', 'Finding a lot was straightforward; the busier part was joining the entrance queue during dinner time.'],
      ['beginner-friendly', 'The lot markings were clear and I had enough space to reverse without multiple corrections.'],
      ['moderate', 'A convenient option for Jurong East, though peak-hour traffic requires patience on the approach.'],
    ],
  },
  {
    id: 'LTA:1:C',
    name: 'Suntec City',
    reviews: [
      ['beginner-friendly', 'The directional signs helped me reach the correct parking zone without getting lost.'],
      ['moderate', 'The carpark is large, so remember your zone and take time to read the signs before each turn.'],
      ['beginner-friendly', 'Comfortable lot size for my sedan and a predictable route towards the exit.'],
      ['beginner-friendly', 'Good lighting and clear arrows made this manageable for a newer driver outside peak hours.'],
      ['moderate', 'Parking was easy, but event traffic made circulation slower and required more attention.'],
    ],
  },
  {
    id: 'HDB:J60M:C',
    name: '505A Jurong West Street 52',
    reviews: [
      ['beginner-friendly', 'The layout was simple and I could see the available lots clearly before choosing one.'],
      ['beginner-friendly', 'I had enough room to line up and reverse my family car without feeling rushed.'],
      ['moderate', 'The route was manageable, though I watched carefully for pedestrians moving between the blocks.'],
      ['beginner-friendly', 'Clear markings and a straightforward exit made this a comfortable first visit.'],
      ['beginner-friendly', 'Quiet outside the evening peak and easy to navigate at a slow speed.'],
    ],
  },
  {
    id: 'LTA:59:C',
    name: 'CQ @ Clarke Quay',
    reviews: [
      ['moderate', 'The entrance was easy to locate, but the internal turns needed care in my SUV.'],
      ['challenging', 'Busy nightlife traffic added pressure and I needed an extra correction beside a pillar.'],
      ['beginner-friendly', 'A weekday afternoon was calm and I found the signs and lot markings straightforward.'],
      ['moderate', 'Manageable when taken slowly, especially around the bends and vehicles leaving their rows.'],
      ['challenging', 'The busier period felt tight for a new driver, so I would recommend visiting off peak first.'],
    ],
  },
  {
    id: 'LTA:52:C',
    name: 'Orchard Gateway',
    reviews: [
      ['challenging', 'The ramp and tighter turns required careful steering in my larger vehicle.'],
      ['moderate', 'Clear signs helped, but I still took the bends slowly and set up early for each turn.'],
      ['challenging', 'Traffic behind me made the narrow-feeling sections stressful on my first visit.'],
      ['moderate', 'Parking was manageable in a compact car, though the approach needs attention.'],
      ['challenging', 'I needed more than one adjustment beside an occupied neighbouring lot. Better for confident drivers.'],
    ],
  },
  {
    id: 'URA:A0021:C',
    name: 'Amoy Street Off Street',
    reviews: [
      ['beginner-friendly', 'The open layout made it easy to judge the lot and position my sedan.'],
      ['moderate', 'The final approach needed attention because surrounding city traffic was moving quickly.'],
      ['moderate', 'Parking itself was manageable, but occupied neighbouring lots reduced the turning room.'],
      ['beginner-friendly', 'Straightforward during the morning, with visible markings and no complicated internal route.'],
      ['challenging', 'It felt crowded at lunchtime and I had limited space to pause while selecting a lot.'],
    ],
  },
  {
    id: 'HDB:ACB:C',
    name: 'Albert Centre Basement Car Park',
    reviews: [
      ['moderate', 'The basement route was understandable, but I slowed down around the pillars and corners.'],
      ['challenging', 'A larger vehicle needs careful positioning because the occupied rows can feel tight.'],
      ['beginner-friendly', 'Quiet in the morning and easy enough when I could choose a more open lot.'],
      ['moderate', 'Following the arrows helped, although reversing required one extra adjustment.'],
      ['challenging', 'Peak-period circulation reduced the available turning room and may pressure a new driver.'],
    ],
  },
  {
    id: 'HDB:Y16:C',
    name: 'Blocks 238/242 Yishun Ring Road',
    reviews: [
      ['beginner-friendly', 'The parking area was easy to understand and the lot markings were visible.'],
      ['beginner-friendly', 'I found enough space to reverse comfortably and leave room beside both doors.'],
      ['moderate', 'The main consideration was watching for pedestrians and vehicles crossing near the blocks.'],
      ['beginner-friendly', 'A calm and straightforward visit outside peak hours, suitable for a newer driver.'],
      ['moderate', 'Some occupied rows felt busier, but slowing down made the turns manageable.'],
    ],
  },
]

function emailFor(name) {
  return `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}@test.com`
}

function selectCarparks(rows) {
  const byId = new Map(rows.map(row => [row.id, row]))
  const missing = DEMO_CARPARKS.filter(config => !byId.has(config.id))
  if (missing.length) {
    throw new Error(`Demo carparks missing from live data: ${missing.map(item => item.id).join(', ')}`)
  }
  return DEMO_CARPARKS.map(config => ({ ...byId.get(config.id), name: config.name }))
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
  const overallRatings = [5, 4, 4, 3, 5, 4, 3, 4, 5, 4]
  const pricingRatings = [3, 3, 4, 3, 2, 4, 3, 4, 3, 3]
  const helpfulVoteCounts = [3, 1, 2, 0, 4, 1, 2, 3, 1, 2]
  const difficultyRatings = {
    'beginner-friendly': { lotSpaciousness: 5, entranceExitAccessibility: 5 },
    moderate: { lotSpaciousness: 4, entranceExitAccessibility: 4 },
    challenging: { lotSpaciousness: 3, entranceExitAccessibility: 2 },
  }

  return DEMO_CARPARKS.flatMap((config, carparkIndex) => {
    const carpark = carparks.find(row => row.id === config.id)
    return config.reviews.map(([parkingDifficulty, comment], reviewIndex) => {
      const sequence = carparkIndex * 10 + reviewIndex
      const user = users[(carparkIndex + reviewIndex) % users.length]
      const helpfulBy = Array.from({ length: helpfulVoteCounts[reviewIndex] }, (_, offset) =>
        users[(carparkIndex + reviewIndex + offset + 1) % users.length]._id)
      const base = difficultyRatings[parkingDifficulty]
      const createdAt = new Date(now - (sequence * 13 + 4) * 60 * 60 * 1000)
      const updatedAt = new Date(createdAt.getTime() + (sequence % 4) * 35 * 60 * 1000)
      const replies = sequence % 4 === 0
        ? [{
            _id: new mongoose.Types.ObjectId(),
            user: users[(carparkIndex + reviewIndex + 3) % users.length]._id,
            comment: REPLY_COMMENTS[sequence % REPLY_COMMENTS.length],
            createdAt: new Date(updatedAt.getTime() + 45 * 60 * 1000),
            updatedAt: new Date(updatedAt.getTime() + 45 * 60 * 1000),
          }]
        : []

      return {
        _id: new mongoose.Types.ObjectId(),
        user: user._id,
        carparkId: carpark.id,
        isDemo: true,
        overallRating: overallRatings[reviewIndex],
        lotSpaciousness: Math.max(1, base.lotSpaciousness - (reviewIndex % 5 === 0 ? 1 : 0)),
        entranceExitAccessibility: Math.max(1, base.entranceExitAccessibility - (reviewIndex % 4 === 0 ? 1 : 0)),
        signage: Math.max(1, Math.min(5, overallRatings[reviewIndex] + (reviewIndex % 3 === 0 ? -1 : 0))),
        pricing: pricingRatings[reviewIndex],
        parkingDifficulty,
        helpfulBy,
        comment,
        replies,
        createdAt,
        updatedAt: replies[0]?.updatedAt || updatedAt,
      }
    })
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
  if (carparks.length !== DEMO_CARPARKS.length) throw new Error('Not all demo carparks were returned by LTA DataMall.')

  const removed = await clearDemoData()
  const users = await seedUsers()
  const documents = buildReviewDocuments(users, carparks)
  await Review.collection.insertMany(documents)

  console.log(`Refreshed demo data (removed ${removed.reviews} reviews and ${removed.users} users).`)
  console.log(`Created ${users.length} users and ${documents.length} reviews across ${carparks.length} demo carparks, including areas near ${SMU_CONNEXION.name} and ${BEDOK_MALL.name}.`)
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
