const dom = {
	noticeTimer: null
};
const style = {
	squareSize: 60,
	gap: 5,
	colors: {
		"BORDER_LIGHT": "#565758",
		"FONT_COLOR": "#ffffff",
		"BACKGROUND": "#121213",
		"GRAY": "#3a3a3c",
		"YELLOW": "#b59f3b",
		"GREEN": "#538d4e"
	}
};
const data = {
	numLetters:5,
	numGuesses: 6, // total guesses allowed
	curGuessId: 0, // current guess ID. can go up to numGuesses-1
	curLetterId: 0, // [0, numLetters-1]
	curLetters_LC: [],
	curLetters_UC: [],
	curWord: "",
	curLanguage: "en-US",
	targetWord: "",
	targetLetters: [],
	targetLetterCounts: {},
	languages:{
		"en-US": {
			alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
			keyboardLayout:["QWERTYUIOP","ASDFGHJKL","ZXCVBNM"],
			strings:{
				"NOT_A_WORD": "not a valid word",
				"NOT_A_LETTER": "not a valid letter",
				"NOT_IN_DICT": "word not found in dictionary",
				"VICTORY": "you found the word!",
			},
			//dictionary_url: "https://raw.githubusercontent.com/tabatkins/wordle-list/refs/heads/main/words",
			dictionary_url: "https://raw.githubusercontent.com/uzayyli/wordle/refs/heads/main/dict/en_example.txt",
			dictionary: [],
		},
		"tr-TR": {
			
		},
	},
};

const drawGrid = () => {
	const squareSize = style.squareSize;
	const gap = style.gap;
	const ctx = dom.ctx;
	ctx.strokeStyle = style.colors.BORDER_LIGHT;
	for(let row = data.numGuesses; row > 0; row--) {
		for(let col = data.numLetters; col > 0; col--) {
			const x = (col-1) * (squareSize + gap) + gap;
			const y = (row-1) * (squareSize + gap) + gap;
			ctx.strokeRect(x, y, squareSize, squareSize);
		}
	}
};

const drawLetterOnGrid = (letter, row, col, bgColor = "#ffffff") => {
	const s = style.squareSize, g = style.gap, ctx = dom.ctx;
	if(bgColor){
		// TODO: fill rect
		ctx.fillStyle = bgColor;
	}
	ctx.fillText(letter, s/2 + g + col * (s + g), s/2 + g + row * (s + g));
};

const clearGridPosition = (row, col, bgColor = "#ffffff") => {
	const s = style.squareSize, g = style.gap, ctx = dom.ctx;
	if(bgColor){
		// TODO: fill rect
		ctx.fillStyle = bgColor;
		ctx.fillRect(3 + g + col * (s + g), 3 + g + row * (s + g),s-6,s-6)
	}else{
		ctx.clearRect(3 + g + col * (s + g), 3 + g + row * (s + g),s-6,s-6)
	}
};

const submitWord = (word) => {
	if(false && data.languages[data.curLanguage].dictionary.indexOf(word) === -1){
		showNotice("NOT_A_WORD");
	}else{ // valid word
		if(word === data.targetWord) // correct word
		{
			showNotice("VICTORY");
		}else{ // valid but wrong word
			const letterCounts = structuredClone(data.targetLetterCounts);
			for(let i=0;i<data.numLetters;i++){
				let myLetter = data.curLetters_LC[i];
				let targetLetter = data.targetLetters[i];
				if(myLetter === targetLetter){
					// paint green
					clearGridPosition(data.curGuessId,i,style.colors.GRAY);
					drawLetterOnGrid(data.curLetters_UC[i],data.curGuessId,i/*,style.colors.GREEN*/);
				}else if(letterCounts[myLetter]){
					letterCounts[myLetter]--;
					// paint yellow
					clearGridPosition(data.curGuessId,i,style.colors.YELLOW);
					drawLetterOnGrid(data.curLetters_UC[i],data.curGuessId,i/*,style.colors.YELLOW*/);
				}else{
					// paint gray
					clearGridPosition(data.curGuessId,i,style.colors.GRAY);
					drawLetterOnGrid(data.curLetters_UC[i],data.curGuessId,i/*,style.colors.GRAY*/);
				}
			}
			data.curGuessId++;
			data.curLetterId = 0;
			data.curLetters_LC = [];
			data.curLetters_UC = [];
			data.curWord = "";
		}
	}
};

const showNotice = (id) => {
	let str = data.languages[data.curLanguage].strings[id];
	str || (str = id);
	clearTimeout(dom.noticeTimer);
	dom.notice.innerText = str;
	dom.noticeTimer = setTimeout(()=>{dom.notice.innerText = ""}, 2000);
};

const handleKeyUp = e => {
	//console.log(e);
	const ctx = dom.ctx;
	const kc = e.keyCode;
	const letter = String.fromCharCode(kc); // keyup event always returns uppercase keyCode
	if(kc === 8){ // Backspace
		if(data.curLetterId < 1){return;}
		data.curLetterId--;
		data.curLetters_LC.pop();
		data.curLetters_UC.pop();
		data.curWord = data.curWord.substring(0,data.curWord.length-1)
		const s = style.squareSize, g = style.gap;
		//ctx.fillStyle = "red";
		//ctx.fillRect(3 + g + (data.curLetterId) * (s + g), 3 + g + (data.curGuessId) * (s + g),s-6,s-6)
		clearGridPosition(data.curGuessId, data.curLetterId, style.colors.BACKGROUND);
	}else if(kc === 37){ // ArrowLeft
		showNotice("TODO: Left Arrow");
	}else if(kc === 13){ // Enter
		showNotice("Submitting: "+data.curWord);
		submitWord(data.curWord);
	}else if(data.languages[data.curLanguage].alphabet.indexOf(letter)==-1){ // letter is NOT in alphabet
		showNotice("NOT_A_LETTER");
	}else{ // valid letter
		drawLetterOnGrid(letter,data.curGuessId,data.curLetterId,style.colors.FONT_COLOR);
		data.curLetterId++;
		const lowerCaseLetter = letter.toLocaleLowerCase(); // TODO: make sure?
		data.curWord += lowerCaseLetter;
		data.curLetters_LC.push(lowerCaseLetter);
		data.curLetters_UC.push(letter);
	}
};

const fetchDictionaries = () => {
	const lang = "en-US";
	fetch(data.languages[lang].dictionary_url, {method: 'get'})
		.then(function(body){
			return body.text();
		}).then(function(words){
			//console.log(words);
			//data.languages[lang].dictionary = words.split(/\r?\n/);
			data.languages[lang].dictionary = ["rossa","jetty","wizzo"];
		});
};
const init = () => {
	
	fetchDictionaries();
	
	const canvas = dom.canvas = document.getElementById("wordle");
	const ctx = dom.ctx = canvas.getContext('2d');
	dom.notice = document.getElementById("notice");
	dom.notice.innerText = "";
	canvas.width = 330;
	canvas.height = 540;
	ctx.fillStyle = "#ffffff";
	ctx.lineWidth = 2;
	ctx.font = "30px Verdana";
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	
	const playButton = dom.playButton = document.getElementById("play");
	playButton.onclick = startGame;
	
	dom.canvas.style.display = "none";
	
};

const startGame = () => {
	dom.playButton.style.display = "none";
	dom.canvas.style.display = "";
	drawGrid();
	dom.canvas.focus();
	dom.canvas.onkeyup/*onkeypress*/ = handleKeyUp;
	
	// pick random(?) word:
	const dict = data.languages[data.curLanguage].dictionary;
	const randomWord = dict[Math.floor(Math.random() * dict.length)];
	console.log("[SPOILER] picked word: "+randomWord);
	data.targetWord = randomWord;
	data.targetLetters = randomWord.split("");
	data.targetLetterCounts = {};
	data.targetLetters.forEach((x)=>{
		data.targetLetterCounts[x] ? (data.targetLetterCounts[x]++) : (data.targetLetterCounts[x] = 1);
	});
};

window.onload = () => {
	init();
};