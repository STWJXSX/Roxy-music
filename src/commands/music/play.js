const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { EmbedFactory, validateVoiceConnection } = require('../../utils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Play a song from YouTube or Spotify')
        .addStringOption(option =>
            option
                .setName('query')
                .setDescription('Song name or URL (YouTube/Spotify)')
                .setRequired(true)
        ),
    
    aliases: ['p'],
    
    /**
     * Execute the play command
     * @param {Interaction} interaction - Discord interaction
     * @param {Client} client - Discord client
     */
    async execute(interaction, client) {
        // Validate voice connection
        const validation = validateVoiceConnection(interaction);
        if (!validation.valid) {
            const embed = EmbedFactory.error('Voice Error', validation.reason);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const query = interaction.options.getString('query');
        
        await interaction.deferReply();

        try {
            const result = await client.musicPlayer.play(
                validation.channel,
                query,
                interaction.user,
                interaction.channel  // Pass text channel for messages
            );

            if (!result.success) {
                const embed = EmbedFactory.error('No Results', `No tracks found for: **${query}**`);
                return interaction.editReply({ embeds: [embed] });
            }

            // If it's a Spotify playlist/album (loading in background)
            if (result.isPlaylist && result.playlist && result.searchResult.spotifyData) {
                const spotifyData = result.searchResult.spotifyData;
                const embed = new EmbedBuilder()
                    .setColor('#1DB954')
                    .setTitle('🎵 Loading Playlist...')
                    .setDescription(`**${result.playlist.name || 'Spotify Playlist'}**`)
                    .addFields(
                        { name: 'Total Tracks', value: `${result.playlist.totalTracks || '?'}`, inline: true },
                        { name: 'Author', value: result.playlist.author || 'Unknown', inline: true }
                    )
                    .setFooter({ text: `First track playing! Rest loading in background... • Requested by ${interaction.user.username}` })
                    .setTimestamp();
                
                if (result.playlist.thumbnail) {
                    embed.setThumbnail(result.playlist.thumbnail);
                }
                
                return interaction.editReply({ embeds: [embed] });
            }

            // If it's a YouTube playlist (loading in background)
            if (result.isPlaylist && result.playlist && result.searchResult.youtubePlaylist) {
                const embed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('🎵 Loading Playlist...')
                    .setDescription(`**[${result.playlist.title}](${result.playlist.url})**`)
                    .addFields(
                        { name: 'Total Tracks', value: `${result.playlist.totalTracks}`, inline: true },
                        { name: 'Author', value: result.playlist.author || 'Unknown', inline: true }
                    )
                    .setFooter({ text: `First track playing! Rest loading in background... • Requested by ${interaction.user.username}` })
                    .setTimestamp();
                
                if (result.playlist.thumbnail) {
                    embed.setThumbnail(result.playlist.thumbnail);
                }
                
                return interaction.editReply({ embeds: [embed] });
            }

            // If it's any other playlist (already fully loaded)
            if (result.isPlaylist && result.playlist) {
                const embed = EmbedFactory.playlistAdded(
                    result.playlist,
                    result.searchResult.tracks.length,
                    interaction.user
                );
                return interaction.editReply({ embeds: [embed] });
            }

            // Single track - the trackStart event will handle the "Now Playing" message
            // So we just confirm the track was queued
            const queue = client.musicPlayer.getQueue(interaction.guildId);
            
            if (queue && queue.tracks.length > 0) {
                const embed = EmbedFactory.trackAdded(
                    result.track,
                    queue.tracks.length,
                    interaction.user
                );
                return interaction.editReply({ embeds: [embed] });
            } else {
                // Track is playing immediately - trackStart will handle it
                const embed = EmbedFactory.success(
                    '__Loading Track__',
                    `Loaded **${result.track.title}** 🫶`
                );
                return interaction.editReply({ embeds: [embed] });
            }
        } catch (error) {
            console.error(error);
            const embed = EmbedFactory.error(
                'Playback Error',
                `Failed to play the track. Please try again.\n\`\`\`${error.message}\`\`\``
            );
            return interaction.editReply({ embeds: [embed] });
        }
    },
};
