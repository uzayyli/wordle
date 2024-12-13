# Wordle
JavaScript Wordle game for browsers and Discord

# How to Setup
- (for Node version <20) The package `dotenv` is used in `src/register.js`, reads relevant keys from `.dev.vars` file
- Create a Cloudflare Worker
- Save your Discord bot's secret values like: 
  - `wrangler secret put DISCORD_TOKEN`
- Create two Cloudflare KV namespaces:
  - `npx wrangler kv namespace create PUZZLES`
  - save the returned data in `wrangler.toml`

# Notes
- You can add your own language by editing /public/languages.js
- The word list supplied in `wordList_URL` field must contain one word per line, all lowercase

# Contributors
<p>
<a href="https://github.com/uzayyli"><img width="60" src="https://avatars.githubusercontent.com/u/87779551?v=4"/><a href="https://github.com/mertushka"><img width="60" src="https://avatars1.githubusercontent.com/u/34413473?v=4"/>
</p>
  
# TODO
- Implement modal guess input
- Implement modal custom word input