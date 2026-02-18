const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { EmbedFactory, Logger } = require('../../utils');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('View the current music queue')
        .addIntegerOption(option =>
            option
                .setName('page')
                .setDescription('Page number')
                .setMinValue(1)
                .setRequired(false)
        ),
    
    aliases: ['q', 'list'],
    
    /**
     * Execute the queue command
     * @param {Interaction} interaction - Discord interaction
     * @param {Client} client - Discord client
     */
    async execute(interaction, client) {
        try {
            Logger.debug('[QUEUE] Command started');
            const queue = client.musicPlayer.getQueue(interaction.guildId);
            
            Logger.debug(`[QUEUE] Queue exists: ${!!queue}, currentTrack: ${!!queue?.currentTrack}`);
            
            if (!queue || !queue.currentTrack) {
                const embed = EmbedFactory.error('No Music', 'There is nothing playing right now!');
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

        const tracksPerPage = 10;
        let currentPage = interaction.options.getInteger('page') || 1;
        
        // Function to generate embed for a specific page
        const generateEmbed = (page) => {
            Logger.debug(`[QUEUE] generateEmbed called for page ${page}`);
            const tracks = client.musicPlayer.getTracks(interaction.guildId);
            const currentTrack = client.musicPlayer.getCurrentTrack(interaction.guildId);
            const totalPages = Math.ceil(tracks.length / tracksPerPage) || 1;
            
            Logger.debug(`[QUEUE] Tracks in queue: ${tracks.length}, currentTrack: ${currentTrack?.title || 'null'}`);
            
            if (page > totalPages) page = totalPages;
            if (page < 1) page = 1;

            const startIndex = (page - 1) * tracksPerPage;
            const endIndex = startIndex + tracksPerPage;
            const currentTracks = tracks.slice(startIndex, endIndex);

            const embed = new EmbedBuilder()
                .setColor(config.colors.info)
                .setTitle('📜 Music Queue')
                .setTimestamp();

            // Current track
            if (currentTrack) {
                const progress = client.musicPlayer.getProgress(interaction.guildId);
                const trackTitle = currentTrack.title || 'Unknown';
                const trackUrl = currentTrack.url || 'https://discord.com';
                const trackDuration = currentTrack.durationFormatted || currentTrack.duration || 'Live';
                
                embed.addFields({
                    name: '🎵 Now Playing',
                    value: `**[${trackTitle}](${trackUrl})**\n` +
                           `⏱️ ${trackDuration}\n` +
                           `${progress?.progress || '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬'}`,
                    inline: false
                });
            }

            // Queue tracks
            if (currentTracks.length > 0) {
                const queueList = currentTracks
                    .map((track, index) => {
                        const position = startIndex + index + 1;
                        const title = track.title || 'Unknown';
                        const url = track.url || 'https://discord.com';
                        const duration = track.durationFormatted || track.duration || 'Live';
                        return `**${position}.** [${title}](${url}) - \`${duration}\``;
                    })
                    .join('\n');

                // Verificar que queueList no esté vacío
                embed.addFields({
                    name: `📋 Up Next (${tracks.length} tracks)`,
                    value: queueList || 'No tracks',
                    inline: false
                });
            } else if (tracks.length === 0) {
                embed.addFields({
                    name: '📋 Up Next',
                    value: 'No more tracks in queue',
                    inline: false
                });
            }

            // Footer with page info
            const loopMode = ['Off', 'Track', 'Queue'][queue.loop] || 'Off';
            const is247 = queue.is247 ? ' • 24/7: On' : '';
            embed.setFooter({ 
                text: `Page ${page}/${totalPages} • Loop: ${loopMode} • Volume: ${Math.round(queue.volume * 100)}%${is247}` 
            });

            return { embed, totalPages, page };
        };
        
        // Function to generate buttons
        const generateButtons = (page, totalPages) => {
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('queue_first')
                        .setEmoji('⏮️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page <= 1),
                    new ButtonBuilder()
                        .setCustomId('queue_prev')
                        .setEmoji('◀️')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(page <= 1),
                    new ButtonBuilder()
                        .setCustomId('queue_page')
                        .setLabel(`${page}/${totalPages}`)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('queue_next')
                        .setEmoji('▶️')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(page >= totalPages),
                    new ButtonBuilder()
                        .setCustomId('queue_last')
                        .setEmoji('⏭️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page >= totalPages)
                );
            return row;
        };

        // Initial render
        Logger.debug(`[QUEUE] Generating embed for page ${currentPage}`);
        const { embed, totalPages, page } = generateEmbed(currentPage);
        currentPage = page;
        
        Logger.debug(`[QUEUE] Total pages: ${totalPages}, sending reply...`);
        
        let message;
        try {
            message = await interaction.reply({ 
                embeds: [embed], 
                components: totalPages > 1 ? [generateButtons(currentPage, totalPages)] : [],
                fetchReply: true
            });
        } catch (replyError) {
            Logger.error(`[QUEUE] Error sending reply:`, replyError.message);
            Logger.debug(`[QUEUE] Embed data:`, JSON.stringify({
                title: embed.data.title,
                fieldsCount: embed.data.fields?.length,
                fields: embed.data.fields?.map(f => ({ name: f.name, valueLength: f.value?.length }))
            }));
            throw replyError;
        }
        
        Logger.debug(`[QUEUE] Reply sent successfully`);
        
        // If only one page, no need for collector
        if (totalPages <= 1) return;
        
        // Create button collector
        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 120000 // 2 minutes
        });
        
        collector.on('collect', async (i) => {
            // Only allow the command user to interact
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: 'These buttons are not for you!', ephemeral: true });
            }
            
            const tracks = client.musicPlayer.getTracks(interaction.guildId);
            const newTotalPages = Math.ceil(tracks.length / tracksPerPage) || 1;
            
            switch (i.customId) {
                case 'queue_first':
                    currentPage = 1;
                    break;
                case 'queue_prev':
                    currentPage = Math.max(1, currentPage - 1);
                    break;
                case 'queue_next':
                    currentPage = Math.min(newTotalPages, currentPage + 1);
                    break;
                case 'queue_last':
                    currentPage = newTotalPages;
                    break;
            }
            
            const { embed: newEmbed, totalPages: updatedTotalPages } = generateEmbed(currentPage);
            
            await i.update({ 
                embeds: [newEmbed], 
                components: [generateButtons(currentPage, updatedTotalPages)]
            });
        });
        
        collector.on('end', async () => {
            // Disable buttons when collector expires
            try {
                const { embed: finalEmbed, totalPages: finalTotalPages } = generateEmbed(currentPage);
                const disabledRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('queue_first')
                            .setEmoji('⏮️')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId('queue_prev')
                            .setEmoji('◀️')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId('queue_page')
                            .setLabel(`${currentPage}/${finalTotalPages}`)
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId('queue_next')
                            .setEmoji('▶️')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId('queue_last')
                            .setEmoji('⏭️')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true)
                    );
                await message.edit({ embeds: [finalEmbed], components: [disabledRow] });
            } catch (e) {
                Logger.debug('[QUEUE] Error disabling buttons (message may be deleted)');
            }
        });
        
        } catch (error) {
            Logger.error('[QUEUE] Fatal error:', error.message);
            Logger.debug('[QUEUE] Error stack:', error.stack);
            throw error;
        }
    },
};
