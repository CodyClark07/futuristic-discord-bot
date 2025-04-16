require('dotenv').config();
const { Client, IntentsBitField, PermissionsBitField  } = require('discord.js');

const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
  ],
});
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', (message) => {
  if (message.content === '!ping') {
    message.reply('Pong!');
  }
});

const axios = require('axios');

client.on('messageCreate', async (message) => {
  if (message.content.startsWith('!ai ')) {
    const prompt = message.content.slice(4);
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/models',
        {
          model: 'text-davinci-002',
          prompt: prompt,
          max_tokens: 100,
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          },
        }
      );
      message.reply(response.data.choices[0].text.trim());
    } catch (error) {
      message.reply('Sorry, something went wrong with the AI.');
    }
  }
});

client.on('messageCreate', async (message) => {
    if (message.content.startsWith('!image ')) {
      const prompt = message.content.slice(7);
      try {
        const response = await axios.post(
          'https://api.openai.com/v1/images/generations',
          {
            prompt: prompt,
            n: 1,
            size: '512x512',
          },
          {
            headers: {
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            },
          }
        );
        const imageUrl = response.data.data[0].url;
        message.reply({ files: [imageUrl] });
      } catch (error) {
        message.reply('Couldn’t generate the image—try again!');
      }
    }
  });

  client.on('messageCreate', async (message) => {
    if (message.content.startsWith('!crypto ')) {
      const crypto = message.content.slice(8).trim().toLowerCase();
      if (!crypto) {
        return message.reply('Please provide a cryptocurrency symbol (e.g., !crypto BTC).');
      }
      if (!process.env.COINCAP_API_KEY) {
        console.error('COINCAP_API_KEY is not set in .env');
        return message.reply('Bot configuration error: Missing CoinCap API key.');
      }
      try {
        const response = await axios.get(
          `https://rest.coincap.io/v3/assets?apiKey=${process.env.COINCAP_API_KEY}&search=${crypto}`
        );
        const assets = response.data.data;
        if (!assets || assets.length === 0) {
          return message.reply(`No data found for ${crypto.toUpperCase()}. Try symbols like BTC or ETH.`);
        }
        const asset = assets[0]; // Take the first matching asset
        message.reply(`${asset.name} (${asset.symbol}): $${parseFloat(asset.priceUsd).toFixed(2)}`);
      } catch (error) {
        console.error('Crypto Command Error:', error.response ? error.response.data : error.message);
        message.reply('Error fetching crypto data. Please try again later.');
      }
    }
  });

  client.on('messageCreate', async (message) => {
    // Ignore bot messages and DMs
    if (message.author.bot || !message.guild) return;
  
    // Check if user has Manage Messages or Administrator permissions
    const hasPermissions = message.member.permissions.has([
      PermissionsBitField.Flags.ManageMessages,
      PermissionsBitField.Flags.Administrator,
    ]);
  
    // !clear <number> - Delete specified number of messages (up to 100)
    if (message.content.startsWith('!clear ')) {
      if (!hasPermissions) {
        return message.reply('You need `Manage Messages` or `Administrator` permissions to use this command.');
      }
      const args = message.content.slice(7).trim();
      const amount = parseInt(args);
      if (isNaN(amount) || amount < 1 || amount > 100) {
        return message.reply('Please provide a number between 1 and 100.');
      }
      try {
        await message.channel.bulkDelete(amount, true); // true = filter out old messages
        message.channel.send(`Successfully deleted ${amount} messages.`).then((msg) => {
          setTimeout(() => msg.delete(), 3000); // Auto-delete confirmation after 3 seconds
        });
      } catch (error) {
        console.error('Clear Command Error:', error);
        message.reply('Error deleting messages. I can only delete messages newer than 14 days.');
      }
    }
  
    // !nuke - Clone channel and delete original to clear all history
    if (message.content === '!nuke') {
      if (!hasPermissions) {
        return message.reply('You need `Manage Messages` or `Administrator` permissions to use this command.');
      }
      try {
        const channel = message.channel;
        const position = channel.position;
        // Clone the channel with same settings
        const newChannel = await channel.clone({
          name: channel.name,
          topic: channel.topic,
          nsfw: channel.nsfw,
          parent: channel.parentId,
          permissionOverwrites: channel.permissionOverwrites.cache,
        });
        // Set the same position
        await newChannel.setPosition(position);
        // Delete the original channel
        await channel.delete('Nuked by admin');
        // Send confirmation in new channel
        newChannel.send('Channel nuked! All messages have been cleared.');
      } catch (error) {
        console.error('Nuke Command Error:', error);
        message.reply('Error nuking channel. Ensure I have `Manage Channels` permissions.');
      }
    }
  });
client.login(process.env.DISCORD_TOKEN);