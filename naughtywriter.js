const {BotSpine} = require('@vlab-research/botspine')
const Chatbase = require('@vlab-research/chatbase-postgres')
const {writeWaits, writeTimeouts} = require('./lib/writer')
const {pipeline} = require('stream')


const spine = new BotSpine('naughtybot')
const pool = new Chatbase().pool


pipeline(spine.source(),
         spine.transform(async (m) => {

           // Write waits and timeouts concurrently
           await Promise.all([writeWaits(pool, m),
                              writeTimeouts(pool, m)])
         }, chunkSize, timeout),
         spine.sink(),
         err => console.error(err))
