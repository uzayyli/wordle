const dom = {
	noticeTimer:null
};
const style = {
	squareSize: 60,
	gap: 5,
};
const data = {
	numLetters:5,
	numGuesses: 6, // total guesses allowed
	curGuessId: 0, // current guess ID. can go up to numGuesses-1
	curLetterId: 0, // [0, numLetters-1]
	curLetters: [],
	curWord:"",
	curLanguage:"en",
	languages:{
		"en":{
			alphabet:"ABCDEFGHIJKLMNOPQRSTUVWXYZ",
			strings:{
				"NOT_A_WORD": "not a valid word",
				"NOT_A_LETTER": "not a valid letter",
				"NOT_IN_DICT": "word not found in dictionary",
			},
		}
	},
};

const drawGrid = () => {
	const squareSize = style.squareSize;
	const gap = style.gap;
	const ctx = dom.ctx;
	for(let row = data.numGuesses; row > 0; row--) {
		for(let col = data.numLetters; col > 0; col--) {
			const x = (col-1) * (squareSize + gap) + gap;
			const y = (row-1) * (squareSize + gap) + gap;
			ctx.strokeRect(x, y, squareSize, squareSize);
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

const handleKeyPress = e => {
	console.log(e);
	const ctx = dom.ctx;
	const kc = e.keyCode;
	const letter = String.fromCharCode(kc).toUpperCase();
	if(kc === 8){ // Backspace
		if(data.curLetterId < 1){return;}
		data.curLetterId--;
		const s = style.squareSize, g = style.gap;
		ctx.clearRect(3 + g + (data.curLetterId) * (s + g), 3 + g + (data.curGuessId) * (s + g),s-6,s-6)
	}else if(kc === 13){ // Enter
		showNotice("TODO");
	}else if(data.languages[data.curLanguage].alphabet.indexOf(letter)==-1){ // letter is NOT in alphabet
		showNotice("NOT_A_LETTER");
	}else{
		const s = style.squareSize, g = style.gap;
		ctx.fillText(letter, s/2 + g + (data.curLetterId) * (s + g), s/2 + g + (data.curGuessId) * (s + g));
		data.curLetterId++;
	}
};

const init = () => {
	const canvas = dom.canvas = document.getElementById("wordle");
	const ctx = dom.ctx = canvas.getContext('2d');
	dom.notice = document.getElementById("notice");
	dom.notice.innerText = "";
	canvas.width = 330;
	canvas.height = 480;
	ctx.strokeStyle = "#808080";
	ctx.fillStyle = "#ffffff";
	ctx.lineWidth = 2;
	ctx.font = "30px Verdana";
	ctx.textAlign = "center";
	ctx.textBaseline = 'middle'
	
	drawGrid();
	
	canvas.focus();
	canvas.onkeyup = handleKeyPress;
};

window.onload = () => {
	init();
};