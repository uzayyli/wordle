/**
 * The core server that runs on a Cloudflare worker.
 */
import { AutoRouter } from 'itty-router';
import { InteractionResponseType, InteractionType, verifyKey } from 'discord-interactions';
import { InteractionResponseFlags } from 'discord-interactions';
import { COMMANDS } from './commands.js';
import { ImageResponse } from "workers-og";

//import { EN_WORDS, TR_WORDS } from "./dictionaries_small.js";
import { EN_WORDS, TR_WORDS } from "./dictionaries.js";
const DICTIONARIES = { "en-US": EN_WORDS, "tr-TR": TR_WORDS };

const parseStoredWord = (wordData) => (wordData ? JSON.parse(wordData) : null);

class JsonResponse extends Response {
	constructor(body, init) {
		const jsonBody = JSON.stringify(body);
		init = init || { headers: { 'content-type': 'application/json;charset=UTF-8' } };
		super(jsonBody, init);
	}
}


const router = AutoRouter();
// A simple hello page to verify the worker is working.
router.get('/', (request, env) => {
	return new Response(`👋 ${env.DISCORD_APPLICATION_ID}`);
});

router.get('/test', (request, env) => {
	return new Response(`👋 test`);
});

const generateGameGridHTML = (guesses, targetWord) => {
	const colors = {
		"BORDER_LIGHT": "#565758",
		"FONT_COLOR": "#ffffff",
		"BACKGROUND": "#121213",
		"GRAY": "#3a3a3c",
		"YELLOW": "#b59f3b",
		"GREEN": "#538d4e"
	};
	const styles = {
		body: `
background: ${colors.BACKGROUND};
color: ${colors.FONT_COLOR};
font-family: Verdana;
`,
		gameBoard: `
display: flex;
align-items: center;
flex-direction: column;
`,
		letterBox: `
border-radius: 3px;
margin: 2px;
font-size: 1.5rem;
font-weight: 600;
height: 3rem;
width: 3rem;
display: flex;
justify-content: center;
align-items: center;
text-transform: uppercase;
border: 2px solid gray;
`,
	};

	let html = `<body style="${styles.body}">`;
	html += `<div id="game-board" style="${styles.gameBoard}">`;

	for (let i = 0; i < 6; i++) {
		const thisGuess = Array.from(guesses[i] || "");
		const letterColors = Array(5).fill(colors.BORDER_LIGHT);

		for (let g = 0; g < 5; g++) {
			if (targetWord[g] === thisGuess[g]) letterColors[g] = colors.GREEN;
		}
		for (let y = 0; y < 5; y++) {
			if (letterColors[y] === colors.GREEN) continue;
			for (let yr = 0; yr < 5; yr++) {
				if (targetWord[yr] === thisGuess[y]) {
					letterColors[y] = colors.YELLOW;
					break;
				}
			}
		}

		html += `<div class="letter-row" style="display: flex;">`;
		for (let j = 0; j < 5; j++) {
			const backgroundColor = thisGuess[j] ? letterColors[j] : "transparent";
			const content = thisGuess[j] || "";

			html += `<div class="letter-box" style="${
styles.letterBox
}; background-color: ${backgroundColor}; border: 2px solid ${
content ? colors.BACKGROUND : colors.GRAY
};">${content}</div>`;
		}
		html += `</div>`;
	}

	html += `</div></body>`;
	return html;
};

router.get("/render_grid", async (req, env) => {
	let guesses = req.query.guesses;
	guesses = guesses ? guesses.split(",") : [];
	const storedData = await env.WORDS.get(req.query.uid);
	const targetWord = parseStoredWord(storedData)?.word || req.query.targetWord || "";
	console.log("guesses:",JSON.stringify(guesses))
	console.log("targetWord:",targetWord)
	const html = generateGameGridHTML(guesses, targetWord);
	return new ImageResponse(html, { width: 260, height: 312 });
});


/**
 * Main route for all requests sent from Discord.  All incoming messages will
 * include a JSON payload described here:
 * https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-object
 */

router.post('/discord', async (request, env) => {
			const { isValid, interaction } = await server.verifyDiscordRequest(request, env);
			if (!isValid || !interaction) { return new Response('Bad request signature.', { status: 401 }); }
			const botHeader = { 'Content-Type': 'application/json', Authorization: `Bot ${env.DISCORD_TOKEN}` };
			if (interaction.type === InteractionType.PING) {
				return new JsonResponse({ type: InteractionResponseType.PONG });
			} else if (interaction.type === InteractionType.APPLICATION_COMMAND) {
				switch (interaction.data.name.toLocaleLowerCase()) {
					case COMMANDS.START.name.toLocaleLowerCase():
						{
							//console.log(`${env.ROOT_URL}/render_grid?inp=${interaction.data.options[0].value}`);
							const userId = interaction.member.user.id;
							let language = interaction.data.options[0];
							language = language ? language.value : "en-US";
							const wordCategory = DICTIONARIES[language];
							const word = wordCategory[Math.floor(Math.random() * wordCategory.length)];
							// Reset and store game data
							await env.GUESSES.delete(userId);
							await env.WORDS.put(userId, JSON.stringify({ language, word }));
							return new JsonResponse({
								type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
								data: {
									content: "nbr",
									embeds: [{
										title: `Wordle ${language}`,
										image: { url: `${env.ROOT_URL}/render_grid?uid=${userId}` }
									}],
								}
							});
						}
						break;
					case COMMANDS.GUESS.name.toLocaleLowerCase():
						{
							//console.log(`${env.ROOT_URL}/render_grid?inp=${interaction.data.options[0].value}`);
							let guess = interaction.data.options[0];
							guess = guess ? guess.value : "";
							//if(guess.length !== 5){} // handling in commands.js for now
							const userId = interaction.member.user.id;
							const storedData = await env.WORDS.get(userId);
							const { language, word: targetWord } = parseStoredWord(storedData);
							if (!DICTIONARIES[language].includes(guess)) {
								// TODO: don't allow invalid guesses
								//return new JsonResponse({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: "word not in dictionary: " + guess /*,flags: InteractionResponseFlags.EPHEMERAL*/ } });
							}
							// TODO: (maybe) don't allow duplicate guesses
							let guesses = await env.GUESSES.get(userId)
							guesses = guesses ? guesses.split(",") : [];
							guesses.push(guess);
							const isCorrect = guess === targetWord;
							const isGameOver = guesses.length >= 6;
							if (isCorrect || isGameOver) {
								await env.GUESSES.delete(userId);
								await env.WORDS.delete(userId);
								return new JsonResponse({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: "game over. you " + (isCorrect ? "won" : "lost") /*,flags: InteractionResponseFlags.EPHEMERAL*/ } });
							} else {
								guesses = guesses.slice(-6);
								await env.GUESSES.put(userId, guesses.join(","));
								return new JsonResponse({
										type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
										data: {
											//content: "nabdın",
											embeds: [{
														title: `${interaction.member.nick || interaction.member.user.username} guessed "${guess}" Guess #${guesses.length}/6`,
														image: { url: `${env.ROOT_URL}/render_grid?uid=${userId}&guesses=${encodeURIComponent(guesses.join(","))}` }
													}
												],
											}
										});
								}
							}
							break;
							default: return new JsonResponse({ error: 'Unknown Type' }, { status: 400 });
							break;
						}
				}
				console.error('Unknown Type');
				return new JsonResponse({ error: 'Unknown Type' }, { status: 400 });
			});

		router.all('*', () => new Response('Not Found.', { status: 404 }));

		async function verifyDiscordRequest(request, env) {
			const signature = request.headers.get('x-signature-ed25519');
			const timestamp = request.headers.get('x-signature-timestamp');
			const body = await request.text();
			const isValidRequest =
				signature &&
				timestamp &&
				(await verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY));
			if (!isValidRequest) {
				return { isValid: false };
			}

			return { interaction: JSON.parse(body), isValid: true };
		}

		const server = {
			verifyDiscordRequest,
			fetch: router.fetch,
		};

		export default server;