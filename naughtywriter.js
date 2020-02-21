const {BotSpine} = require('@vlab-research/botspine')
const Chatbase = require('@vlab-research/chatbase-postgres')
const {writeWaits, writeTimeouts} = require('./lib/writer')
const {pipeline} = require('stream')

const spine = new BotSpine('naughtybot')
const pool = new Chatbase().pool

const chunkSize = +process.env.NAUGHTY_CHUNK_SIZE || 100
const timeout = +process.env.NAUGHTY_TIMEOUT || 5000

pipeline(spine.source(),
         spine.chunkedTransform(async (m) => {

           // Write waits and timeouts concurrently
           await Promise.all([writeWaits(pool, m),
                              writeTimeouts(pool, m)])
         }, chunkSize, timeout),
         spine.sink(),
         err => console.error(err))
