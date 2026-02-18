const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    VoiceConnectionStatus,
    entersState,
    NoSubscriberBehavior,
    StreamType,
} = require('@discordjs/voice');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const play = require('play-dl');
const { spawn } = require('child_process');
const path = require('path');
const { Logger, StatsManager } = require('../utils');
const config = require('../config');

// Path to yt-dlp executable
// Windows: uses local yt-dlp.exe in music folder
// Linux/Debian/Ubuntu: uses system yt-dlp (install with: apt update && apt install yt-dlp -y)
const YTDLP_PATH = config.isWindows 
    ? path.join(__dirname, '..', '..', 'yt-dlp.exe')
    : 'yt-dlp';

/**
 * Queue item structure
 */
class Track {
    constructor(data) {
        this.title = data.title || 'Unknown';
        this.url = data.url;
        this.duration = data.duration || 0;
        this.durationMS = (data.duration || 0) * 1000;
        this.durationFormatted = data.durationFormatted || '0:00';
        this.thumbnail = data.thumbnail || null;
        this.requestedBy = data.requestedBy || null;
        this.source = data.source || 'youtube';
    }
}

/**
 * Guild Queue Manager
 */
class GuildQueue {
    constructor(guildId, voiceChannel, textChannel) {
        this.guildId = guildId;
        this.voiceChannel = voiceChannel;
        this.textChannel = textChannel;
        this.tracks = [];
        this.currentTrack = null;
        this.connection = null;
        this.player = null;
        this.volume = config.player.defaultVolume / 100;
        this.loop = 0; // 0: off, 1: track, 2: queue
        this.playing = false;
        this.paused = false;
        this.is247 = false; // 24/7 mode - stay in channel
        this.emptyTimeout = null; // Timeout for leaving when channel is empty
        this.pausedByMute = false; // If paused due to server mute
    }

    isPlaying() {
        return this.playing && !this.paused;
    }
}

/**
 * Music Player Manager
 * Uses @discordjs/voice directly with play-dl
 */
class MusicPlayer {
    constructor(client) {
        this.client = client;
        this.queues = new Map();
    }

    /**
     * Initialize the music player
     */
    async initialize() {
        Logger.info('Initializing music player with play-dl...');
        
        // Set play-dl authorization if available
        if (process.env.YOUTUBE_COOKIE) {
            try {
                await play.setToken({
                    youtube: {
                        cookie: process.env.YOUTUBE_COOKIE
                    }
                });
                Logger.success('YouTube cookie set for play-dl');
            } catch (e) {
                Logger.warn('Failed to set YouTube cookie: ' + e.message);
            }
        }
        
        // Set Spotify credentials if available
        if (process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
            try {
                const clientId = process.env.SPOTIFY_CLIENT_ID.replace(/"/g, '');
                const clientSecret = process.env.SPOTIFY_CLIENT_SECRET.replace(/"/g, '');
                
                // Get Spotify access token
                const authResponse = await fetch('https://accounts.spotify.com/api/token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64')
                    },
                    body: 'grant_type=client_credentials'
                });
                
                if (authResponse.ok) {
                    const authData = await authResponse.json();
                    this.spotifyToken = authData.access_token;
                    this.spotifyTokenExpires = Date.now() + (authData.expires_in * 1000) - 60000; // 1 min buffer
                    Logger.success('Spotify access token obtained');
                } else {
                    Logger.warn('Failed to get Spotify token: ' + authResponse.status);
                }
            } catch (e) {
                Logger.warn('Failed to set Spotify credentials: ' + e.message);
            }
        }

        this.client.player = this;
        Logger.success('Music player initialized with play-dl + @discordjs/voice');
        return this;
    }
    
    /**
     * Refresh Spotify token if needed
     */
    async refreshSpotifyToken() {
        if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) return null;
        
        if (this.spotifyToken && Date.now() < this.spotifyTokenExpires) {
            return this.spotifyToken;
        }
        
        try {
            const clientId = process.env.SPOTIFY_CLIENT_ID.replace(/"/g, '');
            const clientSecret = process.env.SPOTIFY_CLIENT_SECRET.replace(/"/g, '');
            
            const authResponse = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64')
                },
                body: 'grant_type=client_credentials'
            });
            
            if (authResponse.ok) {
                const authData = await authResponse.json();
                this.spotifyToken = authData.access_token;
                this.spotifyTokenExpires = Date.now() + (authData.expires_in * 1000) - 60000;
                return this.spotifyToken;
            }
        } catch (e) {
            Logger.error('Failed to refresh Spotify token: ' + e.message);
        }
        return null;
    }
    
    /**
     * Get tracks from Spotify URL using direct API
     */
    async getSpotifyTracks(url, requestedBy) {
        const token = await this.refreshSpotifyToken();
        if (!token) {
            Logger.warn('No Spotify token available');
            return null;
        }
        
        try {
            // Extract Spotify ID and type from URL - handles intl-XX/ prefix
            const match = url.match(/spotify\.com\/(?:intl-[a-z]{2}\/)?(track|album|playlist)\/([a-zA-Z0-9]+)/);
            if (!match) {
                Logger.warn(`[SPOTIFY] Could not parse URL: ${url}`);
                return null;
            }
            
            const [, type, id] = match;
            Logger.info(`[SPOTIFY] Fetching ${type}: ${id}`);
            
            let tracks = [];
            let playlistName = null;
            let playlistAuthor = null;
            let playlistThumbnail = null;
            
            if (type === 'track') {
                const response = await fetch(`https://api.spotify.com/v1/tracks/${id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) throw new Error(`Spotify API error: ${response.status}`);
                const track = await response.json();
                tracks = [{
                    name: track.name,
                    artist: track.artists[0]?.name || 'Unknown',
                    duration_ms: track.duration_ms
                }];
            } else if (type === 'album') {
                const response = await fetch(`https://api.spotify.com/v1/albums/${id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) throw new Error(`Spotify API error: ${response.status}`);
                const album = await response.json();
                playlistName = album.name;
                playlistAuthor = album.artists?.[0]?.name || 'Unknown Artist';
                playlistThumbnail = album.images?.[0]?.url || null;
                tracks = album.tracks.items.map(t => ({
                    name: t.name,
                    artist: t.artists[0]?.name || 'Unknown',
                    duration_ms: t.duration_ms
                }));
            } else if (type === 'playlist') {
                const response = await fetch(`https://api.spotify.com/v1/playlists/${id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) throw new Error(`Spotify API error: ${response.status}`);
                const playlist = await response.json();
                playlistName = playlist.name;
                playlistAuthor = playlist.owner?.display_name || 'Unknown';
                playlistThumbnail = playlist.images?.[0]?.url || null;
                tracks = playlist.tracks.items
                    .filter(item => item.track)
                    .map(item => ({
                        name: item.track.name,
                        artist: item.track.artists[0]?.name || 'Unknown',
                        duration_ms: item.track.duration_ms
                    }));
            }
            
            Logger.info(`[SPOTIFY] Got ${tracks.length} tracks from ${type}`);
            return { tracks, playlistName, playlistAuthor, playlistThumbnail, type };
        } catch (e) {
            Logger.error(`[SPOTIFY] API error: ${e.message}`);
            return null;
        }
    }
    
    /**
     * Search YouTube for a single Spotify track (used for parallel loading)
     */
    async searchYouTubeForSpotifyTrack(track, requestedBy) {
        const searchQuery = `${track.artist} ${track.name}`;
        try {
            const searched = await play.search(searchQuery, { limit: 1, source: { youtube: 'video' } });
            if (searched.length > 0) {
                return new Track({
                    title: `${track.artist} - ${track.name}`,
                    url: searched[0].url,
                    duration: searched[0].durationInSec,
                    durationFormatted: searched[0].durationRaw,
                    thumbnail: searched[0].thumbnails[0]?.url,
                    requestedBy,
                    source: 'spotify'
                });
            }
        } catch (e) {
            Logger.warn(`[SEARCH] Failed to find YouTube match for: ${searchQuery}`);
        }
        return null;
    }
    
    /**
     * Search YouTube for multiple tracks in parallel (batches of 3)
     */
    async searchYouTubeParallel(tracks, requestedBy, batchSize = 3) {
        const results = [];
        for (let i = 0; i < tracks.length; i += batchSize) {
            const batch = tracks.slice(i, i + batchSize);
            const batchResults = await Promise.all(
                batch.map(track => this.searchYouTubeForSpotifyTrack(track, requestedBy))
            );
            results.push(...batchResults.filter(r => r !== null));
        }
        return results;
    }

    /**
     * Get or create queue for a guild
     */
    getQueue(guildId) {
        const queue = this.queues.get(guildId) || null;
        if (queue) {
            Logger.debug(`[QUEUE] Get queue for ${guildId}: tracks=${queue.tracks.length}, playing=${queue.playing}, paused=${queue.paused}`);
        }
        return queue;
    }

    /**
     * Create a new queue for a guild
     */
    createQueue(guildId, voiceChannel, textChannel) {
        Logger.info(`[QUEUE] Creating new queue for guild ${guildId}`);
        Logger.info(`[QUEUE] Voice channel: ${voiceChannel.name} (${voiceChannel.id})`);
        Logger.info(`[QUEUE] Text channel: ${textChannel.name} (${textChannel.id})`);
        const queue = new GuildQueue(guildId, voiceChannel, textChannel);
        this.queues.set(guildId, queue);
        Logger.info(`[QUEUE] Total active queues: ${this.queues.size}`);
        return queue;
    }

    /**
     * Delete queue for a guild
     */
    deleteQueue(guildId) {
        Logger.info(`[QUEUE] Deleting queue for guild ${guildId}`);
        const queue = this.queues.get(guildId);
        if (queue) {
            if (queue.ffmpeg) {
                try {
                    queue.ffmpeg.kill('SIGKILL');
                    Logger.info(`[QUEUE] Killed FFmpeg process`);
                } catch (e) {}
            }
            if (queue.player) {
                queue.player.stop();
                Logger.info(`[QUEUE] Stopped player`);
            }
            if (queue.connection) {
                queue.connection.destroy();
                Logger.info(`[QUEUE] Destroyed connection`);
            }
            this.queues.delete(guildId);
            Logger.info(`[QUEUE] Queue deleted. Total active queues: ${this.queues.size}`);
        } else {
            Logger.warn(`[QUEUE] No queue found to delete for guild ${guildId}`);
        }
    }
    
    /**
     * Send goodbye message when bot leaves
     */
    sendGoodbyeMessage(queue) {
        if (!queue || !queue.textChannel) return;
        
        const embed = new EmbedBuilder()
            .setColor('#FF6B9D')
            .setTitle('👋 See you later!')
            .setDescription([
                '**Queue ended - leaving the voice channel.**',
                '',
                'Thanks for using **Roxy**! 🎵',
                '',
                '> *If you enjoyed the music, consider checking out our links below!*'
            ].join('\n'))
            .setThumbnail(this.client?.user?.displayAvatarURL({ size: 128 }) || null)
            .setFooter({ text: 'Roxy Music Bot • Powered by love ❤️' })
            .setTimestamp();
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('Marketplace')
                    .setStyle(ButtonStyle.Link)
                    .setURL('https://discord.gg/Zp5tcnsbs3')
                    .setEmoji('🏪'),
                new ButtonBuilder()
                    .setLabel('Official Server')
                    .setStyle(ButtonStyle.Link)
                    .setURL('https://discord.gg/u4yDzZ7GZF')
                    .setEmoji('🏠'),
                new ButtonBuilder()
                    .setLabel('Premium Info')
                    .setStyle(ButtonStyle.Link)
                    .setURL('https://discord.com/channels/810129117260283915/1451337495680782367')
                    .setEmoji('👑')
            );
        
        queue.textChannel.send({ embeds: [embed], components: [row] }).catch(() => {});
    }
    
    /**
     * Send goodbye message when channel is empty
     */
    sendEmptyChannelGoodbye(queue) {
        if (!queue || !queue.textChannel) return;
        
        const embed = new EmbedBuilder()
            .setColor('#FF6B9D')
            .setTitle('👋 Channel Empty')
            .setDescription([
                '**Everyone left the voice channel - leaving too.**',
                '',
                'Thanks for using **Roxy**! 🎵',
                '',
                '> *If you enjoyed the music, consider checking out our links below!*'
            ].join('\n'))
            .setThumbnail(this.client?.user?.displayAvatarURL({ size: 128 }) || null)
            .setFooter({ text: 'Roxy Music Bot • Powered by love ❤️' })
            .setTimestamp();
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('Marketplace')
                    .setStyle(ButtonStyle.Link)
                    .setURL('https://discord.gg/Zp5tcnsbs3')
                    .setEmoji('🏪'),
                new ButtonBuilder()
                    .setLabel('Official Server')
                    .setStyle(ButtonStyle.Link)
                    .setURL('https://discord.gg/u4yDzZ7GZF')
                    .setEmoji('🏠'),
                new ButtonBuilder()
                    .setLabel('Premium Info')
                    .setStyle(ButtonStyle.Link)
                    .setURL('https://discord.com/channels/810129117260283915/1451337495680782367')
                    .setEmoji('👑')
            );
        
        queue.textChannel.send({ embeds: [embed], components: [row] }).catch(() => {});
    }

    /**
     * Search for tracks
     */
    async search(query, requestedBy) {
        try {
            let results = [];
            
            Logger.info(`[SEARCH] Searching for: ${query}`);

            // Check if it's a Spotify URL using regex (more reliable)
            const isSpotifyUrl = query.includes('spotify.com/') || query.includes('open.spotify');
            Logger.info(`[SEARCH] Is Spotify URL: ${isSpotifyUrl}`);
            
            if (isSpotifyUrl) {
                Logger.info('[SEARCH] Processing Spotify URL with direct API...');
                const spotifyData = await this.getSpotifyTracks(query, requestedBy);
                
                if (spotifyData && spotifyData.tracks.length > 0) {
                    Logger.info(`[SEARCH] Got ${spotifyData.tracks.length} Spotify tracks`);
                    
                    // For single tracks, search immediately
                    if (spotifyData.type === 'track') {
                        const track = spotifyData.tracks[0];
                        const result = await this.searchYouTubeForSpotifyTrack(track, requestedBy);
                        if (result) {
                            return {
                                hasTracks: () => true,
                                tracks: [result],
                                playlist: null,
                                spotifyData: null
                            };
                        }
                    } else {
                        // For playlists/albums, only search the first track now
                        // The rest will be loaded in background
                        const firstTrack = spotifyData.tracks[0];
                        const firstResult = await this.searchYouTubeForSpotifyTrack(firstTrack, requestedBy);
                        
                        if (firstResult) {
                            return {
                                hasTracks: () => true,
                                tracks: [firstResult],
                                playlist: { 
                                    name: spotifyData.playlistName || 'Spotify Playlist',
                                    author: spotifyData.playlistAuthor || 'Unknown',
                                    thumbnail: spotifyData.playlistThumbnail,
                                    totalTracks: spotifyData.tracks.length
                                },
                                // Pass remaining tracks to load in background
                                spotifyData: {
                                    remainingTracks: spotifyData.tracks.slice(1),
                                    playlistName: spotifyData.playlistName,
                                    playlistAuthor: spotifyData.playlistAuthor,
                                    playlistThumbnail: spotifyData.playlistThumbnail,
                                    type: spotifyData.type
                                }
                            };
                        }
                    }
                }
                
                Logger.warn('[SEARCH] Spotify API failed, will search YouTube as fallback');
            }

            // Check if it's a YouTube URL
            const validateResult = play.yt_validate(query);
            Logger.info(`[SEARCH] YouTube validation: ${validateResult}`);
            
            if (validateResult === 'video') {
                Logger.info('Fetching video info...');
                const info = await play.video_info(query);
                Logger.info(`Got video: ${info.video_details.title}`);
                results = [{
                    title: info.video_details.title,
                    url: info.video_details.url,
                    duration: info.video_details.durationInSec,
                    durationFormatted: info.video_details.durationRaw,
                    thumbnail: info.video_details.thumbnails[0]?.url,
                    requestedBy,
                    source: 'youtube'
                }];
            } else if (validateResult === 'playlist') {
                Logger.info('Fetching playlist info...');
                const playlist = await play.playlist_info(query, { incomplete: true });
                const firstPage = playlist.page(1);
                const firstVideo = firstPage[0];
                
                if (firstVideo) {
                    results = [{
                        title: firstVideo.title,
                        url: firstVideo.url,
                        duration: firstVideo.durationInSec,
                        durationFormatted: firstVideo.durationRaw,
                        thumbnail: firstVideo.thumbnails?.[0]?.url,
                        requestedBy,
                        source: 'youtube'
                    }];
                }
                
                // Return playlist object for background loading
                return {
                    hasTracks: () => results.length > 0,
                    tracks: results.map(r => new Track(r)),
                    playlist: { 
                        title: playlist.title || 'YouTube Playlist',
                        name: playlist.title || 'YouTube Playlist',
                        url: playlist.url || query,
                        totalTracks: playlist.total_videos || playlist.videoCount || '?',
                        author: playlist.channel?.name || 'Unknown',
                        thumbnail: playlist.thumbnail?.url || firstVideo?.thumbnails?.[0]?.url,
                        tracks: results 
                    },
                    spotifyData: null,
                    youtubePlaylist: playlist
                };
            } else {
                // Search YouTube
                Logger.info('Searching YouTube...');
                const searched = await play.search(query, { limit: 5, source: { youtube: 'video' } });
                Logger.info(`Found ${searched.length} results`);
                results = searched.map(v => ({
                    title: v.title,
                    url: v.url,
                    duration: v.durationInSec,
                    durationFormatted: v.durationRaw,
                    thumbnail: v.thumbnails[0]?.url,
                    requestedBy,
                    source: 'youtube'
                }));
            }

            Logger.info(`Returning ${results.length} tracks`);
            return {
                hasTracks: () => results.length > 0,
                tracks: results.map(r => new Track(r)),
                playlist: validateResult === 'playlist' ? { name: 'Playlist', tracks: results } : null,
                spotifyData: null
            };
        } catch (error) {
            Logger.error('Search error: ' + error.message);
            Logger.error(error.stack);
            return { hasTracks: () => false, tracks: [], playlist: null, spotifyData: null };
        }
    }

    /**
     * Play a track
     */
    async play(voiceChannel, query, requestedBy, textChannel) {
        const guildId = voiceChannel.guild.id;
        
        Logger.info(`[PLAY] Called for guild ${guildId}`);
        Logger.info(`[PLAY] Query: "${query}"`);
        Logger.info(`[PLAY] Requested by: ${requestedBy.username} (${requestedBy.id})`);
        
        // Search for the track
        const searchResult = await this.search(query, requestedBy);
        
        Logger.info(`[PLAY] Search result hasTracks: ${searchResult.hasTracks()}`);
        Logger.info(`[PLAY] Search result isPlaylist: ${searchResult.playlist !== null}`);
        Logger.info(`[PLAY] Search result tracks count: ${searchResult.tracks.length}`);
        
        if (!searchResult.hasTracks()) {
            Logger.warn('[PLAY] No tracks found in search result');
            return { success: false, error: 'No tracks found' };
        }

        // Get or create queue
        let queue = this.getQueue(guildId);
        const isNewQueue = !queue;
        
        Logger.info(`[QUEUE] Queue exists: ${!isNewQueue}`);
        
        if (!queue) {
            queue = this.createQueue(guildId, voiceChannel, textChannel);
            Logger.info(`[QUEUE] Created new queue for guild ${guildId}`);
        }

        // For playlists, add first track immediately, rest will load in background
        const isPlaylist = searchResult.playlist !== null;
        const firstTrack = searchResult.tracks[0];
        
        Logger.info(`[QUEUE] Before adding - Queue length: ${queue.tracks.length}`);
        Logger.info(`[QUEUE] Adding first track to queue`);
        
        queue.tracks.push(firstTrack);
        
        // Increment for first track
        StatsManager.incrementSongsPlayed(1);
        
        Logger.info(`[QUEUE] After adding - Queue length: ${queue.tracks.length}`);
        Logger.info(`[QUEUE] Current track: ${queue.currentTrack?.title || 'None'}`);

        // If this is a new queue or not playing, start playback
        if (isNewQueue || !queue.playing) {
            try {
                Logger.info('Starting playback...');
                await this.connectAndPlay(queue);
            } catch (error) {
                Logger.error(`Connect/Play error: ${error.message}`);
                this.deleteQueue(guildId);
                return { success: false, error: error.message };
            }
        }

        // If it's a Spotify playlist/album, load remaining tracks in background
        if (searchResult.spotifyData && searchResult.spotifyData.remainingTracks.length > 0) {
            this.loadSpotifyTracksInBackground(
                guildId,
                searchResult.spotifyData.remainingTracks,
                requestedBy,
                textChannel,
                searchResult.spotifyData
            );
        }
        
        // If it's a YouTube playlist, load remaining tracks in background
        if (searchResult.youtubePlaylist) {
            this.loadYouTubePlaylistInBackground(
                guildId,
                searchResult.youtubePlaylist,
                requestedBy,
                textChannel
            );
        }

        Logger.info('[PLAY] Returning success');
        Logger.info(`[PLAY] Track added: ${firstTrack.title}`);
        return {
            success: true,
            track: firstTrack,
            searchResult: searchResult,
            isPlaylist: isPlaylist,
            playlist: searchResult.playlist
        };
    }
    
    /**
     * Load Spotify tracks in background (3 at a time, progress messages every 50)
     */
    async loadSpotifyTracksInBackground(guildId, tracks, requestedBy, textChannel, spotifyData) {
        const BATCH_SIZE = 3;
        const PROGRESS_INTERVAL = 50;
        let loadedCount = 0;
        let failedCount = 0;
        
        Logger.info(`[SPOTIFY BG] Starting background load of ${tracks.length} tracks for guild ${guildId}`);
        
        for (let i = 0; i < tracks.length; i += BATCH_SIZE) {
            // Check if queue still exists
            const queue = this.getQueue(guildId);
            if (!queue) {
                Logger.info(`[SPOTIFY BG] Queue deleted, stopping background load`);
                return;
            }
            
            const batch = tracks.slice(i, i + BATCH_SIZE);
            const batchResults = await Promise.all(
                batch.map(track => this.searchYouTubeForSpotifyTrack(track, requestedBy))
            );
            
            // Add successful results to queue
            for (const result of batchResults) {
                if (result) {
                    const currentQueue = this.getQueue(guildId);
                    if (currentQueue) {
                        currentQueue.tracks.push(result);
                        loadedCount++;
                        StatsManager.incrementSongsPlayed(1);
                    }
                } else {
                    failedCount++;
                }
            }
            
            // Send progress message every 50 tracks
            if (loadedCount > 0 && loadedCount % PROGRESS_INTERVAL === 0 && textChannel) {
                const embed = new EmbedBuilder()
                    .setColor('#00CED1')
                    .setDescription(`🔄 **Loading playlist...** ${loadedCount}/${tracks.length + 1} tracks loaded`)
                    .setFooter({ text: `${spotifyData.playlistName || 'Spotify Playlist'}` });
                
                textChannel.send({ embeds: [embed] }).catch(() => {});
            }
        }
        
        // Final message when all tracks are loaded
        if (textChannel && loadedCount > 0) {
            const embed = new EmbedBuilder()
                .setColor('#1DB954')
                .setTitle('✅ Playlist Loaded')
                .setDescription(`**${spotifyData.playlistName || 'Spotify Playlist'}**`)
                .addFields(
                    { name: 'Tracks', value: `${loadedCount + 1}`, inline: true },
                    { name: 'Author', value: spotifyData.playlistAuthor || 'Unknown', inline: true }
                )
                .setFooter({ text: `Requested by ${requestedBy.username}` })
                .setTimestamp();
            
            if (spotifyData.playlistThumbnail) {
                embed.setThumbnail(spotifyData.playlistThumbnail);
            }
            
            if (failedCount > 0) {
                embed.addFields({ name: 'Failed', value: `${failedCount} tracks not found`, inline: true });
            }
            
            textChannel.send({ embeds: [embed] }).catch(() => {});
        }
        
        Logger.info(`[SPOTIFY BG] Finished loading. Loaded: ${loadedCount}, Failed: ${failedCount}`);
    }
    
    /**
     * Load YouTube playlist tracks in background (very lightweight - uses cached playlist data)
     */
    async loadYouTubePlaylistInBackground(guildId, playlist, requestedBy, textChannel) {
        Logger.info(`[YT BG] Starting background load for YouTube playlist`);
        
        let loadedCount = 0;
        
        try {
            // Get all videos from playlist (play-dl caches this)
            const videos = await playlist.all_videos();
            const totalVideos = videos.length;
            
            Logger.info(`[YT BG] Got ${totalVideos} videos from playlist`);
            
            // Skip first video (already added)
            for (let i = 1; i < videos.length; i++) {
                const queue = this.getQueue(guildId);
                if (!queue) {
                    Logger.info(`[YT BG] Queue deleted, stopping background load`);
                    return;
                }
                
                const v = videos[i];
                if (!v || !v.url) continue;
                
                queue.tracks.push(new Track({
                    title: v.title,
                    url: v.url,
                    duration: v.durationInSec,
                    durationFormatted: v.durationRaw,
                    thumbnail: v.thumbnails?.[0]?.url,
                    requestedBy,
                    source: 'youtube'
                }));
                loadedCount++;
                StatsManager.incrementSongsPlayed(1);
                
                // Send progress every 50 tracks
                if (loadedCount % 50 === 0 && textChannel) {
                    const embed = new EmbedBuilder()
                        .setColor('#FF0000')
                        .setDescription(`🔄 **Loading playlist...** ${loadedCount + 1}/${totalVideos} tracks loaded`)
                        .setFooter({ text: playlist.title || 'YouTube Playlist' });
                    textChannel.send({ embeds: [embed] }).catch(() => {});
                }
            }
            
            // Final message
            if (textChannel && loadedCount > 0) {
                const embed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('✅ Playlist Loaded')
                    .setDescription(`**${playlist.title || 'YouTube Playlist'}**`)
                    .addFields(
                        { name: 'Tracks', value: `${loadedCount + 1}`, inline: true },
                        { name: 'Author', value: playlist.channel?.name || 'Unknown', inline: true }
                    )
                    .setFooter({ text: `Requested by ${requestedBy.username}` })
                    .setTimestamp();
                
                if (playlist.thumbnail?.url) {
                    embed.setThumbnail(playlist.thumbnail.url);
                }
                
                textChannel.send({ embeds: [embed] }).catch(() => {});
            }
            
            Logger.info(`[YT BG] Finished loading. Loaded: ${loadedCount} tracks`);
        } catch (error) {
            Logger.error(`[YT BG] Error loading playlist: ${error.message}`);
        }
    }

    /**
     * Connect to voice channel and start playing
     */
    async connectAndPlay(queue) {
        // Create voice connection
        queue.connection = joinVoiceChannel({
            channelId: queue.voiceChannel.id,
            guildId: queue.guildId,
            adapterCreator: queue.voiceChannel.guild.voiceAdapterCreator,
            selfDeaf: true,
        });

        // Create audio player
        queue.player = createAudioPlayer({
            behaviors: {
                noSubscriber: NoSubscriberBehavior.Play,
            },
        });

        // Subscribe connection to player
        queue.connection.subscribe(queue.player);

        // Handle connection state changes
        queue.connection.on(VoiceConnectionStatus.Disconnected, async () => {
            try {
                await Promise.race([
                    entersState(queue.connection, VoiceConnectionStatus.Signalling, 5000),
                    entersState(queue.connection, VoiceConnectionStatus.Connecting, 5000),
                ]);
            } catch {
                this.deleteQueue(queue.guildId);
            }
        });

        queue.connection.on(VoiceConnectionStatus.Destroyed, () => {
            this.queues.delete(queue.guildId);
        });

        // Handle player state changes
        queue.player.on(AudioPlayerStatus.Idle, () => {
            this.handleTrackEnd(queue);
        });

        queue.player.on('error', error => {
            Logger.error(`Player error: ${error.message}`);
            Logger.error(`Error stack: ${error.stack}`);
            if (error.resource) {
                Logger.error(`Resource playback duration: ${error.resource.playbackDuration}ms`);
            }
            this.handleTrackEnd(queue);
        });

        // Debug state changes
        queue.player.on('stateChange', (oldState, newState) => {
            Logger.info(`Player state changed: ${oldState.status} -> ${newState.status}`);
        });

        // Wait for connection to be ready
        try {
            await entersState(queue.connection, VoiceConnectionStatus.Ready, 30000);
            Logger.info(`Connected to voice channel in ${queue.voiceChannel.guild.name}`);
        } catch {
            this.deleteQueue(queue.guildId);
            throw new Error('Failed to connect to voice channel');
        }

        // Start playing
        await this.playNext(queue);
    }

    /**
     * Play the next track in queue
     */
    async playNext(queue) {
        // Prevent concurrent playNext calls
        if (queue._isPlaying) {
            Logger.info('Already playing, skipping playNext call');
            return;
        }
        queue._isPlaying = true;
        
        try {
            await this._doPlayNext(queue);
        } finally {
            queue._isPlaying = false;
        }
    }
    
    async _doPlayNext(queue) {
        if (queue.tracks.length === 0) {
            queue.playing = false;
            queue.currentTrack = null;
            
            // If 24/7 mode is enabled, stay in the channel
            if (queue.is247) {
                Logger.info('[24/7] Queue empty but 24/7 mode is enabled, staying in channel');
                return;
            }
            
            // Leave after timeout if configured
            if (config.player.leaveOnEnd) {
                // Send countdown message with Discord timestamp
                const leaveTime = Math.floor((Date.now() + config.player.leaveOnEndCooldown) / 1000);
                const countdownEmbed = new EmbedBuilder()
                    .setColor('#FFA500')
                    .setTitle('⏰ Queue Ended')
                    .setDescription([
                        '**The queue is empty!**',
                        '',
                        `I will leave <t:${leaveTime}:R> if no more songs are added.`,
                        '',
                        '> *Use `/play` to add more songs or `/247` to keep me here!*'
                    ].join('\n'))
                    .setTimestamp();
                
                if (queue.textChannel) {
                    queue.textChannel.send({ embeds: [countdownEmbed] }).catch(() => {});
                }
                
                setTimeout(() => {
                    const currentQueue = this.getQueue(queue.guildId);
                    // Check 24/7 mode again in case it was enabled during the timeout
                    if (currentQueue && !currentQueue.playing && !currentQueue.is247) {
                        this.sendGoodbyeMessage(currentQueue);
                        this.deleteQueue(queue.guildId);
                    }
                }, config.player.leaveOnEndCooldown);
            }
            return;
        }

        // Kill previous ffmpeg process if exists
        if (queue.ffmpeg) {
            try {
                queue.ffmpeg.kill('SIGKILL');
            } catch (e) {}
            queue.ffmpeg = null;
        }

        queue.currentTrack = queue.tracks.shift();
        queue.playing = true;
        queue.paused = false;

        try {
            Logger.info(`Getting stream for: ${queue.currentTrack.url}`);
            
            // Use yt-dlp to get audio URL, then stream via FFmpeg
            const ytdlp = spawn(YTDLP_PATH, [
                '-f', 'bestaudio/best',
                '-g',  // Get URL only, don't download
                '--no-warnings',
                '--no-playlist',
                '--no-check-certificates',
                queue.currentTrack.url
            ], {
                stdio: ['pipe', 'pipe', 'pipe']
            });
            
            let audioUrl = '';
            
            ytdlp.stdout.on('data', (data) => {
                audioUrl += data.toString().trim();
            });
            
            // Wait for yt-dlp to get the URL
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('yt-dlp timeout')), 15000);
                ytdlp.on('close', (code) => {
                    clearTimeout(timeout);
                    if (code === 0 && audioUrl) {
                        resolve();
                    } else {
                        reject(new Error('Failed to get audio URL'));
                    }
                });
                ytdlp.on('error', reject);
            });
            
            Logger.info(`Got audio URL, streaming via FFmpeg...`);
            
            // Now stream the URL through FFmpeg to get PCM audio
            const ffmpeg = spawn('ffmpeg', [
                '-reconnect', '1',
                '-reconnect_streamed', '1', 
                '-reconnect_delay_max', '3',
                '-i', audioUrl,
                '-analyzeduration', '0',
                '-loglevel', '0',
                '-f', 's16le',
                '-ar', '48000',
                '-ac', '2',
                'pipe:1'
            ], {
                stdio: ['pipe', 'pipe', 'pipe']
            });
            
            // Wait for FFmpeg to start producing data (max 5 seconds)
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('FFmpeg timeout')), 5000);
                
                const checkReadable = () => {
                    if (ffmpeg.stdout.readable && ffmpeg.stdout.readableLength > 0) {
                        clearTimeout(timeout);
                        resolve();
                    }
                };
                
                // Check if already readable
                checkReadable();
                
                ffmpeg.stdout.once('readable', () => {
                    clearTimeout(timeout);
                    resolve();
                });
                
                ffmpeg.on('error', (err) => {
                    clearTimeout(timeout);
                    reject(err);
                });
                
                ffmpeg.on('close', (code) => {
                    clearTimeout(timeout);
                    if (code !== 0) {
                        reject(new Error(`FFmpeg closed with code ${code}`));
                    }
                });
            });
            
            Logger.info('FFmpeg is producing audio data');
            
            // Create audio resource from the ffmpeg output
            const resource = createAudioResource(ffmpeg.stdout, {
                inputType: StreamType.Raw,
                inlineVolume: true,
            });
            
            // Store ffmpeg process to kill it later if needed
            queue.ffmpeg = ffmpeg;
            
            // Set volume
            if (resource.volume) {
                resource.volume.setVolume(queue.volume);
            }

            // Play the resource
            queue.player.play(resource);
            queue.resource = resource;

            Logger.info(`Now playing: ${queue.currentTrack.title} in ${queue.voiceChannel.guild.name}`);

            // Emit event for the bot to handle
            this.client.emit('trackStart', queue, queue.currentTrack);
        } catch (error) {
            Logger.error(`[PLAY] Failed to play track: ${error.message}`);
            // Only call handleTrackEnd if we actually have a currentTrack
            if (queue.currentTrack) {
                this.handleTrackEnd(queue);
            }
        }
    }

    /**
     * Handle when a track ends
     */
    handleTrackEnd(queue) {
        if (!queue) return;
        
        Logger.info(`[TRACK_END] Track ended, remaining: ${queue.tracks.length}`);
        
        // Prevent concurrent calls
        if (queue._processingNext) {
            Logger.warn('[TRACK_END] Already processing next, skipping');
            return;
        }
        queue._processingNext = true;

        // Handle loop modes
        if (queue.loop === 1 && queue.currentTrack) {
            // Loop single track
            Logger.info('[TRACK_END] Loop single - re-adding current track to front');
            queue.tracks.unshift(queue.currentTrack);
        } else if (queue.loop === 2 && queue.currentTrack) {
            // Loop queue - add current track to end
            Logger.info('[TRACK_END] Loop queue - adding current track to end');
            queue.tracks.push(queue.currentTrack);
        }

        // Queue the next track
        queue._processingNext = false;
        this.playNext(queue);
    }

    /**
     * Pause playback
     */
    pause(guildId) {
        Logger.info(`[PAUSE] Called for guild ${guildId}`);
        const queue = this.getQueue(guildId);
        if (!queue || !queue.playing || queue.paused) {
            Logger.warn(`[PAUSE] Cannot pause - queue:${!!queue}, playing:${queue?.playing}, paused:${queue?.paused}`);
            return false;
        }
        queue.player.pause();
        queue.paused = true;
        Logger.info(`[PAUSE] Paused successfully`);
        return true;
    }

    /**
     * Resume playback
     */
    resume(guildId) {
        Logger.info(`[RESUME] Called for guild ${guildId}`);
        const queue = this.getQueue(guildId);
        if (!queue || !queue.paused) {
            Logger.warn(`[RESUME] Cannot resume - queue:${!!queue}, paused:${queue?.paused}`);
            return false;
        }
        queue.player.unpause();
        queue.paused = false;
        Logger.info(`[RESUME] Resumed successfully`);
        return true;
    }

    /**
     * Skip current track
     */
    skip(guildId) {
        Logger.info(`[SKIP] Called for guild ${guildId}`);
        const queue = this.getQueue(guildId);
        if (!queue || !queue.playing) {
            Logger.warn(`[SKIP] Cannot skip - queue:${!!queue}, playing:${queue?.playing}`);
            return false;
        }
        Logger.info(`[SKIP] Skipping track: ${queue.currentTrack?.title}`);
        Logger.info(`[SKIP] Remaining in queue: ${queue.tracks.length}`);
        queue.player.stop();
        return true;
    }

    /**
     * Stop playback and clear queue
     */
    stop(guildId) {
        Logger.info(`[STOP] Called for guild ${guildId}`);
        const queue = this.getQueue(guildId);
        if (!queue) {
            Logger.warn(`[STOP] No queue found`);
            return false;
        }
        Logger.info(`[STOP] Clearing ${queue.tracks.length} tracks from queue`);
        queue.tracks = [];
        queue.loop = 0;
        if (queue.player) queue.player.stop();
        this.deleteQueue(guildId);
        Logger.info(`[STOP] Stopped and cleared queue`);
        return true;
    }

    /**
     * Set volume
     */
    setVolume(guildId, volume) {
        Logger.info(`[VOLUME] Called for guild ${guildId}, volume: ${volume}`);
        const queue = this.getQueue(guildId);
        if (!queue) {
            Logger.warn(`[VOLUME] No queue found`);
            return false;
        }
        queue.volume = volume / 100;
        Logger.info(`[VOLUME] Set volume to ${queue.volume} (${volume}%)`);
        if (queue.resource?.volume) {
            queue.resource.volume.setVolume(queue.volume);
            Logger.info(`[VOLUME] Applied to current resource`);
        }
        return true;
    }

    /**
     * Shuffle the queue
     */
    shuffle(guildId) {
        Logger.info(`[SHUFFLE] Called for guild ${guildId}`);
        const queue = this.getQueue(guildId);
        if (!queue || queue.tracks.length === 0) {
            Logger.warn(`[SHUFFLE] Cannot shuffle - queue:${!!queue}, tracks:${queue?.tracks.length}`);
            return false;
        }
        
        Logger.info(`[SHUFFLE] Shuffling ${queue.tracks.length} tracks`);
        // Fisher-Yates shuffle
        for (let i = queue.tracks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [queue.tracks[i], queue.tracks[j]] = [queue.tracks[j], queue.tracks[i]];
        }
        Logger.info(`[SHUFFLE] Shuffled successfully`);
        return true;
    }

    /**
     * Set loop mode
     */
    setLoop(guildId, mode) {
        Logger.info(`[LOOP] Called for guild ${guildId}, mode: ${mode}`);
        const queue = this.getQueue(guildId);
        if (!queue) {
            Logger.warn(`[LOOP] No queue found`);
            return false;
        }
        queue.loop = mode;
        Logger.info(`[LOOP] Set loop mode to ${mode} (0=off, 1=track, 2=queue)`);
        return true;
    }

    /**
     * Get current track
     */
    getCurrentTrack(guildId) {
        const queue = this.getQueue(guildId);
        return queue?.currentTrack || null;
    }

    /**
     * Get queue tracks
     */
    getTracks(guildId) {
        const queue = this.getQueue(guildId);
        return queue?.tracks || [];
    }

    /**
     * Remove a track from queue
     */
    removeTrack(guildId, index) {
        const queue = this.getQueue(guildId);
        if (!queue || index < 0 || index >= queue.tracks.length) return null;
        return queue.tracks.splice(index, 1)[0];
    }

    /**
     * Clear the queue
     */
    clearQueue(guildId) {
        const queue = this.getQueue(guildId);
        if (!queue) return false;
        queue.tracks = [];
        return true;
    }

    /**
     * Jump to a specific track
     */
    jump(guildId, index) {
        const queue = this.getQueue(guildId);
        if (!queue || index < 0 || index >= queue.tracks.length) return false;
        queue.tracks = queue.tracks.slice(index);
        queue.player.stop();
        return true;
    }

    /**
     * Get playback progress
     */
    getProgress(guildId) {
        const queue = this.getQueue(guildId);
        if (!queue || !queue.currentTrack) return null;
        
        return {
            current: 0,
            total: queue.currentTrack.durationMS,
            progress: null,
        };
    }

    /**
     * Check if playing
     */
    isPlaying(guildId) {
        const queue = this.getQueue(guildId);
        return queue?.playing && !queue?.paused;
    }

    /**
     * Destroy all queues
     */
    destroy() {
        for (const [guildId] of this.queues) {
            this.deleteQueue(guildId);
        }
    }
}

module.exports = MusicPlayer;
