const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { EmbedFactory, validateVoiceConnection } = require('../../utils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stop the music and clear the queue'),
    
    aliases: ['leave', 'disconnect', 'dc'],
    
    /**
     * Execute the stop command
     * @param {Interaction} interaction - Discord interaction
     * @param {Client} client - Discord client
     */
    async execute(interaction, client) {
        const validation = validateVoiceConnection(interaction);
        if (!validation.valid) {
            const embed = EmbedFactory.error('Voice Error', validation.reason);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const queue = client.musicPlayer.getQueue(interaction.guildId);
        
        if (!queue) {
            const embed = EmbedFactory.error('No Music', 'There is nothing playing right now!');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const success = client.musicPlayer.stop(interaction.guildId);

        if (success) {
            const embed = EmbedFactory.goodbye(client);
            
            // Create buttons with Discord emojis
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
            
            return interaction.reply({ embeds: [embed], components: [row] });
        } else {
            const embed = EmbedFactory.error('Error', 'Failed to stop the music.');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
    },
};
