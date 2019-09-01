function _getTimeouts(wait){
  if (!wait) return null
  if (wait.type === 'timeout') return wait.value
  if (wait.op && wait.vars) {
    return wait.vars
      .map(_getTimeouts)
      .filter(e => !!e)
      .reduce((acc, val) => acc.concat(val), [])
  }
  return null
}

function timeouter(wait) {
  const timeout = _getTimeouts(wait)
  return Array.isArray(timeout) || !timeout ? timeout : [timeout]
}

function getTimeouts(message) {
  if (!message) return null
  const wait = message.metadata && message.metadata.wait
  return timeouter(wait)
}

module.exports = {
  timeouter,
  getTimeouts
}
