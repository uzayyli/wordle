// The core server that runs on a Cloudflare worker.
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

/* beautify ignore:start */
const getPuzzleData = async (env, puzzleId) => {
	let puzzle = await env?.PUZZLES?.get(puzzleId);
	if (puzzle) {
		puzzle = JSON.parse(puzzle);
	}
	return puzzle;
}
/* beautify ignore:end */

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

const processGuess = (targetWord, inputWord) => {
	const feedback = { victory: true, letters: structuredClone(inputWord.letters) };
	const targetLettersRemaining = structuredClone(targetWord.letters);
	const inputLettersRemaining = structuredClone(inputWord.letters);
	// check greens
	for (let i = feedback.letters.length - 1; i >= 0; i--) {
		if (targetWord.letters[i].str === inputWord.letters[i].str) {
			feedback.letters[i].state = "green";
			targetLettersRemaining.splice(i, 1);
			inputLettersRemaining.splice(i, 1);
		}
	}
	if (inputLettersRemaining.length) {
		feedback.victory = false;
	}
	for (let i = 0; i < inputLettersRemaining.length; i++) {
		const thisLetterObj = inputLettersRemaining[i];
		const ind = thisLetterObj.index;
		const matchInd = targetLettersRemaining.findIndex(x => x.str === thisLetterObj.str);
		if (matchInd === -1) {
			// absent
		} else { // present
			feedback.letters[ind].state = "yellow";
			targetLettersRemaining.splice(matchInd, 1);
		}
	}
	return feedback;
};

const processGuesses = (targetWord, guesses) => {
	const guessObjects = guesses.map(x => new Word(x));
	const targetObject = new Word(targetWord);
	const feedbacks = [];
	//guessObjects.forEach(x => { feedbacks.push(processGuess(targetObject, x)); });
	for (let i = 0; i < guessObjects.length; i++) {
		const fb = processGuess(targetObject, guessObjects[i]);
		feedbacks.push(fb);
		if (fb.victory) { break }
	}
	return feedbacks;
}

const generateGameGridHTML = (targetWord, guesses, maxGuesses, langId) => {
	// TODO: draw keyboard
	if (!guesses) { guesses = [] }
	if (!maxGuesses) { maxGuesses = 6 }
	if (!targetWord) { targetWord = "" }
	if (!langId) { langId = "en-US" }
	const numLetters = targetWord.length || 5;
	const feedbacks = processGuesses(targetWord, guesses);
	const colors = {
		"gray": "#2c3032",
		"green": "#538d4e",
		"yellow": "#b59f3b"
	};
	let html = `<body style="background:#111111;color:#ffffff;display:flex;justify-content:center;font-family:verdana, sans-serif;height:100%;">`;
	html += `<div id="game_container" style="width:100%;display:flex;align-items:center;flex-direction:column;margin-top:10px;">`;
	html += `<div id="grid_container" style="display:flex;align-items:center;flex-direction:column;">`;
	for (let row = 0; row < maxGuesses; row++) {
		const thisGuess = feedbacks[row];
		html += `<div class="grid_row" style="display:flex">`;
		if (thisGuess) {
			for (let col = 0; col < numLetters; col++) {
				const thisLetterObj = thisGuess.letters[col];
				const color = colors[thisLetterObj.state];
				html += `<a class="grid_cell" style="border:2px solid;border-color:${color};background-color:${color};text-align:center;justify-content:center;width:60px;height:60px;margin:3px;text-align:center;line-height:60px;vertical-align:top;font-size:1.6em;font-weight:700;color:#ffffff">${thisLetterObj.str.toLocaleUpperCase(langId)}</a>`;
			}
		} else {
			for (let col = 0; col < numLetters; col++) {
				html += `<a class="grid_cell" style="border:2px solid #565758;text-align:center;justify-content:center;width:60px;height:60px;margin:3px;text-align:center;line-height:60px;vertical-align:top;background-color:transparent;font-size:1.6em;font-weight:700;color:#ffffff"></a>`;
			}
		}
		html += `</div>`;
	}
	html += `</div></div></body>`;
	return html;
};

router.get("/render_grid", async (req, env) => {
	const wordEncoded = req.query.word;
	const word = Buffer.from(wordEncoded, 'base64').toString('utf-8');
	let guesses = req.query.guesses;
	if (guesses && guesses.length) {
		guesses = guesses.split(",");
		if (!guesses.length) {
			guesses = [];
		}
	} else {
		guesses = [];
	}
	let maxGuesses = req.query.max_guesses;
	if (!maxGuesses || !maxGuesses.length) { maxGuesses = 6 } else { maxGuesses = parseInt(maxGuesses) }
	const langId = req.query.lang || "en-US";
	try {
		if (!!word) {
			const html = generateGameGridHTML(word, guesses, maxGuesses, langId);
			return new ImageResponse(html, { width: 350, height: 430 });
		}
		return new ImageResponse(generateGameGridHTML("", []), { width: 350, height: 430 });
	} catch (e) {
		console.log("error in generateGameGridHTML:");
		console.log(e)
	}
});


// Main route for all requests sent from Discord.  All incoming messages will include a JSON payload described here: https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-object
router.post('/discord', async (request, env) => {
	const { isValid, interaction } = await server.verifyDiscordRequest(request, env);
	if (!isValid || !interaction) { return new Response('Bad request signature.', { status: 401 }); }
	const botHeader = { 'Content-Type': 'application/json', Authorization: `Bot ${env.DISCORD_TOKEN}` };
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
					puzzle = await getPuzzleData(env, puzzleArgs.coop ? channelId : userId);
					// TODO: auto-delete old puzzle
					if (!puzzle) {
						puzzle = {
							coop: puzzleArgs.coop,
							max_guesses: puzzleArgs.max_guesses,
							started_by: userId, // to allow puzzle starter to delete
							username: username, // for display purposes
							started_at: Date.now(),
							lang: puzzleArgs.langId,
							word: wordList[Math.floor(Math.random() * wordList.length)],
							guesses: []
						};
						await env.PUZZLES.put(puzzleArgs.coop ? channelId : userId, JSON.stringify(puzzle));
					}
					const wordEncoded = Buffer.from(puzzle.word).toString('base64');
					console.log(puzzle);
					return new JsonResponse({
						type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
						data: {
							embeds: [{
								title: `${puzzle.username}'s ${puzzle.coop ? "co-op" : "solo"} game`,
								image: { url: `${env.ROOT_URL}/render_grid?guesses=${puzzle.guesses.join(",")}&word=${wordEncoded}&lang=${puzzle.lang}&cache=${Math.floor(Date.now()/10000)}` },
								description: `Started ${Math.floor((Date.now()-puzzle.started_at)/(60*1000))} minutes ago`
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
					let puzzleId = userId,
						_msg, _error = null,
						_deletePuzzle = false;
					let puzzle = await getPuzzleData(env, puzzleId); // try to get solo puzzle first
					if (!puzzle) {
						puzzleId = channelId;
						puzzle = await getPuzzleData(env, puzzleId);
					}
					if (!puzzle) {
						_error = "You do not have an active game. Please start one with /start";
						return new JsonResponse({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: `Error: ${_error}` } });
					}
					if (guess.length !== puzzle.word.length) {
						_error = "invalid guess length";
					}
					// TODO: check if guess is in dictionary
					//if (puzzle.guesses.length >= puzzle.max_guesses) {
					//	_error = "you ran out of guesses. the answer was " + puzzle.word;
					//	_deletePuzzle = true;
					//}
					if (_error) {
						_msg = _error;
					} else {
						puzzle.guesses.push(guess);
						const feedbacks = processGuesses(puzzle.word, puzzle.guesses);
						if (feedbacks[feedbacks.length - 1].victory) {
							_msg = `${username} found the word: ${guess}`;
							_deletePuzzle = true;
						} else {
							_msg = `${username} guessed ${guess}`;

						}
					}
					if (puzzle.guesses.length >= puzzle.max_guesses) {
						_msg += `. you ran out of guesses, the word was: ${puzzle.word}`;
						_deletePuzzle = true;
					}
					if (_deletePuzzle) {
						await env.PUZZLES.delete(puzzleId);
					}
					if (_error) {
						return new JsonResponse({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: `Error: ${_error}` } });
					} else if (!_deletePuzzle) {
						await env.PUZZLES.put(puzzleId, JSON.stringify(puzzle));
					}

					const _components = _deletePuzzle ? [] : [{
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
					}];
					const wordEncoded = Buffer.from(puzzle.word).toString('base64');
					return new JsonResponse({
						type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
						data: {
							embeds: [{
								title: `${puzzle.username}'s ${puzzle.coop ? "co-op" : "solo"} wordle`,
								image: { url: `${env.ROOT_URL}/render_grid?guesses=${puzzle.guesses.join(",")}&word=${wordEncoded}&lang=${puzzle.lang}&cache=${Math.floor(Date.now()/10000)}` },
								description: _msg,
								footer: _deletePuzzle ? {text: "Start a new game with /start"} : null
							}],
							components: _components,
						}
					});
				}
				break;
			case COMMANDS.END.name.toLocaleLowerCase():
				{
					const coop = interaction.data.options ? interaction.data.options[0].value : true;
					const puzzleId = coop ? channelId : userId;
					const puzzleData = await getPuzzleData(env, puzzleId);
					if (puzzleData) {
						await env.PUZZLES.delete(puzzleId);
						return new JsonResponse({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: `${username}'s ${coop?"co-op":"solo"} puzzle has been deleted` } });
					} else {
						return new JsonResponse({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: `${username} has no ${coop?"co-op":"solo"} puzzle to delete` } });
					}
				}
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