const should = require('chai').should()
const {writeWaits, writeTimeouts, NaughtyBotError} = require('./writer')
const { Pool } = require('pg');
const fs = require('fs')
const {parseEvent, getTimeoutDate} = require('@vlab-research/utils')
const {dean} = require('./dean')
const nock = require('nock')
const {makeEcho, makeSynthetic, getFields} = require('@vlab-research/mox')

function makeMessage(value) {
  return { key: 'foo', value, timestamp: Date.now() + ''}
}

describe('Writer', () => {
  let pool

  before(async () => {
    pool = new Pool({user: 'root',
                     host: 'localhost',
                     database: 'defaultdb',
                     port: 5432})

    try {
      await pool.query('CREATE DATABASE naughtybottest');
    } catch (e) {}

    pool = new Pool({user: 'root',
                     host: 'localhost',
                     database: 'naughtybottest',
                     port: 5432})

    await pool.query('CREATE TABLE IF NOT EXISTS timeouts(userid VARCHAR NOT NULL, pageid VARCHAR NOT NULL, timeout_date TIMESTAMPTZ, fulfilled BOOLEAN, PRIMARY KEY (userid, timeout_date));')
    await pool.query('DELETE FROM timeouts')
  })

  afterEach(async () => {
    await pool.query('DELETE FROM timeouts')
  })

  after(async () => {
    await pool.query('DROP TABLE timeouts')
  })

  describe('writeWaits', () => {
    const log = fs.readFileSync('lib/log.json', 'utf-8')
    const events = log.split('\n').filter(s => !!s).map(s => ({ key: 'foo', value: s, timeout: Date.now()+'' }))

    it('ignores unnecessary events', async () => {
      await Promise.all(events.map(writeWaits.bind(null, pool)))

      const res = await pool.query('SELECT * from timeouts')
      res.rows.length.should.equal(1)
      res.rows[0].fulfilled.should.be.false
    })

    it('writes multiple', async () => {
      const timestamp = Date.now() - 1000*60*60*24*3

      const days = ['1 day', '2 days', '1 hour']
      const echos = days.map(d => makeEcho({ text: 'bar', metadata: { wait: { type: 'timeout', value: d}}}, 'foo', time=timestamp)).map(e => e.messaging[0]).map(makeMessage)

      await Promise.all(echos.map(e => writeWaits(pool, e)))
      const res = await pool.query('SELECT * from timeouts')

      res.rows.length.should.equal(3)
      res.rows.forEach(r => r.fulfilled.should.be.false)

    })

  })

  describe('writeTimeouts', () => {
    const log = fs.readFileSync('lib/log.json', 'utf-8')
    const events = log.split('\n').filter(s => !!s).map(s => ({ key: 'foo', value: s, timeout: Date.now()+'' }))

    it('ignores unnecessary events', async () => {
      const e = [...events, {key: 'foo', timeout: Date.now()+'', value: makeSynthetic('foo', { type: 'timeout', value: new Date('2019-09-02T10:00:00.000Z').getTime()})}]

      await Promise.all(e.map(writeWaits.bind(null, pool)))
      await Promise.all(e.map(writeTimeouts.bind(null, pool)))

      const res = await pool.query('SELECT * from timeouts')
      res.rows.length.should.equal(1)
      res.rows[0].fulfilled.should.be.true
    })

    it('handles missing user/timestamps by throwing error', async () => {
      const e = [...events, {key: 'bar', timeout: Date.now()+'', value: makeSynthetic('bar', { type: 'timeout', value: new Date('2019-09-02T10:00:00.000Z').getTime()})}]

      await Promise.all(e.map(writeWaits.bind(null, pool)))

      try {
        await Promise.all(e.map(writeTimeouts.bind(null, pool)))
      } catch (e) {
        e.should.be.instanceof(NaughtyBotError)
      }

      const res = await pool.query('SELECT * from timeouts')
      res.rows.length.should.equal(1)
      res.rows[0].fulfilled.should.be.false
    })


  })

  describe('dean', () => {

    before(() => {
      process.env.BOTSERVER_URL = 'http://botserver.com'
    })

    it('handles nothing to do ', async () => {
      const res = await dean(pool)
      res.should.eql([])
    })

    it('sends a synthetic event that matches our mock library', async () => {
      const timestamp = Date.now() - 1000*60*60*24*3
      const days = ['1 day']

      const echos = days.map(d => makeEcho({ text: 'bar', metadata: { wait: { type: 'timeout', value: d}}}, 'foo', timestamp)).map(e => e.messaging[0]).map(makeMessage)

      const expect = makeSynthetic('foo', {type: 'timeout', value: getTimeoutDate(timestamp, days[0])})
      const ex = JSON.parse(JSON.stringify(expect))

      nock('http://botserver.com')
        .post('/synthetic', (body) => {
          return body.should.eql(ex)
        })
        .reply(200, (uri, body) => body)

      await Promise.all(echos.map(e => writeWaits(pool, e)))

      const res = await dean(pool)
      res.length.should.equal(1)
      res.map(r => r.status).forEach(s => s.should.equal(200))
    })

    it('handles multiple posts when they are due', async () => {
      nock('http://botserver.com')
        .post('/synthetic')
        .times(3)
        .reply(200, (uri, body) => body)

      const timestamp = Date.now() - 1000*60*60*24*3

      const days = ['1 day', '2 days', '1 hour', '5 days']
      const echos = days.map(d => makeEcho({ text: 'bar', metadata: { wait: { type: 'timeout', value: d}}}, 'foo', timestamp)).map(e => e.messaging[0]).map(makeMessage)

      await Promise.all(echos.map(e => writeWaits(pool, e)))

      const res = await dean(pool)

      res.length.should.equal(3)
      res.map(r => r.status).forEach(s => s.should.equal(200))

    })

    it('blows up on botserver error', async () => {
      nock('http://botserver.com')
        .post('/synthetic')
        .times(2)
        .reply(200, (uri, body) => body)

      nock('http://botserver.com')
        .post('/synthetic')
        .times(1)
        .replyWithError({ message: 'error', code: 500})

      const timestamp = Date.now() - 1000*60*60*24*3

      const days = ['1 day', '2 days', '1 hour', '5 days']
      const echos = days.map(d => makeEcho({ text: 'bar', metadata: { wait: { type: 'timeout', value: d}}}, 'foo', timestamp)).map(e => e.messaging[0]).map(makeMessage)

      await Promise.all(echos.map(e => writeWaits(pool, e)))

      let err

      try {
        const res = await dean(pool)
      }
      catch (e) {
        err = e
      }

      err.should.be.instanceof(Error)
    })

  })

})
