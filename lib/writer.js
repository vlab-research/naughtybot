const {parseEvent, getTimeoutDate, getPageFromEvent} = require('@vlab-research/utils')
const {getTimeouts} = require('./utils')
const util = require('util')

class NaughtyBotError extends Error {}

async function _waits(pool, msg) {
  const user = msg.key
  const e = parseEvent(msg.value)
  const pageid = getPageFromEvent(e)
  const timeouts = getTimeouts(e.message)

  if (timeouts) {
    for (let to of timeouts) {
      const query = `INSERT INTO timeouts(userid, pageid, timeout_date, fulfilled)
                       values($1, $2, $3, FALSE)
                       ON CONFLICT(userid, timeout_date) DO NOTHING;`

      const timeoutDate = getTimeoutDate(e.timestamp, to)
      await pool.query(query, [user, pageid, timeoutDate])
    }
  }

  return msg
}

async function writeWaits(pool, msg) {
  try {
    const res = await _waits(pool, msg)
    return res
  } catch (e) {
    console.error(`ERROR IN NAUGHTYBOT WRITING WAITS`)
    console.error(e)
  }
}

async function _timeouts(pool, msg) {

  const user = msg.key
  const e = parseEvent(msg.value)

  const timedOut = e.source === 'synthetic' &&
        e.event &&
        e.event.type === 'timeout'

  if (!timedOut) return msg

  console.log("MAKING QUERY WRITE TIMEOUTS")

  const query = `UPDATE timeouts SET fulfilled = TRUE
                 WHERE (userid = $1 AND timeout_date = $2);`

  const res = await pool.query(query, [user, new Date(e.event.value)])

  if (res.rowCount !== 1) {
    throw new NaughtyBotError(`Failed to write timeout, nonexistent! Event:\n ${util.inspect(e, null, 8)}` )
  }

  return msg
}


async function writeTimeouts(pool, msg) {
  try {
    const res = await _timeouts(pool, msg)
    return res
  } catch (e) {
    console.error(`ERROR IN NAUGHTYBOT WRITING TIMEOUTS`)
    console.error(e)
  }
}


module.exports = {writeWaits, writeTimeouts, NaughtyBotError}
