require('dotenv').config();
const { Client, IntentsBitField, PermissionsBitField } = require('discord.js');
const axios = require('axios');
const http = require('http');

const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
  ],
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag} at ${new Date().toISOString()}`);
});

// Custom message for your ID only
const YOUR_DISCORD_ID = 'YOUR_DISCORD_ID'; // Replace with your 18-digit ID
const customMessages = {
  ping: {
    yourId: 'Commander, ping’s locked on target! 🎮',
    others: 'Pong, gamer! Ready for action? 🕹️',
  },
};

// Consolidated messageCreate listener
client.on('messageCreate', async (message) => {
  console.log(`Message received: "${message.content}" from ${message.author.id} in channel ${message.channel.id}`);

  if (message.author.bot || !message.guild) {
    console.log('Ignoring bot or non-guild message');
    return;
  }

  const userId = message.author.id;
  const pingMessage = userId === '900551027730837544' ? customMessages.ping.yourId : customMessages.ping.others;

  // !ping command
  if (message.content.toLowerCase() === '!ping') {
    console.log(`Processing !ping for user ${userId}`);
    try {
      await message.reply(pingMessage);
      console.log('Ping reply sent successfully');
    } catch (error) {
      console.error('Error sending ping reply:', error.message);
      await message.reply('Error: Can’t ping right now. Check my permissions!').catch(() => {});
    }
    return;
  }

  // !ai command
  if (message.content.startsWith('!ai ')) {
    const prompt = message.content.slice(4).trim();
    if (!prompt) {
      return message.reply('Please provide a prompt (e.g., !ai What is AI?).');
    }
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions', // Updated endpoint
        {
          model: 'gpt-3.5-turbo', // Modern model
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 100,
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return message.reply(response.data.choices[0].message.content.trim());
    } catch (error) {
      console.error('AI Command Error:', error.response ? error.response.data : error.message);
      return message.reply('Sorry, something went wrong with the AI.');
    }
  }

  // !image command
  if (message.content.startsWith('!image ')) {
    const prompt = message.content.slice(7).trim();
    if (!prompt) {
      return message.reply('Please provide an image description (e.g., !image A cyberpunk city).');
    }
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
            'Content-Type': 'application/json',
          },
        }
      );
      const imageUrl = response.data.data[0].url;
      return message.reply({ files: [imageUrl] });
    } catch (error) {
      console.error('Image Command Error:', error.response ? error.response.data : error.message);
      return message.reply('Couldn’t generate the image—try again!');
    }
  }

  // !crypto command
  if (message.content.startsWith('!crypto ')) {
    const crypto = message.content.slice(8).trim().toLowerCase();
    if (!crypto) {
      return message.reply('Please provide a cryptocurrency symbol (e.g., !crypto BTC).');
    }
    if (!process.env.COINCAP_API_KEY) {
      console.error('COINCAP_API_KEY is not set');
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
      const asset = assets[0];
      return message.reply(`${asset.name} (${asset.symbol}): $${parseFloat(asset.priceUsd).toFixed(2)}`);
    } catch (error) {
      console.error('Crypto Command Error:', error.response ? error.response.data : error.message);
      return message.reply('Error fetching crypto data. Please try again later.');
    }
  }

  // Admin commands permission check
  const hasPermissions = message.member.permissions.has([
    PermissionsBitField.Flags.ManageMessages,
    PermissionsBitField.Flags.Administrator,
  ]);

  // !clear command
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
      await message.channel.bulkDelete(amount, true);
      const confirmMsg = await message.channel.send(`Successfully deleted ${amount} messages.`);
      setTimeout(() => confirmMsg.delete(), 3000);
    } catch (error) {
      console.error('Clear Command Error:', error.message);
      return message.reply('Error deleting messages. I can only delete messages newer than 14 days.');
    }
  }

  // !nuke command
  if (message.content === '!nuke') {
    if (!hasPermissions) {
      return message.reply('You need `Manage Messages` or `Administrator` permissions to use this command.');
    }
    const botPermissions = message.guild.members.me.permissionsIn(message.channel);
    if (!botPermissions.has(PermissionsBitField.Flags.ManageChannels)) {
      console.error('Bot lacks Manage Channels permission in', message.channel.name);
      return message.reply('I need `Manage Channels` permission to nuke this channel.');
    }
    try {
      const channel = message.channel;
      const position = channel.position;
      const newChannel = await channel.clone({
        name: channel.name,
        topic: channel.topic,
        nsfw: channel.nsfw,
        parent: channel.parentId,
        permissionOverwrites: channel.permissionOverwrites.cache,
      });
      await newChannel.setPosition(position);
      await channel.delete('Nuked by admin');
      await newChannel.send('Channel nuked! All messages have been cleared.');
    } catch (error) {
      console.error('Nuke Command Error:', error.message, error.stack);
      return message.reply('Error nuking channel. Ensure I have `Manage Channels` permissions.');
    }
  }
});

// Dummy HTTP server for Render
http.createServer((req, res) => {
  res.writeHead(200);
  res.end('DigitalDefender is running');
}).listen(process.env.PORT || 3000, () => {
  console.log(`Dummy server running on port ${process.env.PORT || 3000}`);
});

// Error handling for client login
client.login(process.env.DISCORD_TOKEN).catch((error) => {
  console.error('Failed to login:', error.message);
  process.exit(1);
});