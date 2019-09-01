const {BotSpine} = require('@vlab-research/botspine')
const Chatbase = require('@vlab-research/chatbase-postgres')
const {writeWaits, writeTimeouts} = require('./lib/writer')
const {pipeline} = require('stream')

const spine = new BotSpine('naughtybot')
const pool = new Chatbase().pool

pipeline(spine.source(),
         spine.chunkedTransform(m => writeWaits(pool, m), 100, 5000),
         spine.chunkedTransform(m => writeTimeouts(pool, m), 100, 5000),
         spine.sink(),
         err => console.error(err))
