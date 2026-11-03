// Shared event details and labels; missing values display TBA.
export const eventInfo = {
  date: '11/21/2026',
  location: 'Rubulad',
  city: 'Brooklyn, NYC',
  addressNote: 'DM FOR ADDRESS!!',
  contactUrl: 'https://linktr.ee/reallifeknifeattack',
  lineup: [
    'REAL LIFE KNIFE ATTACK',
    'Klovis Gaynor & The Urinal Cakes',
    'pia ella',
    'Spray Bottle Fever',
  ],
  featuring: 'DJ Durtystuf',
  menu: { location: 'RUBULAD' },
  entry: '$15',
  doors: '7 PM',
  music: '8 PM',
  ticketsUrl: null,
};

export const eventFields = [
  { key: 'timestamp', label: 'TIMESTAMP' },
  { key: 'location', label: 'LOCATION' },
  { key: 'entry', label: 'ENTRY' },
  { key: 'music', label: 'MUSIC' },
];

export function formatEventValue(value) {
  return value == null || String(value).trim() === '' ? 'TBA' : String(value);
}

export function formatMenuValue(info, key) {
  if (key === 'timestamp') {
    const date = formatEventValue(info.date).replace(/\/\d{4}$/, '');
    const doors = formatEventValue(info.doors).replace(/\s+/g, '');
    return `${date} ${doors}`;
  }
  return formatEventValue(info.menu?.[key] ?? info[key]);
}

export function getEventValue(info, key) {
  if (key === 'timestamp') return `${formatEventValue(info.date)} / DOORS ${formatEventValue(info.doors)}`;
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
