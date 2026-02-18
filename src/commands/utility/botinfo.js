const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const os = require('os');

// Helper to get PROCESS CPU usage (not system-wide)
async function getProcessCpuUsage() {
    return new Promise((resolve) => {
        const startUsage = process.cpuUsage();
        const startTime = process.hrtime();
        
        setTimeout(() => {
            const endUsage = process.cpuUsage(startUsage);
            const endTime = process.hrtime(startTime);
            
            // Total CPU time used by this process (user + system) in microseconds
            const totalCpuTime = endUsage.user + endUsage.system;
            // Elapsed time in microseconds
            const elapsedTime = (endTime[0] * 1e6) + (endTime[1] / 1000);
            // CPU percentage (considering all cores)
            const cpuPercent = ((totalCpuTime / elapsedTime) * 100).toFixed(2);
            
            resolve(cpuPercent);
        }, 100);
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('botinfo')
        .setDescription('Display information about the bot'),
    
    aliases: ['info'],
    
    /**
     * Execute the botinfo command
     * @param {Interaction} interaction - Discord interaction
     * @param {Client} client - Discord client
     */
    async execute(interaction, client) {
        await interaction.deferReply();
        
        // Calculate uptime
        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);
        const uptimeString = `${days > 0 ? `${days} days, ` : ''}${hours} hours, ${minutes} minutes, ${seconds} seconds`;
        
        // PROCESS memory usage (not system-wide)
        const memUsedMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
        const memTotalGB = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
        
        // PROCESS CPU usage (measures over 100ms interval)
        const cpuUsage = await getProcessCpuUsage();
        
        // Get statistics
        const totalServers = client.guilds.cache.size;
        const totalUsers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
        
        // Active queues
        const activeQueues = client.musicPlayer ? client.musicPlayer.queues.size : 0;
        
        // Get ping
        const ping = client.ws.ping;
        
        const embed = new EmbedBuilder()
            .setColor('#FF6B9D')
            .setAuthor({ 
                name: `${client.user.username}`, 
                iconURL: client.user.displayAvatarURL() 
            })
            .setThumbnail(client.user.displayAvatarURL({ size: 256 }))
            .addFields(
                { 
                    name: '__👑 Developer & Owner__', 
                    value: '**[ℳɾ JxSx₰](https://discord.com/users/807586817581908008)**', 
                    inline: false 
                },
                { 
                    name: '__Statistics__', 
                    value: [
                        `\`1\` Total Servers: **${totalServers.toLocaleString()}**`,
                        `\`2\` Total Users: **${totalUsers.toLocaleString()}**`,
                        `\`3\` Active Queues: **${activeQueues}**`
                    ].join('\n'), 
                    inline: false 
                },
                { 
                    name: '__Memory usage__', 
                    value: `\`${memUsedMB}\` MB / \`${memTotalGB}\` GB`, 
                    inline: true 
                },
                { 
                    name: '__CPU usage__', 
                    value: `\`${cpuUsage}%\``, 
                    inline: true 
                },
                { 
                    name: '__⏱ Uptime__', 
                    value: `\`${uptimeString}\``, 
                    inline: false 
                },
                { 
                    name: '__🏓Ping__', 
                    value: `\`${ping} ms\``, 
                    inline: false 
                }
            )
            .setFooter({ text: `Roxy Music Bot • Node.js ${process.version}` })
        
        // Create buttons
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('Invite Roxy')
                    .setStyle(ButtonStyle.Link)
                    .setURL(`https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=4821191021153344&scope=bot%20applications.commands`)
                    .setEmoji('🎵'),
                new ButtonBuilder()
                    .setLabel('Support Server')
                    .setStyle(ButtonStyle.Link)
                    .setURL('https://discord.gg/SrSMRxfUEj')
                    .setEmoji('🔧')
            );
        
        return interaction.editReply({ embeds: [embed], components: [row] });
    }
};
