const should = require('chai').should()
const u = require('./utils')

describe('timeouter', () => {

  it('returns null if no timeout', () => {
    const res = u.timeouter({ type: 'event', value: {}})
    should.not.exist(res)
  })

  it('returns null if no wait', () => {
    const res = u.timeouter()
    should.not.exist(res)
  })

  it('returns a top level wait', () => {
    const res = u.timeouter({ type: 'timeout', value: '2 days'})
    res.should.eql(['2 days'])
  })

  it('returns a second level wait', () => {
    const res = u.timeouter({ op: 'and', vars: [{ type: 'timeout', value: '2 days'}, {type: 'event', value: {} }]})
    res.should.eql(['2 days'])
  })

  it('returns multiple waits deeply nested', () => {
    const res = u.timeouter({ op: 'and', vars: [{op: 'or', vars: [{type: 'timeout', value: '1 day'}, {type: 'event', value: {}}]}, { op: 'and', vars: [{type: 'timeout', value: '2 hours'}, { op: 'or', vars: [{type: 'timeout', value: '5 days'}]}] }]})
    res.should.eql(['1 day', '2 hours', '5 days'])
  })
})
