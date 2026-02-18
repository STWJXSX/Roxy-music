const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check the bot\'s latency'),
    
    aliases: ['latency', 'pong'],
    
    /**
     * Execute the ping command
     * @param {Interaction} interaction - Discord interaction
     * @param {Client} client - Discord client
     */
    async execute(interaction, client) {
        const sent = await interaction.reply({ 
            content: '🏓 Pinging...', 
            fetchReply: true 
        });

        const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
        const wsLatency = client.ws.ping;

        // Determine latency quality
        let color = config.colors.success;
        let quality = 'Excellent';
        
        if (roundtrip > 200 || wsLatency > 200) {
            color = config.colors.error;
            quality = 'Poor';
        } else if (roundtrip > 100 || wsLatency > 100) {
            color = config.colors.warning;
            quality = 'Good';
        }

        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle('🏓 Pong!')
            .addFields(
                { name: '📡 Roundtrip', value: `\`${roundtrip}ms\``, inline: true },
                { name: '💓 Websocket', value: `\`${wsLatency}ms\``, inline: true },
                { name: '📊 Quality', value: quality, inline: true }
            )
            .setFooter({ text: `${config.bot.name} v${config.bot.version}` })
            .setTimestamp();

        await interaction.editReply({ content: null, embeds: [embed] });
    },
};
