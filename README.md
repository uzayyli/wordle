# Wordle
JavaScript Wordle game for browsers and Discord.js

# How to Setup
- (for Node version <20) The package `dotenv` is used in `src/register.js`, reads relevant keys from `.dev.vars` file
- Create a Cloudflare Worker
- Enter your bot's secret values like: 
  - `wrangler secret put DISCORD_TOKEN`
- Create two Cloudflare KV namespaces:
  - `npx wrangler kv namespace create GUESSES`
  - `npx wrangler kv namespace create PUZZLES`
  - save the returned data in `wrangler.toml`

# Notes
- Assumes the wordlists contains one word per line, all lowercase

# Contributors
<p>
<a href="https://github.com/uzayyli"><img width="60" src="https://avatars.githubusercontent.com/u/87779551?v=4"/><a href="https://github.com/mertushka"><img width="60" src="https://avatars1.githubusercontent.com/u/34413473?v=4"/>
</p>
  
# TODO
- Add /start option to turn off co-op mode
- Draw keyboard in workers version
- Implement modal guess input