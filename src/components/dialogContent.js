// Shared content for the native dialog and its processed canvas picture.
import { artistLinks } from '../config/artistLinks.js';
import { getEventDetails } from '../config/event.js';

export function getDialogContent(info, mode = 'event') {
  if (mode === 'links') return {
    heading: 'RLKA / ARTIST LINKS',
    bodyLabel: 'Artist music links; links open in a new tab',
    rows: artistLinks.map(artist => ({
      key: artist.id, label: artist.name,
      value: [artist.platform, artist.release].filter(Boolean).join(' / '),
      href: artist.url,
    })),
  };
  return {
    heading: 'RLKA / EVENT INFORMATION',
    bodyLabel: 'Event details; use arrow keys to scroll when needed',
    rows: getEventDetails(info),
  };
}
