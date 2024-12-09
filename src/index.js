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
	if (!guesses) { guesses = [] }
	let html = `<body style="background:#111111;color:#ffffff;display:flex;justify-content:center;font-family:verdana, sans-serif;height:100%;">`;
	html += `<div id="game_container" style="width:100%;display:flex;align-items:center;flex-direction:column;">`;
	html += `<div id="grid_container" style="display:flex;align-items:center;flex-direction:column;">`;

	for (let row = 0; row < guesses.length; row++) {
		const thisGuess = guesses[row].guess || "";
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

const processGuess = (puzzle, guess) => {
	const feedback = { victory: true };
	const targetWord = new Word(puzzle.word);
	Object.assign(feedback, structuredClone(targetWord));
	const inputWord = new Word(guess);
	//console.log("inputWord: ", JSON.stringify(inputWord));
	//console.log("targetWord: ", JSON.stringify(targetWord));
	// check greens
	for (let i = 0; i < feedback.numLetters; i++) {
		if (inputWord.str[i] === targetWord.str[i]) {
			feedback.letters[i].state = "green";
		}
	}
	// check the remaining letters:
	const remainingTargetLetters = feedback.letters.filter(x => x.state !== "green");
	if (remainingTargetLetters.length) {
		feedback.victory = false;
	}
	const targetLetterCounts = {};
	remainingTargetLetters.forEach((a) => {
		targetLetterCounts[a.str] ? (targetLetterCounts[a.str]++) : (targetLetterCounts[a.str] = 1);
	});
	for (let i = 0; i < remainingTargetLetters.length; i++) {
		const ind = remainingTargetLetters[i].index;
		const inputLetterObj = inputWord.letters[ind];
		const inputLetter = inputLetterObj.str;
		const targetLetter = targetWord.letters[ind].str;
		if (targetLetterCounts[inputLetter]) { // yellow
			targetLetterCounts[inputLetter]--;
			feedback.letters[ind].state = "yellow";
		} else { // gray
			feedback.letters[ind].state = "gray";
		}
	}
	return feedback;
}

router.get("/render_grid", async (req, env) => {
	const puzzleId = req.query.pid;
	console.log(puzzleId);
	if (puzzleId) {
		let puzzle = await env.PUZZLES.get(puzzleId);
		if (puzzle) {
			puzzle = JSON.parse(puzzle);
		} else {
			puzzle = { coop: true, lang: "en-US", word: "", guesses: [] }
		}
		const html = generateGameGridHTML(puzzle.guesses, puzzle.word);
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
		const channelId = interaction.channel.id;
		const userId = interaction.member.user.id;
		const username = interaction.member.nick || interaction.member.user.username;
		//return new JsonResponse({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: `a` } });
		switch (interaction.data.name.toLocaleLowerCase()) {
			case COMMANDS.START.name.toLocaleLowerCase():
				{
					if (Object.keys(data.languages).length === 0) {
						//console.log("reading language data");
						const { LANGUAGES } = await import('../public/languages.js');
						Object.assign(data.languages, LANGUAGES);
					}
					const puzzleArgs = { langId: "en-US", coop: true, word: null, max_guesses: 6 };
					if (interaction.data.options) {
						const opts = {};
						interaction.data.options.forEach(x => opts[x.name] = x);
						if (opts.lang) {
							puzzleArgs.langId = opts.lang.value;
						}
						if (opts.coop) {
							puzzleArgs.coop = opts.coop.value;
							if (opts.word) {
								puzzleArgs.word = opts.word.value;
								if (opts.max_guesses) {
									puzzleArgs.max_guesses = opts.max_guesses.value;
								}
							}
						}
					}
					const thisLang = data.languages[puzzleArgs.langId];
					let wordList = thisLang.wordList;
					if (!wordList || !wordList.length) {
						//console.log("fetching word list");
						wordList = await (await fetch(thisLang.wordList_URL)).text();
						wordList = wordList.split(/\r?\n/);
						thisLang.wordList = wordList;
					}
					let puzzle = null;
					if (puzzleArgs.coop) {
						//puzzle = await env.PUZZLES.get(channelId);
						puzzle = await env.PUZZLES.get(channelId);
						// TODO: auto-delete old puzzle
						/*
						if (puzzle) {
							return new JsonResponse({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: `there is already a co-op puzzle in this channel. please finish it first.` } });
						} else {
							puzzleArgs.word = wordList[Math.floor(Math.random() * wordList.length)];
						}
						*/
					} else { // solo. if puzzle exists, just return it
						puzzle = await env.PUZZLES.get(userId);
						// TODO: auto-delete old puzzle
					}
					if (!puzzle) {
						puzzle = {
							coop: puzzleArgs.coop,
							max_guesses: puzzleArgs.max_guesses,
							started_by: userId,
							username: username,
							started_at: Date.now(),
							lang: puzzleArgs.langId,
							word: wordList[Math.floor(Math.random() * wordList.length)],
							guesses: []
						};
						await env.PUZZLES.put(puzzleArgs.coop ? channelId : userId, JSON.stringify(puzzle));
					} else {
						puzzle = JSON.parse(puzzle);
					}
					console.log("puzzle:", puzzle);
					return new JsonResponse({
						type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
						data: {
							embeds: [{
								title: `Wordle`,
								image: { url: `${env.ROOT_URL}/render_grid?pid=${puzzleArgs.coop ? channelId : userId}` },
								description: `${username}'s ${puzzleArgs.coop ? "Co-op" : "Solo"} game`
							}],
							components: [{
								type: 1,
								components: [{
										type: 2,
										label: "End Game",
										style: 4,
										custom_id: "cmp_end_game"
									}
									/*
									, {
										type: 2,
										label: "New Guess",
										style: 1,
										custom_id: "cmp_guess_modal"
									}, */
								]
							}],
						}
					});
				}
				break;
			case COMMANDS.GUESS.name.toLocaleLowerCase():
				{
					const guess = interaction.data.options ? interaction.data.options[0].value : "";
					let puzzle = await env.PUZZLES.get(userId);
					if (!puzzle) {
						puzzle = await env.PUZZLES.get(channelId);
						if (!puzzle) {
							return new JsonResponse({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: `no puzzle found` } });
						}
					}
					puzzle = JSON.parse(puzzle);
					let _error = null;
					let _deletePuzzle = false;
					let _msg = "";
					if (guess.length !== puzzle.word.length) {
						_error = _msg = "invalid guess length";
					}
					if (puzzle.guesses.length >= puzzle.max_guesses) {
						_error = _msg = "too many guesses. the answer was " + puzzle.word;
						_deletePuzzle = true;
					}
					// TODO: check if word in dictionary
					//return new JsonResponse({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: `feedback: ${JSON.stringify(feedback)}` } });
					if (_error) {
						if (_deletePuzzle) {
							await env.PUZZLES.delete(puzzle.coop ? channelId : userId);
						}
						return new JsonResponse({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: `Error: ${_error}` } });
					} else {
						const feedback = processGuess(puzzle, guess);
						puzzle.guesses.push({ user: userId, guess: guess });
						if (feedback.victory) {
							_deletePuzzle = true;
							//return new JsonResponse({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: `${username} found the word: ${guess}` } });
							msg = `${username} found the word: ${guess}`;
						}
						if (_deletePuzzle) {
							await env.PUZZLES.delete(puzzle.coop ? channelId : userId);
							return new JsonResponse({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: _msg } });
						} else {
							await env.PUZZLES.put(puzzle.coop ? channelId : userId, JSON.stringify(puzzle));
							return new JsonResponse({
								type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
								data: {
									embeds: [{
										title: `Wordle`,
										image: { url: `${env.ROOT_URL}/render_grid?pid=${puzzle.coop ? channelId : userId}` },
										description: `${puzzle.username}'s ${puzzle.coop ? "co-op" : "solo"} game, guess ${puzzle.guesses.length}/${puzzle.max_guesses}`
									}],
									components: [{
										type: 1,
										components: [{
												type: 2,
												label: "End Game",
												style: 4,
												custom_id: "cmp_end_game"
											}
											/*
											, {
												type: 2,
												label: "New Guess",
												style: 1,
												custom_id: "cmp_guess_modal"
											}, */
										]
									}],
								}
							});
						}


					}
				}
				break;
			default:
				return new JsonResponse({ error: 'Unknown Type' }, { status: 400 });
				break;
		}
	} else if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
		//console.log(interaction);
		if (interaction.data.custom_id === "cmp_end_game") {
			//return new JsonResponse({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: `TODO: end game` } });
			let soloPuzzle = await env.PUZZLES.get(userId);
			if (soloPuzzle) {
				soloPuzzle = JSON.parse(soloPuzzle);
				await env.PUZZLES.delete(userId);
				return new JsonResponse({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: `${username}'s solo puzzle has been deleted` } });
			}
			let coopPuzzle = await env.PUZZLES.get(channelId);
			if (coopPuzzle) {
				coopPuzzle = JSON.parse(coopPuzzle);
				if (coopPuzzle.started_by === userId) {
					await env.PUZZLES.delete(channelId);
					return new JsonResponse({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: `${username}'s co-op puzzle has been deleted` } });
				}
			}
			return new JsonResponse({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: `${username} has no puzzles to delete` } });
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