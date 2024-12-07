# Wordle
JavaScript Wordle game for browsers, Node and Discord.js

# How to Setup
- (for Node version <20) The package `dotenv` is used in `src/register.js`, reads four keys from `.env` file, an example is supplied in `example.env`
- Create a Cloudflare Worker
- Create two Cloudflare KV namespaces:
  - `npx wrangler kv namespace create GUESSES`
  - `npx wrangler kv namespace create WORDS`
  - save the returned data in `wrangler.toml`

# Contributors
<p>
<a href="https://github.com/uzayyli"><img width="60" src="https://avatars.githubusercontent.com/u/87779551?v=4"/><a href="https://github.com/mertushka"><img width="60" src="https://avatars1.githubusercontent.com/u/34413473?v=4"/>
</p>

<p>
Thanks to <a href="https://www.freecodecamp.org/news/build-a-wordle-clone-in-javascript/">Paul Akinyemi</a>
</p>
  
# TODO
- add support for multi language words to web