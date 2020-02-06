const r2 = require('r2')

async function postTimeoutEvent(row) {
  // TODO: Add pageid!
  const json = {user: row.userid,
                page: row.pageid,
                source: 'synthetic',
                event: { type: 'timeout', value: row.timeout_date }}

  const url = `${process.env.BOTSERVER_URL}/synthetic`
  const res = await r2.post(url, {json}).response

  if (res.status !== 200){
    throw new Error('Failed to post synthetic event to botserver, response:\n', res)
  }

  return res
}

async function getUnfulfilled(pool) {
  const query = `SELECT * FROM timeouts WHERE (fulfilled = FALSE AND timeout_date < NOW());`
  const res = await pool.query(query)
  return res.rows
}

async function dean(pool){
  const res = await getUnfulfilled(pool)
  return Promise.all(res.map(postTimeoutEvent))
}

module.exports = { dean }
