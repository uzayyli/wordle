export const LANGUAGES = {
	"en-US": {
		name: "English",
		alphabet: "abcdefghijklmnopqrstuvwxyz",
		keyboardLayout: ["qwertyuiop", "asdfghjkl", "zxcvbnm"],
		strings: {
			"NOT_A_WORD": "not a valid word",
			"NOT_A_LETTER": "not a valid letter",
			"NOT_IN_DICT": "word not found in dictionary",
			"NO_MORE_GUESSES": "you ran out of guesses",
			"VICTORY": "you found the word!",
		},
		wordList_URL: "https://raw.githubusercontent.com/tabatkins/wordle-list/refs/heads/main/words",
		wordList: [],
	},
	"tr-TR": {
		name: "Türkçe",
		alphabet: "abcçdefgğhıijklmnoöprsştuüvyzqxw",
		keyboardLayout: ["qwertyuıopğü", "asdfghjklşi", "zxcvbnmöç"],
		strings: {
			"NOT_A_WORD": "geçersiz kelime",
			"NOT_A_LETTER": "geçersiz harf",
			"NOT_IN_DICT": "kelime sözlükte bulunamadı",
			"NO_MORE_GUESSES": "tahmin hakkınız doldu",
			"VICTORY": "kelimeyi buldunuz!",
		},
		wordList_URL: "https://raw.githubusercontent.com/uzayyli/wordle/refs/heads/main/public/wordlist_tr.txt",
		wordList: [],
	},
};