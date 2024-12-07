export const COMMANDS = {
	START: {
		name: 'start',
		description: 'starts a new game',
		options: [{
			name: "lang",
			description: "Language",
			type: 3,
			required: false,
			choices: [{
					name: "English",
					value: "en-US"
				},
				{
					name: "Türkçe",
					value: "tr-TR"
				}
			],
		}],
		ephemeral: false
	},

	GUESS: {
		name: 'guess',
		description: 'submit a new guess',
		options: [{
			name: "word",
			description: "make a guess",
			type: 3,
			required: true,
			min_length: 5,
			max_length: 5
		}],
		ephemeral: false
	},
};