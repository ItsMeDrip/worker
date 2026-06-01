const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder } = require('discord.js')
const mineflayer = require('mineflayer')
const http = require('http')

http.createServer((req, res) => { res.write('alive!'); res.end() }).listen(3000)

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
})

const PANEL_CHANNEL_ID = '1510954258118479944'
const STATUS_CHANNEL_ID = '1510956160549781545'
let myBot = { name: null, ip: null, port: null, bot: null }

client.on('ready', () => console.log(`Bot online as ${client.user.tag}!`))

client.on('messageCreate', async (message) => {
  if (message.author.bot) return
  if (message.channel.id !== PANEL_CHANNEL_ID) return
  if (message.content !== '!panel') return

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('register').setLabel('Register').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('start').setLabel('Start Bot').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('stop').setLabel('Stop Bot').setStyle(ButtonStyle.Danger)
  )
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('status').setLabel('Status').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('delete').setLabel('Delete').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('edit').setLabel('Edit Registration').setStyle(ButtonStyle.Primary)
  )
  const embed = new EmbedBuilder()
    .setTitle('🤖 Bot Control Panel')
    .setDescription(myBot.name ? `**Registered Bot:** ${myBot.name}\n**Server:** ${myBot.ip}:${myBot.port}` : 'No bot registered yet!')
    .setColor(0x9B59B6)
    .setTimestamp()
  await message.channel.send({ embeds: [embed], components: [row1, row2] })
})

client.on('interactionCreate', async (interaction) => {
  if (interaction.isButton()) {
    if (interaction.customId === 'register' || interaction.customId === 'edit') {
      const modal = new ModalBuilder().setCustomId('registerModal').setTitle('Register Bot')
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('botName').setLabel('Bot Username').setStyle(TextInputStyle.Short).setRequired(true).setValue(myBot.name || '')),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('botAddress').setLabel('Server Address (e.g name.aternos.me:12345)').setStyle(TextInputStyle.Short).setRequired(true).setValue(myBot.ip ? `${myBot.ip}:${myBot.port}` : ''))
      )
      return await interaction.showModal(modal)
    }

    if (interaction.customId === 'start') {
      if (!myBot.name) return interaction.reply({ content: '❌ Register first!', ephemeral: true })
      if (myBot.bot) return interaction.reply({ content: '❌ Bot is already running!', ephemeral: true })
      startBot()
      return interaction.reply({ content: '🚀 Bot is starting!', ephemeral: true })
    }

    if (interaction.customId === 'status') {
      return interaction.reply({ content: `Bot Status: ${myBot.bot ? '🟢 Online' : '🔴 Offline'}${myBot.name ? `\nBot: ${myBot.name}\nServer: ${myBot.ip}:${myBot.port}` : ''}`, ephemeral: true })
    }

    if (interaction.customId === 'stop') {
      if (!myBot.bot) return interaction.reply({ content: '❌ Bot is not running!', ephemeral: true })
      cleanupBot()
      return interaction.reply({ content: '🔴 Bot stopped!', ephemeral: true })
    }

    if (interaction.customId === 'delete') {
      cleanupBot()
      myBot = { name: null, ip: null, port: null, bot: null }
      return interaction.reply({ content: '🗑️ Bot deleted! Register again.', ephemeral: true })
    }
  }

  if (interaction.isModalSubmit() && interaction.customId === 'registerModal') {
    const name = interaction.fields.getTextInputValue('botName')
    const address = interaction.fields.getTextInputValue('botAddress')
    const [ip, portStr] = address.split(':')
    const port = parseInt(portStr)
    if (!ip || !port) return interaction.reply({ content: '❌ Invalid address! Use: name.aternos.me:12345', ephemeral: true })
    cleanupBot()
    myBot = { name, ip, port, bot: null }
    return interaction.reply({ content: `✅ Registered!\nName: ${name}\nServer: ${ip}:${port}`, ephemeral: true })
  }
})

function cleanupBot() {
  if (myBot.afkInterval) { clearInterval(myBot.afkInterval); myBot.afkInterval = null }
  if (myBot.bot) {
    myBot.bot.removeAllListeners()
    try { myBot.bot.quit() } catch {}
    myBot.bot = null
  }
}

function startBot() {
  cleanupBot()
  const bot = require('mineflayer').createBot({
    host: myBot.ip, port: myBot.port, username: myBot.name, version: '1.20.1', auth: 'offline'
  })
  myBot.bot = bot
  bot.once('spawn', async () => {
    console.log(`${myBot.name} is online!`)
    try {
      const ch = client.channels.cache.get(STATUS_CHANNEL_ID)
      if (ch) await ch.send(`🟢 **${myBot.name}** is online!\n🌐 ${myBot.ip}:${myBot.port}`)
    } catch {}
    setTimeout(() => {
      bot.chat('/register pass123 pass123')
      setTimeout(() => {
        bot.chat('/login pass123')
        setTimeout(() => {
          myBot.afkInterval = setInterval(() => {
            bot.setControlState('jump', true)
            setTimeout(() => bot.setControlState('jump', false), 500)
          }, 30000)
        }, 2000)
      }, 2000)
    }, 3000)
  })
  const handleDisconnect = async (reason) => {
    cleanupBot()
    try {
      const ch = client.channels.cache.get(STATUS_CHANNEL_ID)
      if (ch) await ch.send(`🔴 **${myBot.name}** got kicked!\n🌐 ${myBot.ip}:${myBot.port}\n**Reason:** ${typeof reason === 'string' ? reason : JSON.stringify(reason)}`)
    } catch {}
    setTimeout(() => { if (myBot.name) startBot() }, 60000)
  }
  bot.on('kicked', handleDisconnect)
  bot.on('error', handleDisconnect)
  bot.on('end', handleDisconnect)
}

client.login(process.env.TOKEN)
