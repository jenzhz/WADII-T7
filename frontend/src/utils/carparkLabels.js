const CARPARK_TYPE_LABELS = {
  HDB: 'HDB carpark',
  LTA: 'Mall',
  URA: 'Public carpark',
}

export function carparkTypeLabel(agency) {
  return CARPARK_TYPE_LABELS[agency] || 'Carpark'
}
