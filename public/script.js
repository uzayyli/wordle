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

const dom = {
	noticeTimer: null
};
const data = {
	numLetters: 5,
	numAllowedGuesses: 6,
	allowInvalidGuesses: false, // can turn on for debugging purposes
	curGuessId: 0,
	curLetterId: 0,
	gameStarted: false,
	inputWord: {},
	targetWord: {},
	languages: {},
	curLangId: "", // "en-US" etc
	curLang: {}, // shortcut to relevant entry in languages
};

const giveFeedback = (inputWord, targetWord) => {
	const feedback = structuredClone(targetWord);
	feedback.victory = true;
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
	//console.log(targetLetterCounts);
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
};

const submitCurrentWord = () => {
	if (data.inputWord.numLetters !== data.numLetters) {
		return showNotice("NOT_A_WORD");
	}
	if (!data.allowInvalidGuesses && data.curLang.wordList.indexOf(data.inputWord.str)===-1) {
		// clear current word;
		for(let i=data.numLetters-1;i>=0;i--){
			dom.grid[data.curGuessId][i].innerText = "";
			data.inputWord = new Word("");
			data.curLetterId = 0;
		}
		return showNotice("NOT_IN_DICT");
	}
	showNotice("Submitting: " + data.inputWord.str);
	const feedback = giveFeedback(data.inputWord, data.targetWord);
	// color grid:
	feedback.letters.forEach((letter, ind) => {
		dom.grid[data.curGuessId][ind].classList.add(letter.state);
	});
	data.curGuessId++;
	// check endgame
	if (feedback.victory) {
		showNotice("VICTORY", 5000);
		setTimeout(endGame, 6000);
	} else if (data.curGuessId >= data.numAllowedGuesses) {
		showNotice("NO_MORE_GUESSES", 5000);
		dom.infoAnchor.innerText = "The word was: " + data.targetWord.str;
		endGame();
	}
	data.inputWord = new Word("");
	data.curLetterId = 0;
};

const insertLetter = (letter) => {
	dom.grid[data.curGuessId][data.curLetterId].innerText = letter.toLocaleUpperCase(data.curLangId);
	data.inputWord.addLetter(letter);
	data.curLetterId++;
};

const insertLetterFromKeyboard = (e) => {
	const letter = e.target.dataset.letter;
	insertLetter(e.target.dataset.letter);
};

const deleteLastLetter = () => {
	if (data.curLetterId < 1) {
		return;
	}
	data.curLetterId--;
	dom.grid[data.curGuessId][data.curLetterId].innerText = "";
	data.inputWord.deleteLastLetter();
};

const clearGrid = () => {
	dom.grid_container.innerHTML = "";
	dom.keyboard_container.innerHTML = "";
	dom.grid = [];
};

const createGrid = () => {
	for (let row = 0; row < data.numAllowedGuesses; row++) {
		dom.grid[row] = [];
		const _frag = new DocumentFragment();
		const gridRow = document.createElement("div");
		gridRow.className = "grid_row";
		gridRow.id = "row_" + row;
		_frag.append(gridRow);
		for (let col = 0; col < data.numLetters; col++) {
			const cell = document.createElement("a");
			cell.className = "grid_cell";
			//cell.innerText = "a" + (row * col);
			cell.id = "cell_" + row + "_" + col;
			gridRow.append(cell);
			dom.grid[row].push(cell);
		}
		dom.grid_container.append(_frag);
	}
	// create keyboard

	const arr = data.curLang.keyboardLayout;
	const numRows = arr.length
	for (let i = 0; i < numRows; i++) {
		const _frag = new DocumentFragment();
		const kbRow = document.createElement("div");
		kbRow.className = "kb_row";
		kbRow.id = "kb_row_" + i;
		_frag.append(kbRow);
		// letters in this row
		for (let j = 0; j < arr[i].length; j++) {
			const key = document.createElement("a");
			key.className = "kb_btn";
			key.id = "key_" + i + "_" + j;
			key.innerText = arr[i][j];
			key.dataset.letter = arr[i][j].toLocaleLowerCase(data.curLangId);
			key.onclick = insertLetterFromKeyboard;
			kbRow.append(key);
		}
		// Last row
		if (i === numRows - 1) {
			// Del button
			const key = document.createElement("a");
			key.className = "kb_btn";
			key.id = "key_del";
			key.innerText = "Del";
			key.onclick = deleteLastLetter;
			kbRow.append(key);

			// Enter button
			const key2 = document.createElement("a");
			key2.className = "kb_btn";
			key2.id = "key_enter";
			key2.innerText = "Enter";
			key2.onclick = submitCurrentWord;
			kbRow.prepend(key2);
		}
		dom.keyboard_container.append(_frag);
	}
};

const showNotice = (strId, duration = 2000) => {
	let str = data.curLang.strings[strId];
	str || (str = strId);
	console.log("showNotice: " + str);
	clearTimeout(dom.noticeTimer);
	dom.notice.innerText = str;
	dom.noticeTimer = setTimeout(() => {
		dom.notice.innerText = ""
	}, duration);
};


//const handleKeyUp = (e) => { // e.key: letter, case sensitive // e.keyCode: number, always uppercase }
const handleKeyDown = (e) => {
	// e.key and e.charCode both case sensitive
	console.log(e);
	if (!data.gameStarted) { return }
	const curLangId = data.curLangId;
	const letter_lowerCase = /*String.fromCharCode(keyCode)*/ e.key.toLocaleLowerCase(data.curLangId);
	switch (e.keyCode) {
		case 8: // Backspace
			deleteLastLetter();
			break;
		case 13: // Enter
			submitCurrentWord();
			break;
		default:
			if (data.curLetterId >= data.numLetters) { return }
			console.log(data.curLang.alphabet);
			console.log(letter_lowerCase);
			if (data.curLang.alphabet.indexOf(letter_lowerCase) === -1) { // letter is NOT in alphabet
				// showNotice("NOT_A_LETTER");
			} else { // valid letter
				insertLetter(letter_lowerCase);
			}
			break;
	}
};

const handleDebugSwitch = (e) => {
	toggleDebugMode(e.target.checked);
};
const toggleDebugMode = (isOn) => {
	data.allowInvalidGuesses = isOn;
};

const endGame = () => {
	dom.langSelect.parentNode.style.display = "";
	dom.newGameButton.style.display = "";
	data.gameStarted = false;
	clearGrid();
};

const startNewGame = async () => {
	data.curLangId = dom.langSelect.value;
	data.curLang = data.languages[data.curLangId];
	if (!data.curLang.wordList.length) {
		let wordList = await fetch(data.curLang.wordList_URL);
		wordList = await wordList.text();
		data.curLang.wordList = wordList.split(/\r?\n/);
	}
	const randomWord = data.curLang.wordList[Math.floor(Math.random() * data.curLang.wordList.length)];
	data.targetWord = new Word(randomWord);
	console.log("SPOILER", data.targetWord);

	dom.infoAnchor.innerText = "Language: " + data.curLang.name;
	dom.langSelect.parentNode.style.display = "none";
	dom.newGameButton.style.display = "none";
	clearGrid();
	createGrid();
	data.gameStarted = true;
	data.inputWord = new Word("");
	data.curGuessId = 0;
	data.curLetterId = 0;
	//document.onkeyup = handleKeyUp;
	//document.onkeypress = handleKeyPress;
	document.onkeydown = handleKeyDown;
};

const init = async () => {
	dom.notice = document.getElementById("notice");
	dom.game_container = document.getElementById("game_container");
	dom.grid_container = document.getElementById("grid_container");
	dom.keyboard_container = document.getElementById("keyboard_container");
	dom.infoAnchor = document.getElementById("info");

	const langSelect = dom.langSelect = document.getElementById("lang");
	const { LANGUAGES } = await import('./languages.js');
	Object.assign(data.languages, LANGUAGES);
	const langArray = Object.entries(data.languages);
	for (const [key, val] of langArray) {
		const opt = document.createElement('option');
		opt.value = key;
		opt.innerText = val.name;
		langSelect.appendChild(opt);
	}

	const newGameButton = dom.newGameButton = document.getElementById("new_game");
	newGameButton.onclick = await startNewGame;
	newGameButton.style.display = "none";

	const debugSwitch = dom.debugSwitch = document.getElementById("debug_mode");
	debugSwitch.onchange = handleDebugSwitch;
	toggleDebugMode(debugSwitch.checked); // restore settings

	setTimeout(() => { dom.newGameButton.click(); }, 500);
};

window.onload = async () => { await init(); };

// expose public module variables to window for debugging
Object.assign(globalThis, { data, dom, Word });