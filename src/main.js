// Mount the interactive poster and release its renderer on page teardown.
import { mountPoster } from './components/poster.js';

const poster = mountPoster();

window.addEventListener('pagehide', (event) => {
  if (!event.persisted) poster.dispose();
});
