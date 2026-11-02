// Shared event details and labels; missing values display TBA.
export const eventInfo = {
  date: '11/21/2026',
  location: 'Rubulad',
  city: 'Brooklyn, NYC',
  addressNote: 'DM FOR ADDRESS!!',
  lineup: [
    'REAL LIFE KNIFE ATTACK',
    'Klovis Gaynor & The Urinal Cakes',
    'pia ella',
    'Spray Bottle Fever',
  ],
  featuring: 'DJ Durtystuf',
  menu: { date: '11/21', location: 'RUBULAD' },
  doors: '7 PM',
  music: '8 PM',
  ticketsUrl: null,
};

export const eventFields = [
  { key: 'date', label: 'DATE' },
  { key: 'location', label: 'LOCATION' },
  { key: 'doors', label: 'DOORS' },
  { key: 'music', label: 'MUSIC' },
];

export function formatEventValue(value) {
  return value == null || String(value).trim() === '' ? 'TBA' : String(value);
}

export function formatMenuValue(info, key) {
  return formatEventValue(info.menu?.[key] ?? info[key]);
}

export function getEventValue(info, key) {
  return formatEventValue(key === 'location'
    ? [info.location, info.city, info.addressNote].filter(Boolean).join('\n')
    : info[key]);
}

export function getEventDetails(info) {
  const rows = eventFields.map(field => ({ ...field, value: getEventValue(info, field.key) }));
  const lineup = (info.lineup ?? []).filter(Boolean);
  if (info.featuring) lineup.push(`(featuring ${info.featuring})`);
  if (lineup.length) {
    rows.splice(2, 0, { key: 'lineup', label: 'LINEUP', value: lineup.join('\n'), stacked: true });
  }
  return rows;
}
