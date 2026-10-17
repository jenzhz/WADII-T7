import 'dotenv/config'
import app from './app.js'

app.listen(3000, () => {
  console.log('Search test server: http://localhost:3000')
})