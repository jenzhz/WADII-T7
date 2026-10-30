import api from './api'

export async function getMyReviews() {
  const response = await api.get('/reviews/mine')
  return response.data.reviews
}

export async function getUserReviews(userId) {
  const response = await api.get(`/reviews/user/${encodeURIComponent(userId)}`)
  return response.data
}

export async function getCommunitySummaries(carparkIds = []) {
  const params = carparkIds.length ? { carparkIds: carparkIds.slice(0, 500).join(',') } : {}
  const { data } = await api.get('/reviews/community', { params })
  return data
}

export async function getCarparkReviews(carparkId) {
  const { data } = await api.get(`/reviews/carpark/${encodeURIComponent(carparkId)}`)
  return data
}

export async function createReview(payload) {
  const { data } = await api.post('/reviews', payload)
  return data.review
}

export async function updateReview(reviewId, payload) {
  const { data } = await api.put(`/reviews/${reviewId}`, payload)
  return data.review
}

export async function deleteReview(reviewId) {
  await api.delete(`/reviews/${reviewId}`)
}

export async function createReply(reviewId, comment) {
  const { data } = await api.post(`/reviews/${reviewId}/replies`, { comment })
  return data.reply
}

export async function updateReply(reviewId, replyId, comment) {
  const { data } = await api.put(`/reviews/${reviewId}/replies/${replyId}`, { comment })
  return data.reply
}

export async function deleteReply(reviewId, replyId) {
  await api.delete(`/reviews/${reviewId}/replies/${replyId}`)
}
