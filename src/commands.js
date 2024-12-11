export const COMMANDS = {
	START: {
		name: 'start',
		description: 'starts a new game',
		options: [{
				name: "lang",
				description: "Language",
				type: 3,
				required: true,
				choices: [{
						name: "English",
						value: "en-US"
					},
					{
						name: "Türkçe",
						value: "tr-TR"
					}
				],
			},
			{
				name: "coop",
				description: "Co-operative?",
				type: 5,
				required: false,
			},
			{
				name: "word",
				description: "Target word (create a co-op puzzle yourself)",
				type: 3,
				required: false,
				min_length: 1,
				max_length: 50
			},
			{
				name: "max_guesses",
				description: "Maximum allowed guesses (default: 6, allowed only for custom word puzzles)",
				type: 4,
				required: false,
				min_value: 1,
				max_value: 50
			}
		],
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

	END: {
		name: 'delete',
		description: 'end your puzzle',
		options: [{
			name: "coop",
			description: "Co-operative?",
			type: 5,
			required: false,
		}],
		ephemeral: false
	},
};