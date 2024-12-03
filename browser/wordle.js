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
    numLetters: 5,
    numAllowedGuesses: 6,
    curGuessId: 0, // current guess ID. can go up to numGuesses-1
    curLetterId: 0, // [0, numLetters-1]
    curLetters: [],
    curWord: "",
    curLanguage: "en-US",
    targetWord: "",
    targetLetters: [],
    allowInvalidGuesses: false, // can turn on for debugging purposes
    languages: {
        "en-US": {
            //alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
            alphabet: "abcdefghijklmnopqrstuvwxyz",
            //keyboardLayout:["QWERTYUIOP","ASDFGHJKL","ZXCVBNM"],
            keyboardLayout: ["qwertyuiop", "asdfghjkl", "zxcvbnm"],
            strings: {
                "NOT_A_WORD": "not a valid word",
                "NOT_A_LETTER": "not a valid letter",
                "NOT_IN_DICT": "word not found in dictionary",
                "NO_MORE_GUESSES": "you ran out of guesses",
                "VICTORY": "you found the word!",
            },
            dictionary_url: "https://raw.githubusercontent.com/tabatkins/wordle-list/refs/heads/main/words",
            //dictionary_url: "https://raw.githubusercontent.com/uzayyli/wordle/refs/heads/main/dict/en_example.txt",
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
    for (let row = data.numAllowedGuesses; row > 0; row--) {
        for (let col = data.numLetters; col > 0; col--) {
            const x = (col - 1) * (squareSize + gap) + gap;
            const y = (row - 1) * (squareSize + gap) + gap;
			ctx.clearRect(x, y, squareSize, squareSize); // for new game
            ctx.strokeRect(x, y, squareSize, squareSize);
        }
    }
};

const drawLetterOnGrid = (letter, row, col, bgColor = "#ffffff") => {
    letter = letter.toLocaleUpperCase(data.curLanguage)
    const s = style.squareSize,
        g = style.gap,
        ctx = dom.ctx;
    if (bgColor) {
        ctx.fillStyle = bgColor;
    }
    ctx.fillText(letter, s / 2 + g + col * (s + g), s / 2 + g + row * (s + g));
};

const clearGridPosition = (row, col, bgColor = "#ffffff") => {
    const s = style.squareSize,
        g = style.gap,
        ctx = dom.ctx;
    if (bgColor) {
        ctx.fillStyle = bgColor;
        ctx.fillRect(3 + g + col * (s + g), 3 + g + row * (s + g), s - 6, s - 6)
    } else {
        ctx.clearRect(3 + g + col * (s + g), 3 + g + row * (s + g), s - 6, s - 6)
    }
};

const clearGridRow = (row) => {
    const s = style.squareSize,
        g = style.gap,
        ctx = dom.ctx;
    for (let i = data.numLetters - 1; i >= 0; i--) {
        ctx.clearRect(3 + g + i * (s + g), 3 + g + row * (s + g), s - 6, s - 6)
    }
    data.curLetterId = 0;
    data.curLetters = [];
    data.curWord = "";
};

const submitWord = (word) => {
    if (!data.allowInvalidGuesses && data.languages[data.curLanguage].dictionary.indexOf(word) === -1) {
        showNotice("NOT_A_WORD");
        clearGridRow(data.curGuessId);
    } else { // valid word
        if (word === data.targetWord) // correct word
        {
            showNotice("VICTORY");
			const row = data.curGuessId;
			for (let i = data.numLetters - 1; i >= 0; i--) {
				clearGridPosition(row, i, style.colors.GREEN);
				drawLetterOnGrid(data.curLetters[i].letter, row, i);
            }
			dom.newGameButton.style.display = "";
        } else { // valid but wrong word
            let N = data.numLetters;
            const inputLetters = structuredClone(data.curLetters);
            const targetLetters = structuredClone(data.targetLetters);
            // check greens first:
            for (let i = N - 1; i >= 0; i--) {
                if (inputLetters[i].letter === targetLetters[i].letter) {
                    clearGridPosition(data.curGuessId, i, style.colors.GREEN);
                    drawLetterOnGrid(inputLetters[i].letter, data.curGuessId, i);
                    inputLetters.splice(i, 1);
                    targetLetters.splice(i, 1);
                }
            }
            // check the remaining letters
            const targetLetterCounts = {};
            targetLetters.forEach((x) => {
                targetLetterCounts[x.letter] ? (targetLetterCounts[x.letter]++) : (targetLetterCounts[x.letter] = 1);
            });
            N = targetLetters.length;
            let inputLetter, targetLetter, bgColor;
            for (let i = 0; i < N; i++) {
                inputLetter = inputLetters[i].letter;
                targetLetter = targetLetters[i].letter;
                if (targetLetterCounts[inputLetter]) { // yellow
                    targetLetterCounts[inputLetter]--;
					bgColor = style.colors.YELLOW;
                } else { // gray
                    bgColor = style.colors.GRAY;
                }
				//console.log(`i = ${i}, inputLetter = ${inputLetter}, targetLetter = ${targetLetter}, bgColor = ${bgColor}`);
                clearGridPosition(data.curGuessId, inputLetters[i].index, bgColor);
                drawLetterOnGrid(inputLetter, data.curGuessId, inputLetters[i].index);
            }
            data.curLetterId = 0;
            data.curLetters = [];
            data.curWord = "";
            if(++data.curGuessId >= data.numAllowedGuesses){
				showNotice("NO_MORE_GUESSES");
				dom.newGameButton.style.display = "";
			}
        }
    }
};

const showNotice = (id) => {
    let str = data.languages[data.curLanguage].strings[id];
    str || (str = id);
    clearTimeout(dom.noticeTimer);
    dom.notice.innerText = str;
    dom.noticeTimer = setTimeout(() => {
        dom.notice.innerText = ""
    }, 2000);
};

const handleKeyUp = e => {
    //console.log(e);
	if(data.curGuessId >= data.numAllowedGuesses){
		return;
	}
    const ctx = dom.ctx;
    const kc = e.keyCode;
    const letter = String.fromCharCode(kc).toLocaleLowerCase(data.curLanguage); // keyup event always returns uppercase keyCode
    if (kc === 8) { // Backspace
        if (data.curLetterId < 1) {
            return;
        }
        data.curLetterId--;
        data.curLetters.pop();
        data.curWord = data.curWord.substring(0, data.curWord.length - 1)
        const s = style.squareSize,
            g = style.gap;
        //ctx.fillStyle = "red";
        //ctx.fillRect(3 + g + (data.curLetterId) * (s + g), 3 + g + (data.curGuessId) * (s + g),s-6,s-6)
        clearGridPosition(data.curGuessId, data.curLetterId, style.colors.BACKGROUND);
    } else if (kc === 37) { // ArrowLeft
        showNotice("TODO: Left Arrow");
    } else if (kc === 13) { // Enter
        showNotice("Submitting: " + data.curWord);
        submitWord(data.curWord);
    } else if (data.languages[data.curLanguage].alphabet.indexOf(letter) == -1) { // letter is NOT in alphabet
        showNotice("NOT_A_LETTER");
    } else { // valid letter
        drawLetterOnGrid(letter, data.curGuessId, data.curLetterId, style.colors.FONT_COLOR);
        const lowerCaseLetter = letter.toLocaleLowerCase(data.curLanguage);
        data.curWord += lowerCaseLetter;
        data.curLetters.push({
            letter: letter,
            index: data.curLetterId++
        });
    }
};

const handleDebugSwitch = (e) => {
    toggleDebugMode(e.target.checked);
};
const toggleDebugMode = (isOn) => {
    data.allowInvalidGuesses = isOn;
};

const fetchDictionaries = () => {
    const lang = "en-US";
    fetch(data.languages[lang].dictionary_url, {method: 'get'})
    	.then(function(body){
    		return body.text();
    	}).then(function(words){
    		//console.log(words);
    		data.languages[lang].dictionary = words.split(/\r?\n/);
    		//data.languages[lang].dictionary = ["rossa","jetty","wizzo"];
    	});
    /*
    */
    //data.languages[lang].dictionary = ["rossa", "jetty", "wizzo", "rasta", "jette", "wizzi"];
};

const init = () => {

    fetchDictionaries();

    const canvas = dom.canvas = document.getElementById("wordle");
    const ctx = dom.ctx = canvas.getContext('2d');
    dom.notice = document.getElementById("notice");
    //dom.notice.innerText = "";
    canvas.width = 330;
    canvas.height = 540;
    ctx.fillStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.font = "30px Verdana";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const playButton = dom.playButton = document.getElementById("play");
    playButton.onclick = startNewGame;
	
	const newGameButton = dom.newGameButton = document.getElementById("new_game");
    newGameButton.onclick = startNewGame;
    newGameButton.style.display = "none";

    const debugSwitch = dom.debugSwitch = document.getElementById("debug_mode");
    debugSwitch.onchange = handleDebugSwitch;
    toggleDebugMode(debugSwitch.checked);

    canvas.style.display = "none";

};

const pickWord = (word) => {
    word = word.toLocaleLowerCase(data.curLanguage);
    console.log("[SPOILER] picked word: " + word);
    data.targetWord = word;
    data.targetLetters = word.split("").map((x, ind) => {
		return {
			letter: x,
			index: ind
		}
    });
};

const startNewGame = () => {
    dom.playButton.style.display = "none";
	dom.newGameButton.style.display = "none";
    dom.canvas.style.display = "";
    drawGrid();
    dom.canvas.focus();
    dom.canvas.onkeyup /*onkeypress*/ = handleKeyUp;

    // pick random(?) word:
    const dict = data.languages[data.curLanguage].dictionary;
    const randomWord = dict[Math.floor(Math.random() * dict.length)];
    pickWord(randomWord);
	
	Object.assign(data,{
		curGuessId: 0,
		curLetterId: 0,
		curLetters: [],
		curWord: "",
	});
};

window.onload = () => {
    init();
};