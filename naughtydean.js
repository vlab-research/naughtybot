const {dean} = require('./lib/dean')
const Chatbase = require('@vlab-research/chatbase-postgres')

const pool = new Chatbase().pool

dean(pool).then(res => {
  console.log('DEAN COMPLETED WITH: ', res)
})
