const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

// Music trivia questions
const TRIVIA = [
    { q: "Which band was Freddie Mercury the lead singer of?", a: "Queen", options: ["Queen", "The Beatles", "Led Zeppelin", "Pink Floyd"] },
    { q: "What year was Spotify launched?", a: "2008", options: ["2006", "2008", "2010", "2012"] },
    { q: "Which artist has the most streamed song on Spotify?", a: "The Weeknd", options: ["Ed Sheeran", "The Weeknd", "Drake", "Bad Bunny"] },
    { q: "What instrument does a DJ typically use?", a: "Turntables", options: ["Guitar", "Turntables", "Piano", "Violin"] },
    { q: "Which country is K-Pop from?", a: "South Korea", options: ["Japan", "China", "South Korea", "Thailand"] },
    { q: "What does 'BPM' stand for in music?", a: "Beats Per Minute", options: ["Bass Per Minute", "Beats Per Minute", "Bars Per Measure", "Beats Per Measure"] },
    { q: "Which streaming platform is known for its purple color?", a: "Twitch", options: ["Spotify", "Twitch", "Apple Music", "Deezer"] },
    { q: "What genre is typically 140-180 BPM?", a: "Drum and Bass", options: ["House", "Hip Hop", "Drum and Bass", "Reggae"] },
    { q: "Who is known as the 'King of Pop'?", a: "Michael Jackson", options: ["Elvis Presley", "Michael Jackson", "Prince", "Bruno Mars"] },
    { q: "What year did YouTube launch?", a: "2005", options: ["2003", "2005", "2007", "2009"] },
    { q: "Which artist's real name is Robyn Fenty?", a: "Rihanna", options: ["Beyoncé", "Rihanna", "Lady Gaga", "Adele"] },
    { q: "What does 'EDM' stand for?", a: "Electronic Dance Music", options: ["Electronic Dance Music", "Every Day Music", "Exciting Drum Music", "Electric Digital Music"] },
    { q: "Which music genre originated in Jamaica?", a: "Reggae", options: ["Reggae", "Salsa", "Bossa Nova", "Tango"] },
    { q: "What is the most viewed music video on YouTube?", a: "Baby Shark", options: ["Despacito", "Gangnam Style", "Baby Shark", "See You Again"] },
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('trivia')
        .setDescription('Test your music knowledge with a random trivia question!'),
    
    aliases: ['quiz', 'question', 'musicquiz'],
    
    async execute(interaction, client) {
        const question = TRIVIA[Math.floor(Math.random() * TRIVIA.length)];
        
        // Shuffle options
        const shuffledOptions = [...question.options].sort(() => Math.random() - 0.5);
        const correctIndex = shuffledOptions.indexOf(question.a);
        
        const optionEmojis = ['🅰️', '🅱️', '🅲', '🅳'];
        
        const embed = new EmbedBuilder()
            .setColor('#9B59B6')
            .setTitle('🎵 Music Trivia!')
            .setDescription(`**${question.q}**\n\n` + 
                shuffledOptions.map((opt, i) => `${optionEmojis[i]} ${opt}`).join('\n')
            )
            .addFields({
                name: '⏱️ Answer',
                value: `||The answer is: **${optionEmojis[correctIndex]} ${question.a}**||`
            })
            .setFooter({ text: 'Click the spoiler to reveal the answer!' })
            .setTimestamp();
        
        return interaction.reply({ embeds: [embed] });
    },
};
