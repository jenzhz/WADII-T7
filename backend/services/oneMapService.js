/**
 * Future adapter for OneMap search, coordinates, and routing requests.
 * Authentication and API calls are intentionally not implemented.
 */

import axios from 'axios'

export async function searchLocation(destination) {
  const url = 'https://www.onemap.gov.sg/api/common/elastic/search'

  const response = await axios.get(url, {
    params : {
      searchVal : destination,
      returnGeom : 'Y',
      getAddrDetails : 'Y',
      pageNum :1
    },


    headers: {
      Authorization: process.env.ONEMAP_TOKEN
    }
  })
  return response.data
}

export async function getWalkingRoute() {
  throw new Error('OneMap walking routes are not implemented yet.')
}

