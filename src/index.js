/**
 * The core server that runs on a Cloudflare worker.
 */
import { AutoRouter } from 'itty-router';
import { InteractionResponseType, InteractionType, verifyKey, InteractionResponseFlags } from 'discord-interactions';
import { COMMANDS } from './commands.js';
import { ImageResponse } from "workers-og";

function Word(str) {
	this.str = str;
	this.numLetters = str.length;
	this.letters = [];
	for (let i = 0; i < this.numLetters; i++) {
		this.letters.push({
			index: i,
			str: str[i],
			state: "gray",
		});
	}
}
/*
Word.prototype.addLetter = function(letter) {
	this.numLetters++;
	this.letters.push({ index: this.numLetters, str: letter, state: "gray" });
	this.str += letter;
}
Word.prototype.deleteLastLetter = function() {
	if (this.numLetters < 1) { return }
	this.numLetters--;
	this.letters.pop();
	this.str = this.str.substring(0, this.numLetters);
}
*/

class JsonResponse extends Response {
	constructor(body, init) {
		const jsonBody = JSON.stringify(body);
		init = init || { headers: { 'content-type': 'application/json;charset=UTF-8' } };
		super(jsonBody, init);
	}
}

const data = {
	//numLetters: 5,
	numAllowedGuesses: 6,
	allowInvalidGuesses: false, // can turn on for debugging purposes
	//curGuessId: 0,
	//curLetterId: 0,
	//gameStarted: false,
	//inputWord: {},
	targetWord: {},
	languages: {},
	//curLangId: "", // "en-US" etc
	//curLang: {}, // shortcut to relevant entry in languages
};

const router = AutoRouter();
// A simple hello page to verify the worker is working.
router.get('/', (request, env) => {
	return new Response(`👋 ${env.DISCORD_APPLICATION_ID}`);
});

router.get('/test', (request, env) => {
	return new Response(`👋 test`);
});

const generateGameGridHTML = (guesses, targetWord) => {

	let html = `<body style="background:#111111;color:#ffffff;display:flex;justify-content:center;font-family:verdana, sans-serif;height:100%;">`;
	html += `<div id="game_container" style="width:100%;display:flex;align-items:center;flex-direction:column;">`;
	html += `<div id="grid_container" style="display:flex;align-items:center;flex-direction:column;">`;

	for (let row = 0; row < 6; row++) {
		const thisGuess = guesses[row] || "";
		html += `<div class="grid_row" style="display:flex">`;
		for (let col = 0; col < 5; col++) {
			const thisLetter = thisGuess[col] || "";
			html += `<a class="grid_cell" style="border:2px solid #565758;text-align:center;justify-content:center;width:60px;height:60px;margin:3px;text-align:center;line-height:60px;vertical-align:top;background-color:transparent;font-size:1.6em;font-weight:700">${thisLetter}</a>`;
		}
		html += `</div>`;
	}
	html += `</div></div></body>`;
	return html;
};

router.get("/render_grid", async (req, env) => {
	const channelId = req.query.cid;
	if (channelId) {
		let puzzleData = await env.PUZZLES.get(req.query.cid);
		if (puzzleData) {
			puzzleData = JSON.parse(puzzleData);
		} else {
			puzzleData = { coop: true, lang: "en-US", word: "", guesses: [] }
		}
		//const storedData = await env.WORDS.get(req.query.uid);
		//const targetWord = parseStoredWord(storedData)?.word || req.query.targetWord || "";
		//let guesses = req.query.guesses;
		//guesses = guesses ? guesses.split(",") : [];
		const html = generateGameGridHTML(puzzleData.guesses, puzzleData.word);
		return new ImageResponse(html, { width: 372, height: 435 });
	}
	return new ImageResponse(generateGameGridHTML([], ""), { width: 372, height: 435 });
});


// Main route for all requests sent from Discord.  All incoming messages will include a JSON payload described here: https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-object
router.post('/discord', async (request, env) => {
	const { isValid, interaction } = await server.verifyDiscordRequest(request, env);
	if (!isValid || !interaction) { return new Response('Bad request signature.', { status: 401 }); }
	const botHeader = { 'Content-Type': 'application/json', Authorization: `Bot ${env.DISCORD_TOKEN}` };
	//console.log("interaction:", interaction)
	//console.log(InteractionType)
	if (interaction.type === InteractionType.PING) {
		return new JsonResponse({ type: InteractionResponseType.PONG });
	} else if (interaction.type === InteractionType.APPLICATION_COMMAND) {
		//return new JsonResponse({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: `nabanzo` } });
		switch (interaction.data.name.toLocaleLowerCase()) {
			case COMMANDS.START.name.toLocaleLowerCase():
				{

					if (Object.keys(data.languages).length === 0) {
						//console.log("reading language data");
						const { LANGUAGES } = await import('../public/languages.js');
						Object.assign(data.languages, LANGUAGES);
					}

					const langId = interaction.data.options ? interaction.data.options[0].value : "en-US";
					const thisLang = data.languages[langId];
					let wordList = thisLang.wordList;
					if (!wordList || !wordList.length) {
						//console.log("fetching word list");
						wordList = await (await fetch(thisLang.wordList_URL)).text();
						wordList = wordList.split(/\r?\n/);
						thisLang.wordList = wordList;
					}
					const randomWord = wordList[Math.floor(Math.random() * wordList.length)];
					console.log(randomWord);
					const channelId = interaction.channel.id;
					let channelCoopPuzzle = await env.PUZZLES.get(channelId);
					if (!channelCoopPuzzle) {
						await env.PUZZLES.put(channelId, JSON.stringify(channelCoopPuzzle = { coop: true, lang: langId, word: randomWord, guesses: [] }));
					} else {
						channelCoopPuzzle = JSON.parse(channelCoopPuzzle);
					}
					console.log("channelCoopPuzzle", channelCoopPuzzle);
					//return new JsonResponse({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: `storedData: ${storedData}` } });
					return new JsonResponse({
						type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
						data: {
							//content: `langId: ${langId}`,
							embeds: [{
								title: `Wordle`,
								image: { url: `${env.ROOT_URL}/render_grid?cid=${channelId}` }
							}],
							components: [{
								type: 1,
								components: [{
									type: 2,
									label: "End Game",
									style: 4,
									custom_id: "cmp_end_game"
								}, {
									type: 2,
									label: "New Guess",
									style: 1,
									custom_id: "cmp_guess_modal"
								}, ]
							}],
						}
					});
				}
				break;
			case COMMANDS.GUESS.name.toLocaleLowerCase():
				{
					//TODO
				}
				break;
			default:
				return new JsonResponse({ error: 'Unknown Type' }, { status: 400 });
				break;
		}
	} else if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
		//console.log(interaction);
		if (interaction.data.custom_id === "cmp_end_game") {
			return new JsonResponse({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: `TODO: end game` } });
		} else if (interaction.data.custom_id === "cmp_guess_modal") {
			return new JsonResponse({
				type: InteractionResponseType.MODAL,
				data: {
					title: "New guess",
					custom_id: "new_guess",
					components: [{
						type: 1,
						components: [{
							type: 4,
							custom_id: "new_guess",
							label: "Guess",
							style: 1,
							min_length: 1,
							max_length: 4000,
							placeholder: "type a guess",
							required: true
						}]
					}]
				}
			});

		}
		return new JsonResponse({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: "unknown component type" } });
	} else if (interaction.type === InteractionType.MODAL_SUBMIT) {
		let guess = interaction.data.components[0].components[0].value || "";
		if (!guess || !guess.length) { guess = "" };
		return new JsonResponse({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: `TODO. guess: ${guess}` } });
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