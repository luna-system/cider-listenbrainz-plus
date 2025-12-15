/**
 * Plugin configuration.
 */
export default {
    /**
     * Custom element prefix, must be unique
     */
    ce_prefix: 'listenbrainz-plus',
    identifier: 'de.airsi.listenbrainz-plus',
    name: 'ListenBrainz Plus',
    description: 'Scrobble plays from Cider to ListenBrainz.',
    version: '1.0.0',
    author: 'airsi',
    repo: 'https://github.com/airsi/cider-listenbrainz-plus-plugin',
    entry: {
        'plugin.js': {
            type: 'main',
        }
    }
}