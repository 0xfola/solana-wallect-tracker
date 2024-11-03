const { Client, GatewayIntentBits, Events, REST, Routes } = require('discord.js');
const axios = require('axios');
require('dotenv').config(); // Load environment variables from a .env file

// Environment variables
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const HELIUS_RPC_URL = process.env.HELIUS_RPC_URL;

// Initialize Discord client
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Define the slash command
const commands = [
    {
        name: 'watch',
        description: 'Watch a Solana wallet address for memecoin buys and sells.',
        options: [
            {
                name: 'address',
                type: 3, // String type
                description: 'Solana wallet address to watch',
                required: true,
            },
        ],
    },
];

// Register commands
const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('Error reloading commands:', error);
    }
})();

// A list of wallets to watch
let wallets = [];

// Event handler for bot readiness
client.once(Events.ClientReady, () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

// Event handler for slash commands
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'watch') {
        const walletAddress = interaction.options.getString('address');

        if (!wallets.includes(walletAddress)) {
            wallets.push(walletAddress);
            await interaction.reply(`Now watching address: ${walletAddress}`);
            trackWallet(walletAddress, interaction);
        } else {
            await interaction.reply(`Already watching address: ${walletAddress}`);
        }
    }
});

// Function to track a wallet
async function trackWallet(walletAddress, interaction) {
    setInterval(async () => {
        try {
            // Step 1: Fetch recent transaction signatures for the wallet
            const signaturesResponse = await axios.post(HELIUS_RPC_URL, {
                jsonrpc: '2.0',
                id: 1,
                method: 'getSignaturesForAddress',
                params: [walletAddress, { limit: 5 }]
            });
            const signatures = signaturesResponse.data.result;

            for (const sig of signatures) {
                // Step 2: Get transaction details for each signature
                const transactionResponse = await axios.post(HELIUS_RPC_URL, {
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'getTransaction',
                    params: [sig.signature]
                });
                const transaction = transactionResponse.data.result;

                if (transaction && isMemecoinTransaction(transaction)) {
                    const message = formatTransactionMessage(transaction);
                    await interaction.followUp(message);
                }
            }
        } catch (error) {
            console.error(`Error fetching transactions for ${walletAddress}:`, error);
        }
    }, 60000); // Poll every 60 seconds
}

// Check if the transaction involves a memecoin
function isMemecoinTransaction(transaction) {
    const knownMemecoins = ['KNOWN_MEMECOIN_MINT_1', 'KNOWN_MEMECOIN_MINT_2']; // Add known memecoin mint addresses

    return transaction.transaction.message.accountKeys.some(account =>
        knownMemecoins.includes(account.pubkey)
    );
}

// Format the transaction data for the Discord message
function formatTransactionMessage(transaction) {
    const action = transaction.meta.postBalances[0] > transaction.meta.preBalances[0] ? 'Buy' : 'Sell';
    const tokenInfo = {
        tokenName: 'ExampleToken', // Placeholder, customize based on real data
        ticker: 'EXM',
        contractAddress: transaction.transaction.message.accountKeys[0].pubkey,
        timestamp: transaction.blockTime,
        socials: { twitter: 'N/A', telegram: 'N/A' } // Replace with actual social data if available
    };

    return `Transaction Detected:
    - **Action**: ${action}
    - **Token Name**: ${tokenInfo.tokenName}
    - **Ticker**: ${tokenInfo.ticker}
    - **Contract**: ${tokenInfo.contractAddress}
    - **Date**: ${new Date(tokenInfo.timestamp * 1000).toUTCString()}
    - **Socials**: ${tokenInfo.socials.twitter} / ${tokenInfo.socials.telegram}`;
}

// Login to Discord
client.login(DISCORD_TOKEN);