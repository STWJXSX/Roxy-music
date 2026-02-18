const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('test')
        .setDescription('Sends the previous message from the current channel to another channel.')
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addChannelOption(option => 
            option.setName('canal')
                .setDescription('Channel where the announcement will be sent')
                .setRequired(true)
        ),

    aliases: ['announcement', 'anuncio'],

    /**
     * Execute the test command
     * @param {Interaction} interaction - Discord interaction
     * @param {Client} client - Discord client
     */
    async execute(interaction, client) {
        const channel = interaction.options.getChannel('canal');

        // Validate channel type
        if (!channel.isTextBased()) {
            return interaction.reply({
                content: '❌ Please select a valid text channel.',
                ephemeral: true,
            });
        }

        // Check permissions
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return interaction.reply({
                content: '❌ You don\'t have sufficient permissions to make an announcement.',
                ephemeral: true,
            });
        }

        try {
            // Fetch the last 2 messages from the current channel
            const messages = await interaction.channel.messages.fetch({ limit: 2 });

            // Validate there are enough messages
            if (messages.size < 2) {
                return interaction.reply({
                    content: '❌ There are not enough messages in the channel to perform this action.',
                    ephemeral: true,
                });
            }

            // Get the previous message (second to last)
            const [lastMessage, previousMessage] = [...messages.values()].reverse();

            // Validate the previous message has content
            if (!previousMessage || !previousMessage.content) {
                return interaction.reply({
                    content: '❌ The previous message has no content.',
                    ephemeral: true,
                });
            }

            // Create announcement embed
            const embed = new EmbedBuilder()
                .setColor(config.colors.info)
                .setDescription(previousMessage.content)
                .setAuthor({
                    name: interaction.user.username,
                    iconURL: interaction.user.displayAvatarURL(),
                })
                .setFooter({ 
                    text: `${config.bot.name} ${config.bot.emoji}`,
                    iconURL: client.user.displayAvatarURL() 
                })
                .setTimestamp();

            // Send the announcement
            await channel.send({ embeds: [embed] });

            // Confirm success
            return interaction.reply({
                content: `✅ The instant announcement has been sent successfully to ${channel}!`,
                ephemeral: true,
            });

        } catch (error) {
            console.error('[TEST COMMAND ERROR]:', error);
            return interaction.reply({
                content: '❌ There was an error trying to make the instant announcement.',
                ephemeral: true,
            });
        }
    },
};
