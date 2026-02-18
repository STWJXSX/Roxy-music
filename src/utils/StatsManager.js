const fs = require('fs');
const path = require('path');

const STATS_FILE = path.join(__dirname, '..', '..', 'data', 'stats.json');

// Default stats structure
const DEFAULT_STATS = {
    songsPlayed: 0,
    lastUpdated: new Date().toISOString()
};

/**
 * Load stats from file (always reads fresh from disk)
 */
function loadStatsFromDisk() {
    try {
        if (fs.existsSync(STATS_FILE)) {
            // Clear require cache to get fresh data
            const data = fs.readFileSync(STATS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error('[STATS] Error loading stats:', e.message);
    }
    return { ...DEFAULT_STATS };
}

/**
 * Save stats to file
 */
function saveStats(stats) {
    try {
        stats.lastUpdated = new Date().toISOString();
        fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 4), 'utf8');
    } catch (e) {
        console.error('[STATS] Error saving stats:', e.message);
    }
}

/**
 * Stats Manager - Always reads fresh from disk for accurate real-time data
 */
const StatsManager = {
    /**
     * Get current stats (reads fresh from disk)
     */
    getStats() {
        return loadStatsFromDisk();
    },

    /**
     * Get songs played count (reads fresh from disk)
     */
    getSongsPlayed() {
        const stats = loadStatsFromDisk();
        return stats.songsPlayed || 0;
    },

    /**
     * Increment songs played counter
     * @param {number} count - Number of songs to add (default 1)
     */
    incrementSongsPlayed(count = 1) {
        const stats = loadStatsFromDisk();
        stats.songsPlayed = (stats.songsPlayed || 0) + count;
        saveStats(stats);
        return stats.songsPlayed;
    },

    /**
     * Reload stats from file (legacy - now always reads fresh)
     */
    reload() {
        return loadStatsFromDisk();
    }
};

module.exports = StatsManager;
