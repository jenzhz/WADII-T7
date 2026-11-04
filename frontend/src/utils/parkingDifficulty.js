export const PARKING_DIFFICULTIES = [
  {
    value: 'beginner-friendly',
    label: 'Beginner Friendly',
    description: 'Spacious lots and straightforward access.',
  },
  {
    value: 'moderate',
    label: 'Moderate',
    description: 'Some tighter turns or extra care may be needed.',
  },
  {
    value: 'challenging',
    label: 'Challenging',
    description: 'Tight spaces, ramps, or complex access.',
  },
]

export function parkingDifficultyDetails(value) {
  return PARKING_DIFFICULTIES.find(option => option.value === value) || null
}
