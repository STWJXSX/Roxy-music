const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { EmbedFactory } = require('../../utils');
const config = require('../../config');
const play = require('play-dl');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('search')
        .setDescription('Search for songs on YouTube and pick one')
        .addStringOption(option =>
            option
                .setName('query')
                .setDescription('What to search for')
                .setRequired(true)
        ),
    
    aliases: ['find', 'buscar', 'yt'],
    
    /**
     * Execute the search command
     * @param {Interaction} interaction - Discord interaction
     * @param {Client} client - Discord client
     */
    async execute(interaction, client) {
        const query = interaction.options.getString('query');
        
        await interaction.deferReply();
        
        try {
            // Search YouTube
            const results = await play.search(query, { limit: 10, source: { youtube: 'video' } });
            
            if (!results || results.length === 0) {
                const embed = EmbedFactory.error('No Results', `No videos found for: **${query}**`);
                return interaction.editReply({ embeds: [embed] });
            }
            
            // Create embed with results
            const embed = new EmbedBuilder()
                .setColor(config.colors.info)
                .setTitle(`🔍 Search Results for: "${query}"`)
                .setDescription(
                    results.map((video, index) => {
                        const duration = video.durationRaw || 'Live';
                        const views = video.views ? `${(video.views / 1000).toFixed(1)}K views` : '';
                        return `**${index + 1}.** [${video.title}](${video.url})\n` +
                               `⏱️ \`${duration}\` ${views ? `• 👁️ ${views}` : ''}`;
                    }).join('\n\n')
                )
                .setFooter({ text: `Use !play <number> or !play <url> to play a song` })
                .setTimestamp();
            
            if (results[0].thumbnails[0]?.url) {
                embed.setThumbnail(results[0].thumbnails[0].url);
            }
            
            // Create buttons for first 5 results
            const row = new ActionRowBuilder();
            const maxButtons = Math.min(5, results.length);
            
            for (let i = 0; i < maxButtons; i++) {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`search_${i}`)
                        .setLabel(`${i + 1}`)
                        .setStyle(ButtonStyle.Primary)
                );
            }
            
            const message = await interaction.editReply({ embeds: [embed], components: [row] });
            
            // Create collector for button clicks
            const collector = message.createMessageComponentCollector({
                time: 60000 // 1 minute
            });
            
            collector.on('collect', async (i) => {
                if (i.user.id !== interaction.user.id) {
                    return i.reply({ content: 'These buttons are not for you!', ephemeral: true });
                }
                
                const index = parseInt(i.customId.split('_')[1]);
                const selectedVideo = results[index];
                
                // Check if user is in voice channel
                const voiceChannel = interaction.member?.voice?.channel;
                if (!voiceChannel) {
                    return i.reply({ 
                        content: '❌ You need to be in a voice channel to play music!', 
                        ephemeral: true 
                    });
                }
                
                await i.deferUpdate();
                
                // Play the selected track
                const result = await client.musicPlayer.play(
                    voiceChannel,
                    selectedVideo.url,
                    interaction.user,
                    interaction.channel
                );
                
                if (result.success) {
                    const playEmbed = EmbedFactory.success(
                        '🎵 Added to Queue',
                        `**[${selectedVideo.title}](${selectedVideo.url})**\n⏱️ Duration: \`${selectedVideo.durationRaw || 'Live'}\``
                    );
                    
                    // Disable all buttons
                    const disabledRow = new ActionRowBuilder();
                    for (let j = 0; j < maxButtons; j++) {
                        disabledRow.addComponents(
                            new ButtonBuilder()
                                .setCustomId(`search_${j}`)
                                .setLabel(`${j + 1}`)
                                .setStyle(j === index ? ButtonStyle.Success : ButtonStyle.Secondary)
                                .setDisabled(true)
                        );
                    }
                    
                    await interaction.editReply({ embeds: [playEmbed], components: [disabledRow] });
                } else {
                    await i.followUp({ 
                        content: `❌ Failed to play: ${result.error}`, 
                        ephemeral: true 
                    });
                }
                
                collector.stop();
            });
            
            collector.on('end', async (collected, reason) => {
                if (reason === 'time') {
                    // Disable all buttons on timeout
                    const disabledRow = new ActionRowBuilder();
                    for (let j = 0; j < maxButtons; j++) {
                        disabledRow.addComponents(
                            new ButtonBuilder()
                                .setCustomId(`search_${j}`)
                                .setLabel(`${j + 1}`)
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(true)
                        );
                    }
                    await interaction.editReply({ components: [disabledRow] }).catch(() => {});
                }
            });
            
        } catch (error) {
            console.error('Search error:', error);
            const embed = EmbedFactory.error('Search Error', 'Failed to search YouTube. Please try again.');
            return interaction.editReply({ embeds: [embed] });
        }
    },
};
