const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { EmbedFactory } = require('../../utils');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('author')
        .setDescription('Show the author/artist of the current song'),
    
    aliases: ['artist', 'who', 'whosings'],
    
    /**
     * Execute the author command
     * @param {Interaction} interaction - Discord interaction
     * @param {Client} client - Discord client
     */
    async execute(interaction, client) {
        const queue = client.musicPlayer.getQueue(interaction.guildId);
        
        if (!queue || !queue.currentTrack) {
            const embed = EmbedFactory.error('No Music', 'There is nothing playing right now!');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const track = queue.currentTrack;
        
        // Try to extract author from title (format: "Author - Title")
        let author = 'Unknown Artist';
        let songTitle = track.title;
        
        if (track.title.includes(' - ')) {
            const parts = track.title.split(' - ');
            author = parts[0].trim();
            songTitle = parts.slice(1).join(' - ').trim();
        } else if (track.title.includes(' | ')) {
            const parts = track.title.split(' | ');
            author = parts[0].trim();
            songTitle = parts.slice(1).join(' | ').trim();
        }
        
        const embed = new EmbedBuilder()
            .setColor(config.colors.info)
            .setTitle('🎤 Current Song Info')
            .addFields(
                { name: '🎵 Song', value: songTitle, inline: false },
                { name: '👤 Artist', value: author, inline: true },
                { name: '⏱️ Duration', value: track.durationFormatted || String(track.duration) || 'Live', inline: true },
                { name: '🔗 Source', value: track.source === 'spotify' ? '🟢 Spotify → YouTube' : '🔴 YouTube', inline: true }
            )
            .setTimestamp();
        
        if (track.thumbnail) {
            embed.setThumbnail(track.thumbnail);
        }
        
        if (track.url) {
            embed.addFields({ name: '🔗 Link', value: `[Click to open](${track.url})`, inline: false });
        }
        
        if (track.requestedBy) {
            embed.setFooter({ 
                text: `Requested by ${track.requestedBy.username}`, 
                iconURL: track.requestedBy.displayAvatarURL() 
            });
        }

        return interaction.reply({ embeds: [embed] });
    },
};
