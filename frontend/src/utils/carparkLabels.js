// User-friendly names for the LTA DataMall "Agency" field.
// The data still uses HDB / LTA / URA; only the text shown to users changes.
// LTA here means the data comes from LTA DataMall: mostly malls and commercial buildings.
const CARPARK_TYPE_LABELS = {
  HDB: 'HDB carpark',
  LTA: 'Mall',
  URA: 'Public carpark',
}

export function carparkTypeLabel(agency) {
  return CARPARK_TYPE_LABELS[agency] || 'Carpark'
}
